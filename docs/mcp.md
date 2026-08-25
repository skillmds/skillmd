# SkillMD over MCP

SkillMD speaks [Model Context Protocol](https://modelcontextprotocol.io) two ways: a **stdio server** your client runs locally (`npx -y skillmds`), and a **hosted remote server** at `https://api.skillmd.com/mcp`. Registry entry: [`com.skillmd/skillmd`](https://registry.modelcontextprotocol.io) — discoverable via the server card at `https://skillmd.com/.well-known/mcp/server-card.json`.

## Stdio server (local)

```bash
# Claude Code
claude mcp add skillmd -- npx -y skillmds
```

Other clients: see [examples/mcp/](../examples/mcp/) for Claude Desktop, Cursor, and VS Code configs. The shape is always:

```jsonc
{ "mcpServers": { "skillmd": { "command": "npx", "args": ["-y", "skillmds"] } } }
```

### One binary, two behaviors

The `skillmds` binary dispatches on how it's invoked:

- `skillmds <anything>` → runs the **CLI** (commander owns argv, so unknown commands error properly)
- `skillmds` on a terminal → runs the CLI's interactive menu
- `skillmds` with piped stdio and no args → starts the **MCP server** (exactly how MCP clients spawn it)

### Environment

| Variable | Effect |
|---|---|
| `SKILLMD_TOKEN` | Personal access token — enables `skillmd_list_saved` and personalized recommendations |
| `SKILLMD_API` | Override the registry API base (default `https://api.skillmd.com`) |

### Tools

| Tool | Arguments | What it does |
|---|---|---|
| `skillmd_search` | `query` (required), `category`, `verified_only`, `type`, `min_rating`, `limit` | Search the registry; returns slugs, descriptions, and install snippets |
| `skillmd_get` | `slug` | Full skill detail: SKILL.md body, provenance, license, security flags |
| `skillmd_install` | `slug`, `dest` (default `~/.claude/skills`) | Write the skill's files to disk. Validates before writing, SHA-256-checks registry-stored files, refuses unsafe paths, **never executes scripts** |
| `skillmd_trending` | `range` (`30d`\|`all`), `category`, `limit` | Leaderboard |
| `skillmd_recommend` | `based_on`, `limit` | Similar skills (same category), or trending when no basis is given |
| `skillmd_list_saved` | — | The signed-in user's saved skills (requires `SKILLMD_TOKEN`) |
| `skillmd_lint` | `content` or `slug` | Validate a SKILL.md and return diagnostics + security flags + quality score |

## Remote server (hosted)

```
POST https://api.skillmd.com/mcp
```

- Transport: **streamable HTTP**, stateless; no authentication
- Protocol version: `2025-06-18`; JSON-RPC batches capped at 16 messages
- Tools: `skillmd_search`, `skillmd_get`, `skillmd_download`, `skillmd_trending`, `skillmd_recommend`

The remote server never touches your filesystem — `skillmd_download` returns file contents as text for the *client* to write, where the stdio server's `skillmd_install` writes to disk directly.

```bash
# Claude Code, remote transport
claude mcp add --transport http skillmd https://api.skillmd.com/mcp
```

On claude.ai / Claude Desktop, add it as a custom connector with that URL.

## Security model

Installs write files and nothing else. Four guarantees, enforced in code ([SECURITY.md](../SECURITY.md)):

1. No script execution, ever — scripts are reported as flags, not run.
2. Strict slug validation + zip-slip guards: files cannot escape the target skill directory.
3. SHA-256 integrity verification of registry-stored files; tampered bundles are refused whole (no partial installs).
4. Companion files are fetched only from pinned GitHub raw hosts (SSRF guard).
