# Registry HTTP API

The CLI and both MCP servers are thin clients over the public SkillMD registry API at `https://api.skillmd.com`. The hosted API itself is not part of this repository, but its public surface is stable and usable directly — an OpenAPI description lives at `https://skillmd.com/openapi.json`, and `https://skillmd.com/llms.txt` summarizes it for agents.

## Endpoints the tools use

| Endpoint | Purpose |
|---|---|
| `GET /api/search?q=…` | Keyword + semantic search. Params: `limit` (≤ 50), `offset`, `category`, `verified`, `type` (`single`\|`pack`), `min_rating`, `sort` |
| `GET /api/skills/:owner/:name` | Full skill detail: body, provenance, license, security flags, audits, files |
| `GET /api/skills/:owner/:name/raw` | The SKILL.md file as `text/markdown` |
| `GET /api/skills/:owner/:name/bundle` | All files. `?format=zip` (archive), `?format=json` (base64 contents + SHA-256), `?format=manifest` (paths + hashes + URLs, no contents) |
| `GET /api/leaderboard?range=30d\|all` | Trending skills |
| `GET /api/categories` | Category tree with counts |
| `POST /api/skills/:owner/:name/install` | Anonymous install counter (fire-and-forget telemetry the clients send) |

## Agent-lean variants

`/v1/*` returns compact, agent-oriented payloads with `raw_url` links:

| Endpoint | Purpose |
|---|---|
| `GET /v1/search?q=…&agent=claude-code` | Lean search; `agent` filters to skills tagged for that agent plus universal ones |
| `GET /v1/skills` | Lean listing |
| `GET /v1/skills/:owner/:name` | Lean detail with `raw_url`, `bundle_url`, file manifest |

## Rate limits (anonymous)

| Class | Limits |
|---|---|
| Detail endpoints | 20/min, 120/hour |
| List/search endpoints | 30/min, 200/hour |

Authenticated requests (`Authorization: Bearer <token>`) get substantially higher budgets. `429` responses carry `Retry-After`. Downloads are never refused, only bandwidth-shaped under sustained heavy use.

## Integrity & provenance

Registry-stored files are content-addressed: bundle responses report each file's `sha256`, and skill detail includes `provenance` (source repo, pinned commit SHA, last sync). The CLI and MCP installer verify hashes before writing and refuse mismatches — clients consuming the API directly should do the same.
