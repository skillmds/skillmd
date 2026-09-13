<p align="center">
  <img src="https://skillmd.com/brand/banner.png" alt="SkillMD" width="560">
</p>

# skillmds

[![npm version](https://img.shields.io/npm/v/skillmds.svg)](https://www.npmjs.com/package/skillmds)
[![license](https://img.shields.io/npm/l/skillmds.svg)](https://github.com/skillmds/skillmd/blob/main/LICENSE)
[![source](https://img.shields.io/badge/source-skillmds%2Fskillmd-blue?logo=github)](https://github.com/skillmds/skillmd)

Tools for working with [Agent Skills](https://docs.claude.com/en/docs/agents-and-tools/agent-skills) (`SKILL.md`) from the [SkillMD](https://skillmd.com) registry. One package, two binaries:

- **`skillmd`** — a CLI to lint, scan, search, install, and publish skills.
- **`skillmds`** — an MCP server exposing the registry to MCP clients (Claude Code, Claude Desktop, Cursor, …).

Both validate `SKILL.md` with the same engine ([`@skillmds/core`](https://www.npmjs.com/package/@skillmds/core)), so the CLI and the registry apply identical rules. Source lives at [github.com/skillmds/skillmd](https://github.com/skillmds/skillmd).

## Install

```bash
npm i -g skillmds
```

This installs both the `skillmd` and `skillmds` commands. To run the CLI without installing:

```bash
npx skillmds lint .
```

**Which binary runs what.** `skillmds` with any argument runs the CLI. `skillmds` with no arguments starts the **MCP server** when stdin is piped (how an MCP client launches it), and opens the interactive CLI menu when there's a terminal attached. `skillmd` is always the CLI.

## CLI: `skillmd`

| Command | Description |
|---|---|
| `skillmd lint [path]` | Validate `SKILL.md` files; print diagnostics and a quality score. |
| `skillmd scan [path]` | Report scripts, network calls, and secret access. |
| `skillmd rules [id]` | List lint rules, or show one. |
| `skillmd init [name]` | Create a `SKILL.md` from a template. |
| `skillmd search <query>` | Search the registry. |
| `skillmd info <slug>` | Show a skill's registry record: verification, security flags, provenance, rating. |
| `skillmd add <source>` | Install a skill (registry slug, GitHub source, gist, or local path). Lints before writing. |
| `skillmd list` (`ls`) | List installed skills with their scope, agents, link mode and source. |
| `skillmd remove [names...]` (`rm`) | Remove installed skills, or unlink them from specific agents. |
| `skillmd update [names...]` | Update installed skills from the source recorded in the lock file. |
| `skillmd check [names...]` | Report which installed skills have updates (`update --check`). |
| `skillmd publish [path]` (`submit`) | Publish to the registry. Exits non-zero on lint errors. |
| `skillmd login` / `logout` | Store or remove a token. |

> `check` is a command of its own since 1.2.0. It used to be an alias of `lint` — scripts that ran `skillmd check .` to validate a skill should now run `skillmd lint .`.

### lint

```bash
skillmd lint ./my-skill
skillmd lint . --format sarif > skillmd.sarif
skillmd lint . --strict
skillmd lint . --fix
```

Formats: `text` (default), `json`, `sarif` (GitHub Code Scanning), `github` (Actions annotations).
Exit codes: `0` clean, `1` errors (or warnings with `--strict` / `--fail-on-warning`).

### add

```bash
skillmd add anthropic/pdf                      # registry slug
skillmd add owner/repo                          # GitHub repo
skillmd add owner/repo/skills/pdf#main          # a subfolder at a ref
skillmd add owner/repo@pdf                      # one skill inside a repo or pack
skillmd add https://github.com/owner/repo/tree/v2/skills/pdf
skillmd add https://gist.github.com/user/0123456789abcdef
skillmd add ./path                              # local directory
skillmd add owner/repo --list                   # what's in there? install nothing
skillmd add anthropic/pdf -a claude-code cursor -g
skillmd add anthropic/pdf --mode copy           # no links; real files per agent
skillmd add some/skill --deny executes_scripts
skillmd add some/skill --skip-lint
```

Sources: a registry slug `owner/name`; a GitHub repo, subdirectory, ref (`#ref`) or named skill (`@skill`), including `tree/` and `blob/` URLs; `github:`/`gh:` to force the GitHub reading of a bare `owner/name`; a gist URL; or a local path. `--ref <ref>` overrides the ref on any GitHub source. GitLab and `git@` sources aren't supported — clone them and install from the path.

**Where skills land.** One canonical copy, linked into each agent you chose:

| Scope | Flag | Canonical copy | Agent links | Lock file |
| --- | --- | --- | --- | --- |
| **Project** | `-p`, `--project` | `.agents/skills/<name>` | `./<agent-dir>/skills/<name>` | `skills-lock.json` (commit it) |
| **Global** | `-g`, `--global` | `~/.agents/skills/<name>` | `~/<agent-dir>/skills/<name>` | `~/.skillmd/lock.json` |

Each agent link is a junction on Windows and a symlink elsewhere, so updating the canonical copy updates every agent at once; `--mode copy` writes real files instead. A project install only touches agents the project already uses (or the ones you name with `-a`), so `add -p` never invents a folder for an agent you don't run.

In a terminal, `add` asks for the scope (**Project** / **Global**) and then which detected agents to link into, remembering your agent choice for next time. Off a terminal the scope is auto-detected — see [Non-interactive use](#non-interactive-use).

Re-installing the same skill from the same source is fine. Replacing a skill that came from a *different* source, or a directory the lock file doesn't know about, needs `--force`.

### list / remove / update / check

```bash
skillmd list                       # everything installed, project and global
skillmd list -p -a claude-code     # just this project, just one agent
skillmd remove pdf                 # unlink from every agent, delete the copy
skillmd remove pdf -a cursor       # unlink from Cursor only; copy stays
skillmd remove --all -g -y         # clear your user-level skills
skillmd check                      # which skills have updates?
skillmd update                     # refresh them from their recorded sources
skillmd update pdf -g
```

`list` shows name · scope · agents · mode · source. Skills installed by hand or by an older CLI have no lock entry and are tagged `untracked`: `update` skips them and tells you to re-run `skillmd add` once to start tracking them.

`update` re-fetches the full bundle from the source recorded in the lock file, re-lints it, and skips skills whose recorded commit hasn't moved. `check` is `update --check`: it reports and writes nothing.

`remove` with no names opens a picker, and confirms before deleting unless you pass `-y`.

### Non-interactive use

Every command works without a terminal, and none of them will ever block on a prompt when there isn't one.

```bash
skillmd add anthropic/pdf -y --json
skillmd list --json
skillmd check --json
```

- **`--json` requires `-y`** on `add`, and prints exactly one document on stdout; human text and warnings go to stderr, so `skillmd add … --json | jq` is always valid JSON. The `add` document is `{ ok, scope, installed: [{ name, canonical, targets, skipped, digest }], blocked, warnings }`.
- **Scope auto-detection.** With `-y`, `--json`, piped stdin, or inside a host agent (Claude Code, Cursor, Codex, Gemini CLI, or any CI), `add` picks **project** when the working directory carries `.git`, `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `AGENTS.md`, `CLAUDE.md`, `skills-lock.json` or an agent dot-dir, and **global** otherwise. It says which it picked. Pass `-p` or `-g` to decide yourself.
- **Piped with neither `-y` nor a scope flag exits 1** with a hint rather than guessing where to write.
- **Exit codes.** `0` success; `1` anything that failed — lint errors, a blocked or denied skill, nothing removed, an update that couldn't be applied, or a prompt that was required but impossible. `login`, `logout` and `init` also exit 1 off a TTY, naming the flags to pass instead.
- **Tokens.** Prefer `skillmd login` or `SKILLMD_TOKEN` over `--token`: a token on the command line is visible in your shell history and in every process listing on the machine, and the CLI warns about it. A stored token is bound to the API base it was saved for and is never sent anywhere else. An `http://` API base is refused unless you add `--insecure-http`.

### What the CLI sends

Installing a skill **from the registry** sends one fire-and-forget request so the skill's install count on skillmd.com stays accurate:

```
POST https://api.skillmd.com/api/skills/<owner>/<name>/install
{"via":"cli"}
```

That is the whole payload — no identifiers, no paths, no machine information — and the install succeeds whether or not it goes through. Installs from GitHub, gists and local paths send nothing. To turn it off:

```bash
export SKILLMD_NO_TELEMETRY=1   # or the cross-tool DO_NOT_TRACK=1
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

Tools: `skillmd_search`, `skillmd_get`, `skillmd_install`, `skillmd_trending`, `skillmd_recommend`, `skillmd_list_saved`, `skillmd_lint`.

`skillmd_install` runs the same installer as the CLI — it validates the skill, writes one canonical copy and links it into the chosen agents — and takes `scope` (`project` | `global`), `agents`, `mode` (`link` | `copy`), `force` and `deny`. It never executes scripts. The old `dest` parameter is deprecated and is accepted only when it points at a known agent skills directory; use `scope` + `agents` instead.

### Remote server (no install)

SkillMD also hosts a remote MCP server over streamable HTTP — point any client that supports remote servers at:

```
https://api.skillmd.com/mcp
```

No auth required. It exposes `skillmd_search`, `skillmd_get`, `skillmd_download`, `skillmd_trending`, and `skillmd_recommend` (`skillmd_download` returns file contents for the client to write, instead of writing to disk).

## Find skills on skillmd.com

The registry behind these tools is [skillmd.com](https://skillmd.com): 25,000+ Agent Skills, each linted, security-scanned and content-pinned.

- [Search all skills](https://skillmd.com/search) · [browse by category](https://skillmd.com/categories) · [by publisher](https://skillmd.com/publishers)
- Install guides per agent: [Claude Code](https://skillmd.com/agents/claude-code) · [Cursor](https://skillmd.com/agents/cursor) · [Codex](https://skillmd.com/agents/codex) · [all 60+ agents](https://skillmd.com/agents)
- [The SKILL.md format](https://skillmd.com/docs/format) · [CLI docs](https://skillmd.com/docs/cli) · [MCP docs](https://skillmd.com/docs/mcp) · [registry stats](https://skillmd.com/stats)

## Configuration

Resolution order, highest first:

| Setting | Sources |
|---|---|
| Token | `--token` → `SKILLMD_TOKEN` → `~/.skillmd/config.json` |
| API base | `--api` → `SKILLMD_API` → default registry |

`SKILLMD_TOKEN` enables `skillmd_list_saved`, personalized recommendations, and publishing. A stored token records the API base it belongs to and is only ever sent there. `SKILLMD_NO_TELEMETRY=1` (or `DO_NOT_TRACK=1`) disables the install-count ping described above.

## License

[MIT](https://github.com/skillmds/skillmd/blob/main/LICENSE)
