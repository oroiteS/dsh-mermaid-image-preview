# dsh-mermaid-image-preview

[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)
[![DSH Plugin Profile Badge](https://img.shields.io/badge/DSH-Web%20profile-5B4CF0?style=flat-square)](https://github.com/deepseek-ai/deepseek-harness)
[![Release Badge](https://img.shields.io/github/v/release/baconbao/dsh-mermaid-image-preview)](https://github.com/baconbao/dsh-mermaid-image-preview/releases)
[![License Badge](https://img.shields.io/github/license/baconbao/dsh-mermaid-image-preview)](./LICENSE)

A DeepSeek Harness Plugin for Previewing Mermaid Diagram Images

Preview mermaid syntax as images via local rendering in DSH Desktop and DSH Web when the chat message contains a mermaid fenced code block (` ```mermaid or ```mmd ` ).

![dsh-mermaid-image-preview](https://raw.githubusercontent.com/baconbao/dsh-mermaid-image-preview/928d6f4cc1486295924925683d873a7beba38cad/docs/img/dsh-mermaid-image-preview.png)

## Features and how it works

- **Preview mermaid diagrams by rendering images directly!**
- **Local renderer first!** If it fails, it can fall back to an external or self-hosted rendering engine by configuring a fallback server.
- Setting card: you can adjust runtime settings in the UI - no restart needed.
- Mount point: `conversation.chat.turnTail` (list slot, additive - never
  shadows shipped UI).
- Thumbnail display: the diagram renders as a thumbnail; click to enlarge in place, click again to shrink back (same element toggles, no popup).
- Light/dark themes follow the UI automatically.

## Support diagram types

The plugin renders diagrams locally with a built-in renderer. It supports
14 diagram types out of the box.

**Rendered locally:** flowchart, sequenceDiagram, classDiagram, stateDiagram, erDiagram, pie, journey, gitGraph, requirementDiagram, timeline, quadrantChart, packet-beta, xychart-beta

**Expand:** gantt, mindmap, block-beta, sankey-beta, architecture-beta, zenuml, C4Context

> [!NOTE]
> You can enable the fallback to render expanded types — see **Configuration** below.

### Reading a failure

A diagram that cannot render shows the exact reason under the code block, so
the two failure classes are easy to tell apart:

- `Mermaid syntax error in "<type>": Parse error ...` — the diagram code is
  invalid. This fails the same way in every mermaid renderer (VS Code, GitHub,
  mermaid.ink).
- `Local renderer cannot render "<type>": ...` — the code is fine but the
  built-in Node renderer lacks what this type needs (canvas / browser layout).
  Enable the external fallback server — see **Configuration** below.

> [!TIP]
> In a `mindmap`, a node named exactly `mindmap` is parsed as the diagram-type
> keyword and fails with `got 'MINDMAP'`. Write it as `("mindmap")` or
> `[mindmap]`, or rename the node.

## Compatibility

| Plugin | DSH runtime | Notes |
| --- | --- | --- |
| `>= 0.4.0` | `>= 0.2.0-rc.2` | DSH Desktop and DSH Web; `conversation.chat.turnTail` list slot, `webserver/index-inject` boot rows, Settings > Plugins tab |
| `0.3.x` | `0.1.0-rc.x` | DSH Web only; the 0.1.x plugin APIs it targets were removed in 0.2.x |

> [!IMPORTANT]
> DSH refuses to install a plugin whose `@deepseek-ai/dsh-*` peer ranges do not
> cover the running runtime (`incompatible-version`). Use plugin `>= 0.4.0` on
> DSH 0.2.x.

## Installation

`--profile` names the profile to install into: `desktop` for the DSH Desktop
app, `web` for the DSH Web GUI.

### Installation from `github`

```bash
### latest release version
$ dsh plugin --profile desktop add github:baconbao/dsh-mermaid-image-preview#latest

### specific version
$ dsh plugin --profile desktop add github:baconbao/dsh-mermaid-image-preview#<VERSION_TAG|GIT_TAG>

### dev version
$ dsh plugin --profile desktop add github:baconbao/dsh-mermaid-image-preview#dev
```

### Installation from source code

```bash
$ git clone https://github.com/baconbao/dsh-mermaid-image-preview
$ cd dsh-mermaid-image-preview
$ pnpm install
$ dsh plugin --profile desktop add .
```

> [!IMPORTANT]
> Restart dsh after installing.

## Configuration

### Change runtime settings on setting card

![dsh-mermaid-image-preview_setting-card](https://raw.githubusercontent.com/baconbao/dsh-mermaid-image-preview/928d6f4cc1486295924925683d873a7beba38cad/docs/img/dsh-mermaid-image-preview_setting-card.png)

The **Plugins** settings page (**Settings > Plugins**) shows a
`Mermaid image preview` tab where you can adjust the plugin's runtime settings
directly - no restart needed. Values are stored in localStorage and applied
immediately across all sessions.

### Change render server by profile patch

Diagrams are rendered locally by default. To use your own render server or
enable the external fallback, edit the profile's `cordis.patch.yml` (e.g.
`~/.dsh/profiles/desktop/cordis.patch.yml`):

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
