import { describe, it, expect } from "vitest";
import { TOOLS, handleCall } from "./tools.js";
import type { ToolContext } from "./tools.js";

const VALID =
  "---\nname: hello\ndescription: Greet the user warmly and demonstrate a valid skill.\nlicense: MIT\n---\n\n# Hello\n\n" +
  "Instructions line. ".repeat(20);

const ctx = (over: Partial<ToolContext> = {}): ToolContext => ({
  api: async (path) => {
    throw new Error(`unexpected api call ${path}`);
  },
  hasToken: false,
  base: "https://api.test",
  ...over,
});

describe("TOOLS metadata", () => {
  it("has seven tools, each with title, annotations, outputSchema and described params", () => {
    expect(TOOLS.map((t) => t.name).sort()).toEqual([
      "skillmd_get",
      "skillmd_install",
      "skillmd_lint",
      "skillmd_list_saved",
      "skillmd_recommend",
      "skillmd_search",
      "skillmd_trending",
    ]);
    for (const t of TOOLS) {
      expect(t.title).toBeTruthy();
      expect(t.annotations).toBeTruthy();
      expect(t.outputSchema).toBeTruthy();
      for (const [k, v] of Object.entries(t.inputSchema.properties)) expect((v as { description?: string }).description, `${t.name}.${k}`).toBeTruthy();
    }
  });
  it("only skillmd_install is non-read-only", () => {
    for (const t of TOOLS) expect(t.annotations.readOnlyHint).toBe(t.name !== "skillmd_install");
  });
});

describe("handleCall", () => {
  it("skillmd_lint lints inline content and returns structuredContent", async () => {
    const r = await handleCall("skillmd_lint", { content: VALID }, ctx());
    expect(r.isError).toBeFalsy();
    expect((r.structuredContent as { ok: boolean }).ok).toBe(true);
  });
  it("skillmd_search trims site-only fields and sanitises text", async () => {
    const r = await handleCall(
      "skillmd_search",
      { query: "x" },
      ctx({
        api: (async () => ({ items: [{ slug: "o/n", title: "T\x1b[2J", description: "d", avg_rating: 5, install_count: 9 }] })) as ToolContext["api"],
      }),
    );
    const items = (r.structuredContent as { items: Record<string, unknown>[] }).items;
    expect(items[0]).toEqual({ slug: "o/n", title: "T", description: "d" });
  });
  it("skillmd_list_saved asks for a token without touching the network", async () => {
    const r = await handleCall("skillmd_list_saved", {}, ctx());
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toContain("SKILLMD_TOKEN");
  });
  it("unknown tools are an error result, not a throw", async () => {
    const r = await handleCall("nope", {}, ctx());
    expect(r.isError).toBe(true);
  });
});
