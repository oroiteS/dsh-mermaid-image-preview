# dsh-mermaid-image-preview

[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)
[![DSH Plugin Profile Badge](https://img.shields.io/badge/DSH-Web%20profile-5B4CF0?style=flat-square)](https://github.com/deepseek-ai/deepseek-harness)
[![Release Badge](https://img.shields.io/github/v/release/baconbao/dsh-mermaid-image-preview)](https://github.com/baconbao/dsh-mermaid-image-preview/releases)
[![License Badge](https://img.shields.io/github/license/baconbao/dsh-mermaid-image-preview)](./LICENSE)

A DeepSeek Harness Plugin for Previewing Mermaid Diagram Images

Preview mermaid syntax as images via local rendering in DSH Desktop and DSH Web when the chat message contains a mermaid fenced code block (` ```mermaid ` or ` ```mmd `).

![dsh-mermaid-image-preview](https://raw.githubusercontent.com/baconbao/dsh-mermaid-image-preview/928d6f4cc1486295924925683d873a7beba38cad/docs/img/dsh-mermaid-image-preview.png)

## Features and how it works

- **Preview mermaid diagrams by rendering images directly!**
- **Local renderer first!** If it fails, it can fall back to an external or self-hosted rendering engine by configuring a fallback server.
- Setting card: adjust runtime settings in the UI — no restart needed.
- Mount point: `conversation.chat.turnTail` (list slot, additive — never shadows shipped UI).
- Thumbnail display: the diagram renders as a thumbnail; click to enlarge in place, click again to shrink back (same element toggles, no popup).
- Light/dark themes follow the UI automatically.

Under the hood the plugin is split in two halves:

- **Browser half** (`lib/client.js`): discovered through the package.json `dsh.client` declaration, injected into the web client by `dsh-client-modules`, and rendered inside the `conversation.chat.turnTail` slot.
- **Host half** (`lib/index.js`): a pure UI registration entry so the plugin appears in the Loader and in **Settings > Plugins**; it also ships the profile-patch mount row (`cordis.patch.yml`).

## Supported diagram types

The plugin renders diagrams locally with a built-in renderer (bundled mermaid). The following render locally out of the box:

**Rendered locally:** flowchart, sequenceDiagram, classDiagram, stateDiagram, erDiagram, pie, journey, gitGraph, requirementDiagram, timeline, quadrantChart, packet-beta, xychart-beta

**Expand (via fallback server):** gantt, mindmap, block-beta, sankey-beta, architecture-beta, zenuml, C4Context

> [!NOTE]
> You can enable the fallback to render expanded types — see **Configuration** below.

### Reading a failure

A diagram that cannot render shows the exact reason under the code block, so the two failure classes are easy to tell apart:

- `Mermaid syntax error in "<type>": Parse error ...` — the diagram code is invalid. This fails the same way in every mermaid renderer (VS Code, GitHub, mermaid.ink).
- `Local renderer cannot render "<type>": ...` — the code is fine but the built-in Node renderer lacks what this type needs (canvas / browser layout). Enable the external fallback server — see **Configuration** below.

> [!TIP]
> In a `mindmap`, a node named exactly `mindmap` is parsed as the diagram-type keyword and fails with `got 'MINDMAP'`. Write it as `("mindmap")` or `[mindmap]`, or rename the node.

## Compatibility

| Plugin | DSH runtime | Notes |
| --- | --- | --- |
| `>= 0.4.0` | `>= 0.2.0-rc.2` | DSH Desktop and DSH Web; `conversation.chat.turnTail` list slot, `webserver/index-inject` boot rows, Settings > Plugins tab |
| `0.3.x` | `0.1.0-rc.x` | DSH Web only; the 0.1.x plugin APIs it targets were removed in 0.2.x |

> [!IMPORTANT]
> DSH refuses to install a plugin whose `@deepseek-ai/dsh-*` peer ranges do not cover the running runtime (`incompatible-version`). Use plugin `>= 0.4.0` on DSH 0.2.x.

## Installation

`--profile` names the profile to install into: `desktop` for the DSH Desktop app, `web` for the DSH Web GUI. Profile files live under `~/.dsh/profiles/<profile>/` (`package.json`, `cordis.patch.yml`, `node_modules/`).

### Install from GitHub (recommended)

```bash
### latest release version
$ dsh plugin --profile desktop add github:baconbao/dsh-mermaid-image-preview#latest

### specific version
$ dsh plugin --profile desktop add github:baconbao/dsh-mermaid-image-preview#<VERSION_TAG|GIT_TAG>

### dev version
$ dsh plugin --profile desktop add github:baconbao/dsh-mermaid-image-preview#dev
```

### Install from local source

```bash
$ git clone https://github.com/baconbao/dsh-mermaid-image-preview
$ cd dsh-mermaid-image-preview
$ pnpm install
$ dsh plugin --profile desktop add .
```

`dsh plugin add` wires the dependency into the profile's `package.json` for you. If you prefer to wire it by hand, add the package to **both** `dsh.profile.bundles` and `dependencies`, then run `pnpm install` inside `~/.dsh/profiles/<profile>/`. There are two protocols to choose from:

- **`file:` — self-contained copy (recommended for daily use).**
  `"@baconbao/dsh-mermaid-image-preview": "file:/path/to/dsh-mermaid-image-preview"`
  pnpm packs the directory and installs a real copy into the profile's `node_modules`, together with the plugin's runtime dependencies (`mermaid`, `jsdom`, `dompurify`, ...). The profile is self-contained afterwards: the source directory can be moved or deleted without breaking the runtime. After changing the source, re-run `pnpm install` in the profile directory to refresh the copy.

- **`link:` — live dev symlink.**
  `"@baconbao/dsh-mermaid-image-preview": "link:/path/to/dsh-mermaid-image-preview"`
  pnpm only creates a symlink — no copy. Source edits take effect on reload without reinstalling, which makes this the right choice while developing the plugin. The trade-off: **a profile install does not install a linked package's own dependencies**, so the project itself must keep a working `node_modules` (run `pnpm install` inside the project after every clone). If that directory is missing or deleted, dsh reports `cannot resolve profile bundle` at startup — see **Troubleshooting**.

> [!IMPORTANT]
> Restart dsh after installing, or after switching a dependency between `file:` and `link:`.

## Troubleshooting

### `cannot resolve profile bundle "@baconbao/dsh-mermaid-image-preview"`

The Loader found the bundle name in the profile but could not load its entry. Work through this list:

1. **Linked (`link:`) install with missing dependencies** — the most common case. Node resolves the plugin's imports (`@deepseek-ai/schemastery`, `mermaid`, `jsdom`, `dompurify`, `svgdom`) from the *real* path of the linked project, not from the profile's `node_modules`. Run `pnpm install` **inside the plugin project directory**. Re-cloning the repo silently wipes `node_modules/` (it is git-ignored), which reproduces this error.
2. **The referenced path is gone** — a `file:`/`link:` target that was moved or deleted leaves a dangling reference in `~/.dsh/profiles/<profile>/package.json`. Restore the directory at the referenced path, or update the path (or remove the dependency and the `dsh.profile.bundles` entry).
3. **Profile dependencies not installed** — run `pnpm install` in `~/.dsh/profiles/<profile>/` (or `dsh plugin --profile <profile> install`).

Then restart dsh.

> [!NOTE]
> The suggested `dsh plugin --profile <profile> install` only installs dependencies **inside the profile**. For a `link:` dependency it does not populate the linked project's own `node_modules` — that is what step 1 is for.

### `incompatible-version`

The plugin's `@deepseek-ai/dsh-*` peer ranges do not cover the running DSH runtime. Pair plugin `>= 0.4.0` with DSH `>= 0.2.0-rc.2` (see **Compatibility**).

### `Local renderer cannot render "<type>"`

The diagram type needs canvas / browser layout that the built-in Node renderer does not provide (gantt, mindmap, sankey, ...). Set `enableFallback: true` in the profile patch — see **Configuration**.

## Configuration

### Change runtime settings on the setting card

![dsh-mermaid-image-preview_setting-card](https://raw.githubusercontent.com/baconbao/dsh-mermaid-image-preview/928d6f4cc1486295924925683d873a7beba38cad/docs/img/dsh-mermaid-image-preview_setting-card.png)

The **Plugins** settings page (**Settings > Plugins**) shows a `Mermaid image preview` tab where you can adjust the plugin's runtime settings directly — no restart needed. Values are stored in localStorage and applied immediately across all sessions.

### Change render server by profile patch

Diagrams are rendered locally by default. To use your own render server or enable the external fallback, edit the profile's `cordis.patch.yml` (e.g. `~/.dsh/profiles/desktop/cordis.patch.yml`):

```yaml
- id: ui-dsh-mermaid-image-preview
  config:
    enableLocalRender: true
    fallbackRenderUrl: https://mermaid.ink
    enableFallback: false
```

- `enableLocalRender`: render locally (default `true`). Set `false` to always use the fallback server (`enableFallback` is ignored).
- `fallbackRenderUrl`: fallback render server (default `https://mermaid.ink`).
- `enableFallback`: use the fallback server when local rendering fails (default `false`).
- Restart dsh after changing these settings.
- To host your own fallback render server, see <https://github.com/jihchi/mermaid.ink> for the details.

## Uninstallation

```bash
$ dsh plugin --profile desktop remove @baconbao/dsh-mermaid-image-preview
```

Or by hand: remove the entry from `dsh.profile.bundles` and the dependency from `package.json`, then run `pnpm install` in the profile directory.

> [!NOTE]
> Since **v0.2.0** the plugin/package id is changed from `dsh-mermaid-image-preview` to `@baconbao/dsh-mermaid-image-preview`.

## Test

Ask the agent to produce:

````
```mermaid
graph TD
  A[Start] --> B{Success?}
  B -->|Yes| C[Done]
  B -->|No| D[Retry]
```
````

---

## Author

baconbao, vibe coding with deepseek ai

## License

[MIT](./LICENSE)
