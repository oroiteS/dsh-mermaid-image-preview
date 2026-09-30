// @baconbao/dsh-mermaid-image-preview - node half.
// Two responsibilities:
//
// 1) Configure the render server through the profile patch config
//    (cordis.patch.yml), resolved HERE on the Host and shipped to the browser
//    as boot-time globals through the structured `webserver/index-inject`
//    table (NOT `tapIndex`: the desktop shell serves its own static index and
//    only replays the structured injection rows to the page):
//
//        ~/.dsh/profiles/desktop/cordis.patch.yml:
//          - id: ui-dsh-mermaid-image-preview
//            config:
//              enableLocalRender: true
//              fallbackRenderUrl: https://your-own-server.example.com
//              enableFallback: false
//
// 2) Serve a built-in local mermaid renderer on `/dsh-mermaid-image-preview`
//    (path format: /dsh-mermaid-image-preview/svg/<urlsafe-base64>[?theme=dark]),
//    rendered in-process by `mermaid` + `svgdom` (no Chrome, no external
//    service). Set `enableLocalRender: false` in the profile patch to skip
//    the local renderer and use `fallbackRenderUrl` directly.
//
// The browser half never touches Host settings; it reads the injected globals
// only. The plugin version is read from this package's own package.json and
// injected the same way for the settings card.
import { createRequire } from "node:module";
import z from "@deepseek-ai/schemastery";
import { createHTMLWindow } from "svgdom";
import mermaid from "mermaid";
import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");

// ── mermaid + svgdom engine (pure Node, no Chrome) ─────────────────────────
// Lazy: svgdom's window is injected into the globals ONLY on the first render,
// so the Host process is not polluted at module load. Diagram types that need
// canvas (mindmap) or full layout measurement (gantt) cannot render in Node
// without a real browser.
let mermaidReady = false;

function ensureMermaidReady() {
	if (mermaidReady) return;
	const DOMPurifyWindow = new JSDOM("").window;
	const DOMPurify = createDOMPurify(DOMPurifyWindow);
	Object.assign(createDOMPurify, DOMPurify);
	const svgWindow = createHTMLWindow();
	Object.assign(globalThis, { window: svgWindow, document: svgWindow.document });
	if (typeof globalThis.CSSStyleSheet === "undefined") {
		globalThis.CSSStyleSheet = class {
			constructor() { this.cssRules = []; }
			insertRule(rule, index = 0) { this.cssRules.splice(index, 0, rule); return index; }
		};
	}
	mermaidReady = true;
}

/** Render with the local engine (mermaid + svgdom). Theme is applied per render. */
async function renderLocal(code, dark) {
	ensureMermaidReady();
	mermaid.initialize({ htmlLabels: false, flowchart: { htmlLabels: false }, startOnLoad: false, securityLevel: "loose", ...(dark ? { theme: "dark" } : { theme: "default" }) });
	const { svg } = await mermaid.render("local-render", code);
	return svg;
}

/** Default render server when no override is configured. */
export const DEFAULT_MERMAID_INK_URL = "https://mermaid.ink";

/** Plugin version shown on the settings card. */
export const PLUGIN_VERSION = typeof pkg.version === "string" ? pkg.version : "unknown";

/** Built-in local renderer route. */
export const LOCAL_RENDER_PATH = "/dsh-mermaid-image-preview";

/**
 * Host-side plugin config schema (the `config:` block of the cordis patch
 * row). Declared so the Loader validates and normalizes the row config before
 * `apply` runs; every field carries a default, so an empty or missing config
 * is valid.
 */
export const Config = z.object({
	enableLocalRender: z.boolean().default(true),
	fallbackRenderUrl: z.string().default(DEFAULT_MERMAID_INK_URL),
	enableFallback: z.boolean().default(false),
});

/**
 * Resolve the external fallback render server URL. Defaults to mermaid.ink.
 * Used when `enableFallback` is true and the local renderer cannot handle a
 * diagram type, or when `enableLocalRender` is false.
 */
function resolveFallbackRenderUrl(config) {
	const fromConfig = config && typeof config.fallbackRenderUrl === "string" ? config.fallbackRenderUrl.trim() : "";
	return fromConfig !== "" ? fromConfig : DEFAULT_MERMAID_INK_URL;
}

/** Resolve whether the local renderer is enabled (default true). */
function resolveEnableLocalRender(config) {
	return config && typeof config.enableLocalRender === "boolean" ? config.enableLocalRender : true;
}

/** Resolve whether the external fallback flow is enabled (default false). */
function resolveEnableFallback(config) {
	return config && typeof config.enableFallback === "boolean" ? config.enableFallback : false;
}

/**
 * Boot globals as structured index-injection rows. Both surfaces consume the
 * same table: the Web server renders rows into the served index.html, and the
 * desktop shell ships the collected rows to its renderer, which applies them
 * before the application boot resolves. `tapIndex` raw-HTML transforms are
 * NOT replayed on the desktop shell, so rows are the only portable channel.
 * @param enableLocalRender - Whether the local renderer is enabled.
 * @param fallbackRenderUrl - Resolved external fallback URL.
 * @param enableFallback - Whether the external fallback flow is enabled.
 * @param version - Plugin version string.
 * @returns injection rows for `webserver/index-inject`.
 */
function bootGlobalRows(enableLocalRender, fallbackRenderUrl, enableFallback, version) {
	return [
		{ kind: "global", name: "__MERMAID_ENABLE_LOCAL_RENDER__", value: enableLocalRender },
		{ kind: "global", name: "__MERMAID_FALLBACK_RENDER_URL__", value: fallbackRenderUrl },
		{ kind: "global", name: "__MERMAID_ENABLE_FALLBACK__", value: enableFallback },
		{ kind: "global", name: "__MERMAID_IMAGE_PREVIEW_VERSION__", value: version },
	];
}

/** Decode a URL-safe base64 string to UTF-8 text. */
function decodeBase64Url(input) {
	const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
	const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
	const bytes = Buffer.from(padded, "base64");
	return bytes.toString("utf8");
}

/**
 * Turn a render exception into a message the browser half can show verbatim:
 * syntax problems belong to the diagram code, engine limits belong to this
 * Node renderer (svgdom has no canvas and no browser layout), and the latter
 * are worth pointing at the external fallback server.
 * @param error - the render exception.
 * @param code - the diagram source, used to name its type.
 * @returns the user-facing failure text.
 */
function describeRenderFailure(error, code) {
	const message = String((error && error.message) || error);
	const typeMatch = /^\s*([A-Za-z][A-Za-z0-9-]*)/.exec(code);
	const type = typeMatch === null ? "diagram" : typeMatch[1];
	const isSyntax = /Parse error|UnknownDiagramError|No diagram type detected|not a valid diagram/i.test(message);
	if (isSyntax) return `Mermaid syntax error in "${type}": ${message}`;
	return `Local renderer cannot render "${type}": ${message}. Diagram types that need canvas or browser layout (mindmap, gantt, ...) require an external render server - set \`enableFallback: true\` or \`enableLocalRender: false\` in the profile patch.`;
}

/**
 * Serve the built-in local mermaid renderer:
 * GET /dsh-mermaid-image-preview/svg/<urlsafe-base64>[?theme=dark] -> SVG
 * @param req - Node IncomingMessage.
 * @param res - Node ServerResponse.
 */
async function renderRouteHandler(req, res) {
	const url = new URL(req.url, "http://localhost");
	const match = /^\/dsh-mermaid-image-preview\/svg\/([A-Za-z0-9_-]+)$/.exec(url.pathname);
	if (match === null) {
		res.statusCode = 404;
		res.setHeader("Content-Type", "text/plain; charset=utf-8");
		res.end("Not found. Use /dsh-mermaid-image-preview/svg/<urlsafe-base64>[?theme=dark]");
		return;
	}
	let code;
	try {
		code = decodeBase64Url(match[1]);
	} catch (e) {
		res.statusCode = 400;
		res.setHeader("Content-Type", "text/plain; charset=utf-8");
		res.end("Invalid base64");
		return;
	}
	if (code.trim() === "") {
		res.statusCode = 400;
		res.setHeader("Content-Type", "text/plain; charset=utf-8");
		res.end("Empty diagram");
		return;
	}
	const dark = url.searchParams.get("theme") === "dark";
	try {
		const svg = await renderLocal(code, dark);
		res.statusCode = 200;
		res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
		res.setHeader("Cache-Control", "no-store");
		res.end(svg);
	} catch (e) {
		res.statusCode = 400;
		res.setHeader("Content-Type", "text/plain; charset=utf-8");
		res.end(describeRenderFailure(e, code));
	}
}

/**
 * Inject the boot globals and register the local render route when the
 * optional Host HTTP service is composed. The local route is registered only
 * when local rendering is enabled - with `enableLocalRender: false` the
 * browser skips it entirely, so no route is mounted.
 * @param ctx - Host context that may acquire the webServer service.
 * @param config - validated row config (enableLocalRender / fallbackRenderUrl / enableFallback).
 */
export function apply(ctx, config) {
	const enableLocalRender = resolveEnableLocalRender(config);
	const rows = bootGlobalRows(enableLocalRender, resolveFallbackRenderUrl(config), resolveEnableFallback(config), PLUGIN_VERSION);
	ctx.inject(["webServer"], (httpCtx) => {
		httpCtx.effect(() => httpCtx.on("webserver/index-inject", (table) => {
			table.push(...rows);
		}), "@baconbao/dsh-mermaid-image-preview: boot globals");
		if (enableLocalRender) {
			httpCtx.effect(() => httpCtx.webServer.register({
				kind: "prefix",
				path: LOCAL_RENDER_PATH,
				handler: renderRouteHandler,
			}), "@baconbao/dsh-mermaid-image-preview: local render route");
		}
	});
}
