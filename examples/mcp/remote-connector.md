# Remote MCP server (no install)

SkillMD hosts a remote MCP server over **streamable HTTP**. Any client that
supports remote MCP servers can use it with zero local setup:

```
https://api.skillmd.com/mcp
```

- Transport: streamable HTTP (`POST`), no authentication required
- Tools: `skillmd_search`, `skillmd_get`, `skillmd_download`, `skillmd_trending`, `skillmd_recommend`
- `skillmd_download` returns file contents for the client to write (the remote
  server never touches your disk — use the stdio server's `skillmd_install`
  for direct installs)

## Claude Code

```bash
claude mcp add --transport http skillmd https://api.skillmd.com/mcp
```

## claude.ai / Claude Desktop (connectors)

Add a custom connector with the URL `https://api.skillmd.com/mcp`.

## Discovery

The server advertises itself via an MCP server card:
`https://skillmd.com/.well-known/mcp/server-card.json`
