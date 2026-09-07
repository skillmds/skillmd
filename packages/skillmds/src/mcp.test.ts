// End-to-end smoke test for the stdio MCP server: spawns the real bin the way
// an MCP client does (no argv, piped stdin — exercising the CLI/server dispatch)
// and drives it over the official SDK client. Requires @skillmds/core to be
// built (`npm run build -w @skillmds/core`); the root `test` script does that.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const BIN = fileURLToPath(new URL("../bin/skillmd-mcp.mjs", import.meta.url));
const PKG_VERSION = JSON.parse(readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8")).version as string;

const VALID_SKILL = [
  "---",
  "name: hello-world",
  "description: Greet the user warmly and demonstrate the minimal shape of a valid Agent Skill.",
  "license: MIT",
  "---",
  "",
  "# Hello World",
  "",
  "A minimal example of a well-formed Agent Skill.",
  "",
  "## Instructions",
  "",
  "1. Greet the user by name when one is available.",
  "2. Keep the greeting to a single short sentence.",
  "3. Offer one helpful follow-up question so the conversation keeps moving.",
  "",
].join("\n");

// Point the child at an unroutable API so no test ever touches the network.
const env: Record<string, string> = {};
for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
env.SKILLMD_API = "http://127.0.0.1:9";
delete env.SKILLMD_TOKEN;

describe("MCP stdio server", () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ name: "skillmds-smoke-test", version: "0.0.0" });
    const transport = new StdioClientTransport({ command: process.execPath, args: [BIN], env });
    await client.connect(transport);
  }, 20_000);

  afterAll(async () => {
    await client?.close();
  });

  it("dispatches into server mode and reports the package identity", () => {
    const info = client.getServerVersion();
    expect(info?.name).toBe("skillmd");
    expect(info?.version).toBe(PKG_VERSION);
  });

  it("exposes exactly the seven documented tools", async () => {
    const res = await client.listTools();
    expect(res.tools.map((t) => t.name).sort()).toEqual(
      ["skillmd_get", "skillmd_install", "skillmd_lint", "skillmd_list_saved", "skillmd_recommend", "skillmd_search", "skillmd_trending"].sort(),
    );
  });

  it("lints raw SKILL.md content through @skillmds/core", async () => {
    const res = await client.callTool({ name: "skillmd_lint", arguments: { content: VALID_SKILL } });
    const content = res.content as Array<{ type: string; text: string }>;
    const payload = JSON.parse(content[0]!.text) as { ok: boolean; score: number };
    expect(payload.ok).toBe(true);
    expect(typeof payload.score).toBe("number");
  }, 15_000);

  it("asks for a token instead of calling the network for skillmd_list_saved", async () => {
    const res = await client.callTool({ name: "skillmd_list_saved", arguments: {} });
    const content = res.content as Array<{ type: string; text: string }>;
    expect(content[0]!.text).toContain("SKILLMD_TOKEN");
  });
});
