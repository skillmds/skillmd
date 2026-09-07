<p align="center">
  <a href="https://skillmd.com"><img src="https://cdn.jsdelivr.net/npm/skillmds/assets/skillmd-banner.jpg" alt="SkillMD — the open registry of Agent Skills" width="560"></a>
</p>

<h1 align="center">SkillMD</h1>

<p align="center">
  <strong>The registry that lints.</strong><br>
  Search, install, lint and publish <a href="https://skillmd.com/docs/what-is-an-agent-skill">Agent Skills</a> (<code>SKILL.md</code>) for Claude Code, Cursor, Codex and 60+ other agents.<br>
  This repo is the open-source toolchain behind <a href="https://skillmd.com">skillmd.com</a>: the CLI, the MCP server, the GitHub Action and the SKILL.md engine they share.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/skillmds"><img src="https://img.shields.io/npm/v/skillmds.svg?label=skillmds" alt="skillmds on npm"></a>
  <a href="https://www.npmjs.com/package/@skillmds/core"><img src="https://img.shields.io/npm/v/%40skillmds%2Fcore.svg?label=%40skillmds%2Fcore" alt="@skillmds/core on npm"></a>
  <a href="https://www.npmjs.com/package/skillmds"><img src="https://img.shields.io/npm/dm/skillmds.svg" alt="npm downloads"></a>
  <a href="https://github.com/skillmds/skillmd/actions/workflows/ci.yml"><img src="https://github.com/skillmds/skillmd/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="MIT license"></a>
</p>

<p align="center">
  <a href="https://skillmd.com/search">Browse skills</a> ·
  <a href="https://skillmd.com/categories">Categories</a> ·
  <a href="https://skillmd.com/publishers">Publishers</a> ·
  <a href="https://skillmd.com/agents">Install guides</a> ·
  <a href="https://skillmd.com/docs">Docs</a> ·
  <a href="https://skillmd.com/blog">Blog</a> ·
  <a href="https://skillmd.com/stats">Stats</a>
</p>

---

## What this is

An **Agent Skill** is a folder with a `SKILL.md` file: YAML frontmatter (`name`, `description`) plus Markdown instructions an agent loads on demand. Claude Code, Cursor, Codex, Gemini CLI, GitHub Copilot, Windsurf and dozens of other agents read the same format, which is what makes a shared registry worth having. If the format is new to you, start with [What is an Agent Skill?](https://skillmd.com/docs/what-is-an-agent-skill) and [the anatomy of a SKILL.md file](https://skillmd.com/blog/anatomy-of-a-skill-md-file).

**[skillmd.com](https://skillmd.com)** is the open registry of those skills: **25,000+ skills from 470+ publishers**, every one of them linted against the format, security-scanned for what it can do, and pinned to a commit. Verdicts, capability flags and independent scanner results sit on every skill page. Installing writes files and does nothing else.

This repository is everything that runs on your machine or in your CI, MIT-licensed:

| Package | What it is | Install |
|---|---|---|
| [`skillmds`](packages/skillmds) | One npm package, two binaries: the **`skillmd` CLI** and the **`skillmds` MCP server** | `npm i -g skillmds` |
| [`@skillmds/core`](packages/core) | The SKILL.md engine: parser, lint rules, security scanner, quality score, SARIF / JSON / GitHub formatters | `npm i @skillmds/core` |
| [`skillmds/skillmd/action`](action) | GitHub Action: lint every skill in a repo, results in GitHub Code Scanning | `uses: skillmds/skillmd/action@v1` |

The registry applies the same engine, so a skill that passes locally passes on publish.

## Quick start

```bash
# Search the registry and install a skill into every agent on your machine
npx skillmds search "pdf"
npx skillmds add anthropic/pdf

# Lint your own skill before you share it
npx skillmds lint ./my-skill
```

No account needed for any of the above. Skills land in each detected agent's own directory (`.claude/skills/`, `.cursor/skills/`, `.agents/skills/`, …). Per-agent walkthroughs: [Claude Code](https://skillmd.com/agents/claude-code) · [Cursor](https://skillmd.com/agents/cursor) · [Codex](https://skillmd.com/agents/codex) · [Gemini CLI](https://skillmd.com/agents/gemini-cli) · [GitHub Copilot](https://skillmd.com/agents/github-copilot) · [Windsurf](https://skillmd.com/agents/windsurf) · [all agents](https://skillmd.com/agents).

## The CLI: `skillmd`

```bash
npm i -g skillmds
```

| Command | What it does |
|---|---|
| `skillmd lint [path]` | Validate `SKILL.md` files. Diagnostics, a 0–100 quality score, `--fix` for the mechanical ones. |
| `skillmd scan [path]` | What would this skill do? Reports scripts, network calls and secret access. |
| `skillmd rules [id]` | List the lint rules, or explain one. |
| `skillmd init [name]` | Scaffold a new skill from a template. |
| `skillmd search <query>` | Search the registry from the terminal. |
| `skillmd add <source>` | Install from a registry slug, a GitHub repo or a local path. Lints first, never executes scripts. |
| `skillmd list` / `remove` / `update` | Manage installed skills across agents. |
| `skillmd publish [path]` | Publish to skillmd.com. Blocked on lint errors. |

```bash
skillmd lint . --format sarif > skillmd.sarif   # GitHub Code Scanning
skillmd lint . --strict                          # warnings fail too
skillmd add owner/repo -a claude-code -g         # one agent, global scope
skillmd add some/skill --deny executes_scripts   # refuse skills that run code
```

`skillmd add` detects **68 agents** by their config directories: Claude Code, Cursor, Codex, Windsurf, OpenCode, Gemini CLI, Antigravity, Kiro, Warp, GitHub Copilot, Cline, Roo Code, Goose, Trae, Qwen Code, Amp, Zed, Continue, Devin, OpenHands, Replit and more. Agents that share the `.agents/skills` convention are written once. Running plain `skillmd` opens a guided menu.

Full reference: [docs/cli.md](docs/cli.md) · [CLI docs on skillmd.com](https://skillmd.com/docs/cli) · [How one SKILL.md works in every agent](https://skillmd.com/blog/one-skill-md-for-every-agent-compatibility-matrix)

## The MCP server: `skillmds`

Give any MCP-capable agent the whole registry. It can search, inspect, lint and install skills mid-conversation.

```bash
# Claude Code
claude mcp add skillmd -- npx -y skillmds
```

```jsonc
// Claude Desktop, Cursor, VS Code, Windsurf, … (examples/mcp/ has per-client files)
{ "mcpServers": { "skillmd": { "command": "npx", "args": ["-y", "skillmds"] } } }
```

Or use the **hosted remote server**, zero install, streamable HTTP:

```
https://api.skillmd.com/mcp
```

| Tool | What the agent gets |
|---|---|
| `skillmd_search` | Registry search with categories, ratings and install snippets |
| `skillmd_get` | Full skill detail: body, provenance, license, security flags |
| `skillmd_install` | Safe install: validated, SHA-256-verified, zip-slip-guarded, **never executes scripts** |
| `skillmd_trending` / `skillmd_recommend` | Leaderboard and similar-skill suggestions |
| `skillmd_list_saved` | Your saved skills (with `SKILLMD_TOKEN`) |
| `skillmd_lint` | Validate any SKILL.md content on the spot |

Full reference: [docs/mcp.md](docs/mcp.md) · [MCP docs on skillmd.com](https://skillmd.com/docs/mcp) · [Using SkillMD over MCP](https://skillmd.com/blog/using-skillmd-over-mcp) · MCP registry entry: `com.skillmd/skillmd`

## The engine: `@skillmds/core`

```bash
npm i @skillmds/core
```

```ts
import { lint } from "@skillmds/core";

const { ok, score, diagnostics, security } = lint(rawSkillMd, { slug: "my-skill" });
```

Nine lint rules, a line-aware security scanner, a 0–100 quality score and SARIF / JSON / GitHub-annotation formatters. ESM, typed, no runtime dependency beyond `yaml`, runs in Node, browsers and edge runtimes.

The scanner classifies every skill into capability flags you can filter or deny on install:

| Flag | Meaning |
|---|---|
| `docs_only` | Nothing executable found. Pure instructions. |
| `network_calls` | Fetches, curls or otherwise talks to the network. |
| `executes_scripts` | Runs commands or bundled scripts. |
| `reads_secrets` | Touches env vars, tokens or credential files. |
| `untrusted_install` | Fetch-and-execute from a non-standard source. |

Rules and scoring: [docs/rules.md](docs/rules.md) · [Debugging skills: lint, scan, score](https://skillmd.com/blog/debugging-skills-lint-scan-score) · [Common SKILL.md mistakes](https://skillmd.com/blog/common-skill-md-mistakes)

## CI for your skills

```yaml
- uses: skillmds/skillmd/action@v1
  with:
    path: .
```

Lints every skill in the repo and uploads SARIF to GitHub Code Scanning, so findings show up in pull requests. Full example: [examples/github-action.yml](examples/github-action.yml) · [action/README.md](action/README.md)

## Publishing a skill

```bash
skillmd login                   # token from your skillmd.com account
skillmd publish ./my-skill      # blocked on lint errors
skillmd publish ./my-skill --dry-run
```

Published skills get a page at `skillmd.com/skills/<you>/<name>`, a safety verdict, an install command for every agent, and a live README badge:

```markdown
[![SkillMD](https://skillmd.com/badge/<you>/<name>.svg)](https://skillmd.com/skills/<you>/<name>)
```

Guides: [Publishing a skill to the registry](https://skillmd.com/blog/publishing-a-skill-to-the-registry) · [Writing skills that get used](https://skillmd.com/blog/writing-skills-that-get-used) · [What a verified badge means](https://skillmd.com/blog/what-a-verified-badge-means) · [Skill packs](https://skillmd.com/blog/skill-packs-shipping-an-outcome)

## The registry API

Everything here is a thin client over the public API at `api.skillmd.com` (`GET /v1/search?q=…`, `GET /v1/skills/<owner>/<name>`, …). Described by [docs/registry-api.md](docs/registry-api.md), [`skillmd.com/openapi.json`](https://skillmd.com/openapi.json) and, for AI systems, [`skillmd.com/llms.txt`](https://skillmd.com/llms.txt). Every skill page also has a Markdown twin at `…/<name>.md`.

## What's in the registry

Browse by [category](https://skillmd.com/categories): [Coding & Dev Tools](https://skillmd.com/category/coding) · [AI & ML](https://skillmd.com/category/ai-ml) · [DevOps & Infra](https://skillmd.com/category/devops) · [Integrations & APIs](https://skillmd.com/category/integrations) · [Security](https://skillmd.com/category/security) · [Data & Analytics](https://skillmd.com/category/data) · [Web & Frontend](https://skillmd.com/category/web) · [Productivity](https://skillmd.com/category/productivity) · [Docs & Writing](https://skillmd.com/category/docs) · [Design & Media](https://skillmd.com/category/design)

Or by [publisher](https://skillmd.com/publishers), [official skills from verified publishers](https://skillmd.com/browse/official), the [leaderboard](https://skillmd.com/browse/top), or [what's new](https://skillmd.com/browse/latest). Live counts: [skillmd.com/stats](https://skillmd.com/stats).

## Security model

Installing a skill **writes files and does nothing else**. No script execution, strict path containment (slug validation plus zip-slip guards), SHA-256 integrity verification against the registry's content-addressed store, and companion files pinned to GitHub raw hosts. Publishing runs the same lint and scan the CLI does, and every listed skill shows its verdict, capability flags and independent scanner results.

Details in [SECURITY.md](SECURITY.md). Report vulnerabilities to **hi@skillmd.com**.

## Learn more

- [The complete guide to AI agent skills](https://skillmd.com/blog/ai-agent-skills-complete-guide)
- [Agent Skills vs MCP servers](https://skillmd.com/blog/agent-skills-vs-mcp-servers)
- [Claude Code skills vs plugins vs subagents vs commands](https://skillmd.com/blog/claude-code-skills-vs-plugins-vs-subagents-vs-commands)
- [Cursor rules vs Cursor skills](https://skillmd.com/blog/cursor-rules-vs-cursor-skills)
- [The case for an open skill format](https://skillmd.com/blog/the-case-for-an-open-skill-format)
- [Glossary](https://skillmd.com/docs/glossary) · [The SKILL.md format](https://skillmd.com/docs/format) · [Getting started](https://skillmd.com/docs/getting-started)

## Development

```bash
npm ci
npm run build      # @skillmds/core, then skillmds
npm test           # vitest across both packages, incl. an MCP stdio smoke test
npm run typecheck  # strict tsc
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for layout, PR guidelines and the release process, and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE) © SkillMD · [skillmd.com](https://skillmd.com) · hi@skillmd.com
