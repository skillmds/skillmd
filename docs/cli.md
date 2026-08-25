# `skillmd` CLI reference

Install: `npm i -g skillmds` (ships both the `skillmd` CLI and the `skillmds` MCP server). One-off runs: `npx skillmds <command>`.

Global options, accepted by every command:

| Flag | Effect |
|---|---|
| `--json` | Machine-readable output |
| `--token <token>` | SkillMD personal access token for this invocation |
| `--api <url>` | Override the registry API base URL |

Running `skillmd` with no command on a terminal opens a guided interactive menu (lint, scan, search-and-install, create, list). When output is piped, it prints help instead.

## Configuration resolution

Highest priority first:

| Setting | Sources |
|---|---|
| Token | `--token` → `SKILLMD_TOKEN` env → `~/.skillmd/config.json` |
| API base | `--api` → `SKILLMD_API` env → `https://api.skillmd.com` |

`skillmd login` writes `~/.skillmd/config.json` (mode `0600`).

## Quality commands

### `skillmd lint [target]` (alias: `check`)

Validate SKILL.md files against the spec, print diagnostics, security flags, and a 0–100 quality score. `target` is a file or a directory (directories are searched for skills).

| Flag | Effect |
|---|---|
| `--format <fmt>` | `text` (default), `json`, `sarif` (GitHub Code Scanning), `github` (Actions annotations) |
| `--strict` | Treat warnings as errors |
| `--fail-on-warning` | Exit non-zero when warnings exist |
| `--fix` | Apply safe automatic fixes |
| `--errors-only` | Hide warnings from the output |

Exit codes: `0` clean · `1` errors (or warnings under `--strict` / `--fail-on-warning`) · `2` usage error.

```bash
skillmd lint ./my-skill
skillmd lint . --format sarif > skillmd.sarif
```

Rule reference: [rules.md](rules.md).

### `skillmd scan [target]`

Security-scan skill bodies for scripts, network calls, and secret access. `--deny <flags...>` exits non-zero when a named flag is found (e.g. `--deny executes_scripts reads_secrets`); `--format text|json`.

### `skillmd rules [id]`

List every lint rule, or show one rule in detail (`skillmd rules SK011`).

### `skillmd init [name]`

Scaffold a new SKILL.md from a template. Prompts interactively; `--name`, `--description`, `--license` (default MIT), and `-y/--yes` skip the prompts.

## Registry commands

### `skillmd search <query>`

Search the registry. Filters: `--category <slug>`, `--verified`, `--type single|pack`, `--min-rating <n>`, `--limit <n>` (default 20).

### `skillmd info <slug>`

Full registry detail for `owner/name`: verification status, security flags, provenance (source repo + pinned commit), rating, license.

### `skillmd add <source>`

Install a skill. Sources: a registry slug (`owner/name`), a GitHub repo (`owner/repo` or URL), or a local path. Lints before writing and refuses on errors; **never executes scripts**.

| Flag | Effect |
|---|---|
| `-g, --global` | Install to the agent's global (home) skills dir instead of the project |
| `-a, --agent <agents...>` | Target specific agents (default: every agent detected on the machine) |
| `-s, --skill <names...>` | From a multi-skill repo, install only these skills |
| `--copy` | Copy from a local path instead of linking |
| `-y, --yes` | Skip confirmation prompts |
| `--skip-lint` | Install even with lint errors |
| `--deny <flags...>` | Refuse skills carrying the named security flags |

### `skillmd list` (alias: `ls`)

List installed skills across every detected agent, tagged `[agent/scope]`. `-g` for global only.

### `skillmd remove <names...>` (alias: `rm`) · `skillmd update [names...]`

Remove installed skills, or re-fetch + re-lint them from the registry.

## Publishing

### `skillmd publish [target]` (alias: `submit`)

Publish a skill (or pack, `--type pack`) to the registry. Refuses on lint errors, always. `--force` publishes despite **warnings**; `--dry-run` validates without publishing. Requires a token (`skillmd login`).

### `skillmd login` / `skillmd logout`

Store or remove a personal access token from your skillmd.com account.

## Supported agents

`skillmd add` detects **68 agents** by their config dirs under your home directory — Claude Code, Cursor, Codex, Windsurf, OpenCode, Gemini CLI, Antigravity, Kiro, Warp, GitHub Copilot, Cline, Roo Code, Goose, Trae, Qwen Code, Amp, Zed, Continue, Devin, OpenHands, Replit, and more — and writes each skill to every detected agent's own skills directory (agents sharing the `.agents/skills` convention are written once). `-a/--agent` narrows the target set.
