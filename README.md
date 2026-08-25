<p align="center">
  <img src="https://cdn.jsdelivr.net/npm/skillmds/assets/skillmd-banner.jpg" alt="SkillMD" width="560">
</p>

<h1 align="center">SkillMD</h1>

<p align="center">
  Lint, search, and install <a href="https://docs.claude.com/en/docs/agents-and-tools/agent-skills">Agent Skills</a> — a CLI, an MCP server, and the SKILL.md engine behind <a href="https://skillmd.com">skillmd.com</a>.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/skillmds"><img src="https://img.shields.io/npm/v/skillmds.svg?label=skillmds" alt="skillmds on npm"></a>
  <a href="https://www.npmjs.com/package/@skillmd/core"><img src="https://img.shields.io/npm/v/%40skillmd%2Fcore.svg?label=%40skillmd%2Fcore" alt="@skillmd/core on npm"></a>
  <a href="https://github.com/skillmds/skillmd/actions/workflows/ci.yml"><img src="https://github.com/skillmds/skillmd/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="MIT license"></a>
</p>

---

Agent Skills are Markdown files (`SKILL.md`) that teach AI agents new workflows. SkillMD is **the registry that lints**: every skill is validated, security-scanned, and content-pinned — and this repo is the toolchain that does it, the same engine on your machine and on the registry.

| Package | What it is |
|---|---|
| [`skillmds`](packages/skillmds) | One npm package, two binaries: the **`skillmd` CLI** and the **`skillmds` MCP server** |
| [`@skillmd/core`](packages/core) | The SKILL.md engine: parser, lint rules, security scanner, quality score, SARIF/JSON/GitHub formatters |
| [`skillmds/skillmd/action`](action) | GitHub Action: lint skills in CI, results in GitHub Code Scanning |

## The CLI

```bash
npm i -g skillmds
```

```bash
skillmd lint .                 # validate SKILL.md files — diagnostics + quality score
skillmd scan .                 # what would this skill do? scripts, network, secrets
skillmd search "pdf tools"     # search the registry
skillmd add anthropic/pdf      # install — lints first, never executes scripts
skillmd init my-skill          # scaffold a new skill
skillmd publish ./my-skill     # publish to skillmd.com (blocked on lint errors)
```

`skillmd add` targets **68 agents** automatically — Claude Code, Cursor, Codex, Windsurf, Gemini CLI, GitHub Copilot, Cline, Goose, Zed, and more — writing each skill to every agent detected on your machine, in that agent's own directory convention. Just `skillmd` opens a guided interactive menu.

Full reference: [docs/cli.md](docs/cli.md)

## The MCP server

Give any MCP-capable agent the whole registry — search, inspect, lint, and install skills mid-conversation:

```bash
# Claude Code
claude mcp add skillmd -- npx -y skillmds
```

```jsonc
// Claude Desktop, Cursor, VS Code, … (examples/mcp/ has per-client files)
{ "mcpServers": { "skillmd": { "command": "npx", "args": ["-y", "skillmds"] } } }
```

Or use the **hosted remote server** — zero install, streamable HTTP:

```
https://api.skillmd.com/mcp
```

| Tool | What the agent gets |
|---|---|
| `skillmd_search` | Registry search with categories, ratings, and install snippets |
| `skillmd_get` | Full skill detail: body, provenance, license, security flags |
| `skillmd_install` | Safe install: validated, SHA-256-verified, zip-slip-guarded, **never executes scripts** |
| `skillmd_trending` / `skillmd_recommend` | Leaderboard + similar-skill suggestions |
| `skillmd_list_saved` | Your saved skills (with `SKILLMD_TOKEN`) |
| `skillmd_lint` | Validate any SKILL.md content on the spot |

Full reference: [docs/mcp.md](docs/mcp.md) · registry entry: `com.skillmd/skillmd`

## The engine

```bash
npm i @skillmd/core
```

```ts
import { lint } from "@skillmd/core";

const { ok, score, diagnostics, security } = lint(rawSkillMd, { slug: "my-skill" });
```

Nine lint rules, a line-aware security scanner (`network_calls`, `executes_scripts`, `reads_secrets`, …), a 0–100 quality score, and SARIF/JSON/GitHub-annotation formatters. ESM, typed, no runtime dependency beyond `yaml`, runs in Node/browsers/edge. Rules: [docs/rules.md](docs/rules.md)

## CI for your skills

```yaml
- uses: skillmds/skillmd/action@v1
  with:
    path: .
```

Lints every skill in the repo and uploads SARIF to GitHub Code Scanning — findings show up right in PRs. Full example: [examples/github-action.yml](examples/github-action.yml)

## The registry API

Everything here is a thin client over the public API at `api.skillmd.com` — usable directly (`GET /v1/search?q=…`), described by [docs/registry-api.md](docs/registry-api.md), `https://skillmd.com/openapi.json`, and `https://skillmd.com/llms.txt`.

## Security model

Installing a skill **writes files and does nothing else**: no script execution, strict path containment (slug validation + zip-slip guards), SHA-256 integrity verification against the registry's content-addressed store, and companion downloads pinned to GitHub raw hosts. Details in [SECURITY.md](SECURITY.md) — vulnerability reports to **hi@skillmd.com**.

## Development

```bash
npm ci
npm run build      # @skillmd/core, then skillmds
npm test           # vitest across both packages (19 test files, incl. an MCP stdio smoke test)
npm run typecheck  # strict tsc
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for layout, PR guidelines, and the release process.

## License

[MIT](LICENSE) © SkillMD
