// dsh-mermaid-image-preview - browser half.
// Renders mermaid fenced blocks (```mermaid / ```mmd) inside the closing
// assistant message as rendered diagrams, right under the message (turnTail
// slot). Diagrams are rendered by the built-in local renderer first; when
// that fails and the external fallback is enabled, the SVG is loaded from
// the fallback render server (default mermaid.ink). The diagram URL is built
// here with the browser-native btoa (UTF-8 safe via TextEncoder), following
// the active color scheme (light/dark).
//
// DSH 0.2.x wiring notes:
// - `conversation.chat.turnTail` is a LIST slot (session scope) that requires
//   `options.id`; it is not a chain slot, so there is no `select` hook.
// - The assistant text of the turn is read from the Chat target snapshot
//   through a keyed Hook (`keyedHooks` -> `useTurnDiagrams(turn)`), the same
//   seam ui-plan uses for its turn cards.
// - The settings card registers into the `settings.plugins.tab` list slot of
//   the Settings > Plugins section (the rc.7 `settings.plugin.item` slot is
//   gone in 0.2.x).
window.__ModuleLoader__.load({
	id: "@baconbao/dsh-mermaid-image-preview",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let primitives = require("@deepseek-ai/dsh-client-ui-primitives");

		//#region styles
		// One shared <img> toggles between thumbnail and full size on click:
		// no popup, no portal, the image element never leaves the message.
		// Visual fit: the tail hugs the markdown above (no top margin), the
		// box uses a tight padding so it reads as a continuation.
		const css = ".dsh-mermaid-tail{flex-direction:column;gap:4px;margin:0 0 2px;display:flex}.dsh-mermaid-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;list-style:none;transition:border-color .16s,background .16s}.dsh-mermaid-card:hover{border-color:var(--dsw-alias-label-dimmed)}.dsh-mermaid-card-open{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}.dsh-mermaid-card-header{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}.dsh-mermaid-card-header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}.dsh-mermaid-card-headtext{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}.dsh-mermaid-card-name{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}.dsh-mermaid-card-desc{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.5}.dsh-mermaid-card-value{width:120px;color:var(--dsw-alias-label-primary);text-align:right;font-size:13px;line-height:1.5}.dsh-mermaid-card-link{width:120px;color:var(--dsw-alias-brand-primary);text-align:right;text-decoration:none;font-size:13px;line-height:1.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsh-mermaid-card-link:hover{text-decoration:underline}.dsh-mermaid-card-chevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}.dsh-mermaid-card-chevron-open{transform:rotate(180deg)}.dsh-mermaid-card-body{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}.dsh-mermaid-card-pending{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;flex:none;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}.dsh-mermaid-card-field{justify-content:space-between;align-items:center;gap:12px;padding:10px 0;display:flex}.dsh-mermaid-card-label{color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.5}.dsh-mermaid-card-field input[type=number]{width:120px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:5px 10px;font-size:13px;line-height:1.5}.dsh-mermaid-card-footer{border-top:1px solid var(--dsw-alias-border-l2);justify-content:flex-end;align-items:center;gap:8px;padding:12px 0 4px;display:flex}.dsh-mermaid-card-discard,.dsh-mermaid-card-save{appearance:none;font:inherit;cursor:pointer;border:1px solid transparent;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5}.dsh-mermaid-card-discard{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:0 0}.dsh-mermaid-card-discard:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}.dsh-mermaid-card-save{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}.dsh-mermaid-card-discard:disabled,.dsh-mermaid-card-save:disabled{opacity:.4;cursor:default}.dsh-mermaid-card-discard:focus-visible,.dsh-mermaid-card-save:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}.dsh-mermaid-box{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:8px;padding:6px 8px;justify-content:center;align-items:flex-start;display:flex}.dsh-mermaid-thumb{max-width:100%;max-height:204px;width:auto;height:auto;display:block;cursor:zoom-in}.dsh-mermaid-full{max-width:100%;width:auto;height:auto;display:block;cursor:zoom-out}.dsh-mermaid-loading{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}.dsh-mermaid-error{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px;margin-bottom:4px;white-space:pre-wrap;overflow-wrap:anywhere}.dsh-mermaid-fallback{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:10px;padding:10px 12px;overflow-x:auto}.dsh-mermaid-fallback pre{margin:0;white-space:pre-wrap;word-break:break-word;font:13px/20px var(--ds-font-family-code);color:var(--dsw-alias-label-primary)}";
		const tagId = "@baconbao/dsh-mermaid-image-preview/tail.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@baconbao/dsh-mermaid-image-preview";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		//#endregion

		// Collect mermaid fenced code blocks (```mermaid or ```mmd) from markdown text.
		function extractMermaid(text, out) {
			const re = /```(?:mermaid|mmd)\s*\n([\s\S]*?)```/g;
			let m;
			while ((m = re.exec(text)) !== null) {
				const code = m[1].trim();
				if (code) out.push(code);
			}
		}

		// Any mermaid render server: default mermaid.ink, overridable through
		// the Host-injected boot global `window.__MERMAID_FALLBACK_RENDER_URL__` (set by
		// the node half from profile patch config). The code is appended as
		// /svg/<urlsafe-base64>[?theme=dark].
		function diagramUrl(baseUrl, code, theme) {
			const bytes = new TextEncoder().encode(code);
			let binary = "";
			for (const b of bytes) binary += String.fromCharCode(b);
			const b64 = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
			return baseUrl.replace(/\/+$/, "") + "/svg/" + b64 + (theme === "dark" ? "?theme=dark" : "");
		}

		// The render route answers a failure with the real reason in the body,
		// but an <img> error event carries none of it - read the message back
		// so "syntax error in your code" and "this type needs the fallback
		// server" never collapse into one useless "image failed to load".
		async function readFailureReason(url, generic) {
			try {
				const res = await fetch(url, { cache: "no-store" });
				const text = ((await res.text()) || "").trim();
				if (!res.ok && text !== "") return text.slice(0, 600);
			} catch (e) {
				// offline or blocked - keep the generic message
			}
			return generic;
		}

		// Built-in local renderer URL. Always the built-in route resolved
		// against the CURRENT page origin, so it points at the webserver the
		// user is connected to (host/port may vary). On the desktop shell the
		// origin is the application protocol, whose non-static paths are
		// forwarded to the owned Host - the same path works on both surfaces.
		function readLocalRenderUrl() {
			if (typeof window !== "undefined" && typeof window.location !== "undefined") {
				return window.location.origin + "/dsh-mermaid-image-preview";
			}
			return "/dsh-mermaid-image-preview";
		}

		// Whether the local renderer is enabled (default true). When false,
		// the local renderer is skipped entirely and fallbackRenderUrl is used.
		function readEnableLocalRender() {
			const value = typeof window !== "undefined" ? window.__MERMAID_ENABLE_LOCAL_RENDER__ : void 0;
			return value !== false;
		}

		// External fallback render server URL. Defaults to mermaid.ink.
		// Used when enableFallback is true and the local renderer cannot
		// render a diagram type, or when enableLocalRender is false.
		function readFallbackRenderUrl() {
			const base = typeof window !== "undefined" ? window.__MERMAID_FALLBACK_RENDER_URL__ : void 0;
			return typeof base === "string" && base.trim() !== "" ? base.trim() : "https://mermaid.ink";
		}

		// Whether the external fallback flow is enabled (default false).
		function readEnableFallback() {
			const value = typeof window !== "undefined" ? window.__MERMAID_ENABLE_FALLBACK__ : void 0;
			return value === true;
		}

		// Read the plugin version from the Host-injected boot global.
		function readPluginVersion() {
			const value = typeof window !== "undefined" ? window.__MERMAID_IMAGE_PREVIEW_VERSION__ : void 0;
			return typeof value === "string" && value.trim() !== "" ? value : "";
		}

		//  plugin settings (thumbnail height + on/off) --------------------
		// Stored in one localStorage object so the settings-page card and the
		// chat renderer share the same source, survive reloads/restarts, and
		// stay in sync through a module-level subscription store.

		/** localStorage key holding the whole settings object. */
		const SETTINGS_KEY = "dsh-mermaid-image-preview.settings";

		/** Defaults applied when nothing is stored. */
		const SETTINGS_DEFAULTS = {
			thumbMaxHeight: 204,
			enabled: true,
		};

		/** Current settings (module-level store). */
		let settings = readPersistedSettings();

		/** Listeners notified on every settings change (module-level). */
		const settingsListeners = new Set();

		/** Read the persisted settings object, merging defaults when unset. */
		function readPersistedSettings() {
			try {
				const stored = typeof localStorage !== "undefined" ? localStorage.getItem(SETTINGS_KEY) : null;
				if (stored !== null) {
					const parsed = JSON.parse(stored);
					return {
						thumbMaxHeight: typeof parsed.thumbMaxHeight === "number" && Number.isFinite(parsed.thumbMaxHeight) && parsed.thumbMaxHeight > 0
							? parsed.thumbMaxHeight
							: SETTINGS_DEFAULTS.thumbMaxHeight,
						enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : SETTINGS_DEFAULTS.enabled,
					};
				}
			} catch (e) {
				// storage unavailable or malformed - fall through to defaults
			}
			return { ...SETTINGS_DEFAULTS };
		}

		/** Persist the current settings object to localStorage. */
		function persistSettings() {
			try {
				if (typeof localStorage !== "undefined") localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
			} catch (e) {
				// storage unavailable - settings are session-only
			}
		}

		/** @returns the current settings object. */
		function getSettings() {
			return settings;
		}

		/** Subscribe to settings changes; returns a disposer. */
		function subscribeSettings(listener) {
			settingsListeners.add(listener);
			return () => settingsListeners.delete(listener);
		}

		/** Apply a partial update, persist, and notify all subscribers. */
		function updateSettings(patch) {
			settings = { ...settings, ...patch };
			persistSettings();
			for (const listener of settingsListeners) listener();
		}

		/** React hook: current settings, re-rendered on any change. */
		function useSettings() {
			const [value, setValue] = react.useState(getSettings);
			react.useEffect(() => subscribeSettings(() => setValue(getSettings())), []);
			return value;
		}

		// Follow the active color scheme so the render server can pick a matching theme.
		function useColorScheme(props) {
			const [scheme, setScheme] = react.useState(
				props.theme && typeof props.theme.getTheme === "function" ? props.theme.getTheme()?.active?.colorScheme ?? "light" : "light",
			);
			react.useEffect(() => {
				if (typeof props.onThemeChange !== "function") return;
				const off = props.onThemeChange((snapshot) => {
					if (snapshot && snapshot.active) setScheme(snapshot.active.colorScheme);
				});
				return off;
			}, []);
			return scheme;
		}

		//  turn assistant text -> mermaid code ---------------------------
		// The turnTail slot hands the component the turn Location and a keyed
		// Hook backed by the Chat target snapshot (one source per turn, kind
		// "assistant-step"). Snapshot entries are assistant-step payloads:
		// `{ step, blocks, status, ... }` with text blocks shaped
		// `{ kind: "text", text }`. The empty source keeps the Hook call shape
		// stable while the Chat target is still coming up.

		/** Stable empty snapshot source (never publishes). */
		const EMPTY_STEPS = Object.freeze([]);
		const EMPTY_SOURCE = {
			getSnapshot: () => EMPTY_STEPS,
			subscribe: () => () => {},
		};

		/**
		 * Collect mermaid code from the assistant text blocks of one turn,
		 * deduplicated in document order.
		 * @param steps - assistant-step payloads of the turn.
		 * @returns mermaid code strings.
		 */
		function diagramsFromSteps(steps) {
			const out = [];
			const seen = new Set();
			for (const step of steps || []) {
				const blocks = step && step.blocks;
				if (!Array.isArray(blocks)) continue;
				for (const block of blocks) {
					if (!block || block.kind !== "text" || typeof block.text !== "string") continue;
					const found = [];
					extractMermaid(block.text, found);
					for (const code of found) {
						if (seen.has(code)) continue;
						seen.add(code);
						out.push(code);
					}
				}
			}
			return out;
		}

		function MermaidDiagram({ code, scheme, localRenderUrl, enableLocalRender, fallbackRenderUrl, enableFallback, thumbMaxHeight }) {
			const [state, setState] = react.useState({ status: "loading" });
			const [zoomed, setZoomed] = react.useState(false);
			react.useEffect(() => {
				let alive = true;
				setState({ status: "loading" });
				const localUrl = diagramUrl(localRenderUrl, code, scheme);
				const fallbackUrl = diagramUrl(fallbackRenderUrl, code, scheme);
				const failWith = (url) => {
					readFailureReason(url, "image failed to load").then((message) => {
						if (alive) setState({ status: "error", message });
					});
				};
				// When the local renderer is disabled, skip it entirely and go
				// straight to the fallback server.
				if (!enableLocalRender) {
					const retry = new Image();
					retry.onload = () => { if (alive) setState({ status: "ready", url: fallbackUrl }); };
					retry.onerror = () => failWith(fallbackUrl);
					retry.src = fallbackUrl;
					return () => { alive = false; };
				}
				const probe = new Image();
				probe.onload = () => { if (alive) setState({ status: "ready", url: localUrl }); };
				probe.onerror = () => {
					// External fallback only when enabled; otherwise report why.
					if (!enableFallback) {
						failWith(localUrl);
						return;
					}
					const retry = new Image();
					retry.onload = () => { if (alive) setState({ status: "ready", url: fallbackUrl }); };
					retry.onerror = () => failWith(fallbackUrl);
					retry.src = fallbackUrl;
				};
				probe.src = localUrl;
				return () => { alive = false; };
			}, [code, scheme, localRenderUrl, enableLocalRender, fallbackRenderUrl, enableFallback]);

			if (state.status === "loading") {
				return react.createElement("div", { className: "dsh-mermaid-loading" }, "Rendering diagram...");
			}
			if (state.status === "error") {
				return react.createElement("div", { className: "dsh-mermaid-fallback" },
					react.createElement("div", { className: "dsh-mermaid-error" }, "Diagram failed: " + state.message),
					react.createElement("pre", null, code),
				);
			}
			// One shared <img> toggles between thumbnail and full size on
			// click - the element never leaves the message, so the thumbnail
			// never disappears and the full image is already loaded.
			// Inline style overrides the CSS max-height with the configured
			// thumbnail height (inline wins; the full-size state sets none).
			const imgStyle = zoomed ? void 0 : { maxHeight: thumbMaxHeight + "px" };
			return react.createElement("div", { className: "dsh-mermaid-box" },
				react.createElement("img", {
					className: zoomed ? "dsh-mermaid-full" : "dsh-mermaid-thumb",
					style: imgStyle,
					src: state.url,
					alt: "mermaid diagram",
					title: zoomed ? "Click to shrink" : "Click to enlarge",
					onClick: () => setZoomed(!zoomed),
				}),
			);
		}

		function MermaidTurnTail(props) {
			// Hooks must run unconditionally at the top of the component.
			const turn = props.turn;
			const turnKey = turn && turn.turn !== void 0 ? String(turn.turn) : void 0;
			const useTurnDiagrams = props.useTurnDiagrams;
			const steps = typeof useTurnDiagrams === "function" ? useTurnDiagrams(turnKey) : EMPTY_STEPS;
			const scheme = useColorScheme(props);
			const localRenderUrl = readLocalRenderUrl();
			const enableLocalRender = readEnableLocalRender();
			const fallbackRenderUrl = readFallbackRenderUrl();
			const enableFallback = readEnableFallback();
			const { thumbMaxHeight, enabled } = useSettings();
			const diagrams = diagramsFromSteps(steps);
			if (!diagrams.length) return null;
			// When disabled via the settings page, render nothing here.
			if (!enabled) return null;
			return react.createElement("div", { className: "dsh-mermaid-tail" },
				diagrams.map((code, i) => react.createElement(MermaidDiagram, { key: i, code, scheme, localRenderUrl, enableLocalRender, fallbackRenderUrl, enableFallback, thumbMaxHeight })),
			);
		}

		// Settings-page card: an expandable card matching the shipped plugin
		// cards (header row + chevron, body with fields + Save/Discard). Both
		// fields live in the same localStorage-backed settings store the chat
		// renderer reads, so saving applies immediately everywhere.
		function MermaidSettingsCard() {
			const { thumbMaxHeight, enabled } = useSettings();
			const [open, setOpen] = react.useState(false);
			const [draft, setDraft] = react.useState(String(thumbMaxHeight));
			const [draftEnabled, setDraftEnabled] = react.useState(enabled);
			// Keep drafts in sync when the store changes elsewhere.
			react.useEffect(() => { setDraft(String(thumbMaxHeight)); setDraftEnabled(enabled); }, [thumbMaxHeight, enabled]);
			const dirty = draft !== String(thumbMaxHeight) || draftEnabled !== enabled;
			const save = () => {
				const value = Number(draft);
				if (Number.isFinite(value) && value > 0) {
					updateSettings({ thumbMaxHeight: Math.round(value), enabled: draftEnabled });
				}
			};
			const discard = () => {
				setDraft(String(thumbMaxHeight));
				setDraftEnabled(enabled);
			};
			return react.createElement("div", { className: "dsh-mermaid-card" + (open ? " dsh-mermaid-card-open" : "") },
				react.createElement("button", {
					type: "button",
					className: "dsh-mermaid-card-header",
					"aria-expanded": open,
					onClick: () => setOpen(!open),
				},
					react.createElement("span", { className: "dsh-mermaid-card-headtext" },
						react.createElement("span", { className: "dsh-mermaid-card-name" }, "Mermaid image preview"),
						react.createElement("span", { className: "dsh-mermaid-card-desc" }, "The `dsh-mermaid-image-preview` plugin settings."),
					),
					dirty ? react.createElement("span", { className: "dsh-mermaid-card-pending" }, "Unsaved changes") : null,
					react.createElement(primitives.IconChevronDownOutlineRegular, { className: "dsh-mermaid-card-chevron" + (open ? " dsh-mermaid-card-chevron-open" : "") }),
				),
				open ? react.createElement("div", { className: "dsh-mermaid-card-body" },
					react.createElement("div", { className: "dsh-mermaid-card-field" },
						react.createElement("span", { className: "dsh-mermaid-card-label" }, "Version"),
						react.createElement("span", { className: "dsh-mermaid-card-value" }, "v" + readPluginVersion()),
					),
					react.createElement("label", { className: "dsh-mermaid-card-field" },
						react.createElement("span", { className: "dsh-mermaid-card-label" }, "Enabled"),
						react.createElement("input", {
							type: "checkbox",
							checked: draftEnabled,
							onChange: (e) => setDraftEnabled(e.target.checked),
						}),
					),
					react.createElement("label", { className: "dsh-mermaid-card-field" },
						react.createElement("span", { className: "dsh-mermaid-card-label" }, "Thumbnail max height (px)"),
						react.createElement("input", {
							type: "number",
							min: 1,
							value: draft,
							onChange: (e) => setDraft(e.target.value),
						}),
					),
					react.createElement("div", { className: "dsh-mermaid-card-field" },
						react.createElement("span", { className: "dsh-mermaid-card-label" }, "Source"),
						react.createElement("a", {
							className: "dsh-mermaid-card-link",
							href: "https://github.com/baconbao/dsh-mermaid-image-preview",
							target: "_blank",
							rel: "noreferrer",
						}, "View on GitHub"),
					),
					react.createElement("div", { className: "dsh-mermaid-card-footer" },
						react.createElement("button", {
							type: "button",
							className: "dsh-mermaid-card-discard",
							disabled: !dirty,
							onClick: discard,
						}, "Discard"),
						react.createElement("button", {
							type: "button",
							className: "dsh-mermaid-card-save",
							disabled: !dirty,
							onClick: save,
						}, "Save"),
					),
				) : null,
			);
		}

		// Required services: the slot registry plus the Session/Conversation
		// object layers the keyed Diagrams Hook reads through. The theme seat
		// is read defensively at inject time (it is provided by ui-theme).
		const inject = ["slots", "sessions", "uiConversation"];

		function apply(ctx) {
			// Theme seat: a minimal handle plus a theme-change subscription
			// disposer, read defensively so a composition without ui-theme
			// still renders diagrams (falling back to the light scheme).
			const themeSeat = () => {
				let theme;
				try {
					theme = ctx.get("theme");
				} catch (e) {
					theme = void 0;
				}
				return {
					theme,
					onThemeChange: theme ? (listener) => ctx.on("theme/change", listener) : void 0,
				};
			};
			// The turnTail seat renders under the closing assistant message of
			// one turn. `inject(sessionId)` runs per Session scope; the keyed
			// Hook resolves that turn's assistant-step source from the Chat
			// target snapshot (the same seam ui-plan uses).
			ctx.slots.inject("conversation.chat.turnTail", () => ctx.slots.register(
				{
					name: "conversation.chat.turnTail",
					id: "@baconbao/dsh-mermaid-image-preview",
					order: 30,
					inject: (sessionId) => {
						let chat;
						try {
							chat = ctx.uiConversation.binding(sessionId).target("chat");
						} catch (e) {
							chat = void 0;
						}
						const resolveSteps = (turnKey) => {
							if (chat === void 0 || turnKey === void 0) return EMPTY_SOURCE;
							try {
								const snapshot = chat.getSnapshot();
								const source = snapshot && snapshot.nodes ? snapshot.nodes.turnDataSource(Number(turnKey), "assistant-step") : void 0;
								return source || EMPTY_SOURCE;
							} catch (e) {
								return EMPTY_SOURCE;
							}
						};
						return {
							...themeSeat(),
							keyedHooks: { turnDiagrams: resolveSteps },
						};
					},
				},
				MermaidTurnTail,
			));
			// Settings-page card: one tab of the Settings > Plugins section
			// (0.2.x list slot; the rc.7 `settings.plugin.item` slot is gone).
			// The card edits the same localStorage-backed store the chat
			// renderer reads, so saving applies immediately everywhere.
			ctx.slots.inject("settings.plugins.tab", () => ctx.slots.register(
				{
					name: "settings.plugins.tab",
					id: "mermaid-image-preview",
					order: 30,
					label: "Mermaid image preview",
				},
				MermaidSettingsCard,
			));
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
