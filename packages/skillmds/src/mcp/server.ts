// The stdio MCP server. It owns nothing but wiring: the tool list and the tool
// runtime live in ./tools.ts, and the registry client is the very same
// createClient() the CLI uses, so base-URL resolution, token binding, timeouts
// and the http:// refusal are identical on both surfaces.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { readFileSync } from "node:fs";
import { createClient } from "../api.js";
import { TOOLS, handleCall } from "./tools.js";
import type { ToolContext } from "./tools.js";

// Read the version from the package this server is bundled into (resolved at
// runtime relative to the built file in dist/), so it never drifts.
const VERSION = (() => {
  try {
    return (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }).version;
  } catch {
    return "0.0.0";
  }
})();

export function buildContext(): ToolContext {
  try {
    // SKILLMD_API / SKILLMD_TOKEN / ~/.skillmd/config.json, https enforced.
    const c = createClient({});
    return { api: c.api, hasToken: c.hasToken, base: c.base, token: c.token, cwd: process.cwd(), home: undefined, env: process.env };
  } catch (e) {
    // createClient() throws on a bad SKILLMD_API (an http:// base, a malformed
    // URL). This runs before connect(), so throwing here would kill the process
    // during startup and the client would see a transport that died without a
    // word. Hand back a context that refuses every call with the reason instead:
    // tools/list still works, and the first tools/call explains itself.
    const why = e instanceof Error ? e.message : String(e);
    const unavailable = async () => {
      throw new Error(`SkillMD client unavailable: ${why}`);
    };
    return { api: unavailable as ToolContext["api"], hasToken: false, base: "", cwd: process.cwd(), home: undefined, env: process.env };
  }
}

export async function startMcpServer(): Promise<void> {
  const server = new Server(
    {
      name: "skillmd",
      version: VERSION,
      title: "SkillMD",
      description:
        "The open registry of Agent Skills: search, inspect, lint and install 25,000+ linted, security-reviewed SKILL.md files for Claude Code, Cursor, Codex and 60+ other agents.",
      websiteUrl: "https://skillmd.com",
      icons: [
        { src: "https://skillmd.com/favicon.png", mimeType: "image/png", sizes: ["512x512"] },
        { src: "https://skillmd.com/favicon.svg", mimeType: "image/svg+xml", sizes: ["any"] },
      ],
    },
    {
      capabilities: { tools: {} },
      instructions:
        "SkillMD is a registry of Agent Skills (SKILL.md files). Use skillmd_search to find skills for a task, skillmd_get to inspect one (safety verdict, capability flags, provenance), skillmd_install to write it into the agent's skills directory, and skillmd_lint to validate your own SKILL.md. skillmd_trending and skillmd_recommend surface popular and related skills. Only skillmd_install writes files; it never executes scripts. skillmd_install writes one canonical copy (.agents/skills/<name>) and links it into the chosen agents' skill dirs; pass scope (project|global) and agents to choose where.",
    },
  );
  const ctx = buildContext();
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
  // ServerResult is a union that also covers task-augmented replies; a plain
  // tool result is one member of it, so the cast is a narrowing, not a claim.
  server.setRequestHandler(
    CallToolRequestSchema,
    async (req) => (await handleCall(req.params.name, (req.params.arguments ?? {}) as Record<string, unknown>, ctx)) as CallToolResult,
  );
  await server.connect(new StdioServerTransport());
  console.error("skillmd MCP server running (stdio)");
}
