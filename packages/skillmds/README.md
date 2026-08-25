<p align="center">
  <img src="https://cdn.jsdelivr.net/npm/skillmds/assets/skillmd-banner.jpg" alt="SkillMD" width="560">
</p>

# skillmds

[![npm version](https://img.shields.io/npm/v/skillmds.svg)](https://www.npmjs.com/package/skillmds)
[![license](https://img.shields.io/npm/l/skillmds.svg)](https://github.com/skillmds/skillmd/blob/main/LICENSE)
[![source](https://img.shields.io/badge/source-skillmds%2Fskillmd-blue?logo=github)](https://github.com/skillmds/skillmd)

Tools for working with [Agent Skills](https://docs.claude.com/en/docs/agents-and-tools/agent-skills) (`SKILL.md`) from the [SkillMD](https://skillmd.com) registry. One package, two binaries:

- **`skillmd`** — a CLI to lint, scan, search, install, and publish skills.
- **`skillmds`** — an MCP server exposing the registry to MCP clients (Claude Code, Claude Desktop, Cursor, …).

Both validate `SKILL.md` with the same engine ([`@skillmd/core`](https://www.npmjs.com/package/@skillmd/core)), so the CLI and the registry apply identical rules. Source lives at [github.com/skillmds/skillmd](https://github.com/skillmds/skillmd).

## Install

```bash
npm i -g skillmds
```

This installs both the `skillmd` and `skillmds` commands. To run the CLI without installing:

```bash
npx skillmds lint .
```

`npx skillmds <command>` runs the CLI; `npx skillmds` with no command starts the MCP server.

## CLI: `skillmd`

| Command | Description |
|---|---|
| `skillmd lint [path]` (`check`) | Validate `SKILL.md` files; print diagnostics and a quality score. |
| `skillmd scan [path]` | Report scripts, network calls, and secret access. |
| `skillmd rules [id]` | List lint rules, or show one. |
| `skillmd init [name]` | Create a `SKILL.md` from a template. |
| `skillmd search <query>` | Search the registry. |
| `skillmd add <source>` | Install a skill (registry slug, GitHub repo, or local path). Lints before writing. |
| `skillmd list` (`ls`) | List installed skills. |
| `skillmd remove <names...>` (`rm`) | Remove installed skills. |
| `skillmd update [names...]` | Update installed skills from the registry. |
| `skillmd publish [path]` (`submit`) | Publish to the registry. Exits non-zero on lint errors. |
| `skillmd login` / `logout` | Store or remove a token. |

All commands accept `--json`.

### lint

```bash
skillmd lint ./my-skill
skillmd lint . --format sarif > skillmd.sarif
skillmd lint . --strict
skillmd lint . --fix
```

Formats: `text` (default), `json`, `sarif` (GitHub Code Scanning), `github` (Actions annotations).
Exit codes: `0` clean, `1` errors (or warnings with `--strict` / `--fail-on-warning`), `2` usage error.

### add

```bash
skillmd add anthropic/pdf                 # registry slug
skillmd add owner/repo                     # GitHub repo
skillmd add ./path                         # local
skillmd add anthropic/pdf -a claude-code -g
skillmd add some/skill --deny executes_scripts
skillmd add some/skill --skip-lint
```

### publish

```bash
skillmd login                # store a token from your skillmd.com account
skillmd publish ./my-skill   # blocked on lint errors
skillmd publish ./my-skill --dry-run
skillmd publish ./my-skill --force   # publish despite warnings; never bypasses errors
```

## MCP server: `skillmds`

Claude Code:

```bash
claude mcp add skillmd -- npx -y skillmds
```

Other MCP clients:

```jsonc
{
  "mcpServers": {
    "skillmd": { "command": "npx", "args": ["-y", "skillmds"] }
  }
}
```

Tools: `skillmd_search`, `skillmd_get`, `skillmd_install`, `skillmd_trending`, `skillmd_recommend`, `skillmd_list_saved`, `skillmd_lint`. `skillmd_install` writes a skill's `SKILL.md` and never executes scripts.

### Remote server (no install)

SkillMD also hosts a remote MCP server over streamable HTTP — point any client that supports remote servers at:

```
https://api.skillmd.com/mcp
```

No auth required. It exposes `skillmd_search`, `skillmd_get`, `skillmd_download`, `skillmd_trending`, and `skillmd_recommend` (`skillmd_download` returns file contents for the client to write, instead of writing to disk).

## Configuration

Resolution order, highest first:

| Setting | Sources |
|---|---|
| Token | `--token` → `SKILLMD_TOKEN` → `~/.skillmd/config.json` |
| API base | `--api` → `SKILLMD_API` → default registry |

`SKILLMD_TOKEN` enables `skillmd_list_saved`, personalized recommendations, and publishing.

## License

[MIT](https://github.com/skillmds/skillmd/blob/main/LICENSE)
