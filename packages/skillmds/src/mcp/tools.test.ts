import { describe, it, expect } from "vitest";
import { TOOLS, handleCall, parseSlug } from "./tools.js";
import type { ToolContext } from "./tools.js";
import { SKILL_ITEM } from "./schemas.js";

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
  // The typed rewrite is a refactor of the original .mjs server: a client that
  // knew the old tool list must still recognise this one. Anything the original
  // published and this list dropped is drift, not a decision.
  it("still publishes the names, hints and schema shape the original server did", () => {
    const install = TOOLS.find((t) => t.name === "skillmd_install")!;
    expect(install.title).toBe("Install skill");
    expect(install.annotations.title).toBe("Install skill");
    expect(install.annotations.openWorldHint).toBe(false);
    expect((install.inputSchema.properties.slug as { pattern?: string }).pattern).toBe("^[^/]+/[^/]+$");

    // skillmd_get declares the full record, including the fields the list tools
    // trim away — an agent deciding whether to install needs them.
    const props = (TOOLS.find((t) => t.name === "skillmd_get")!.outputSchema as { properties: Record<string, unknown> }).properties;
    for (const k of ["type", "verified", "owner_name", "install_snippet", "tags", "categories"]) expect(props[k], k).toBeTruthy();

    expect(SKILL_ITEM.required).toEqual(["slug"]);
    for (const k of ["owner_name", "install_snippet"]) expect(SKILL_ITEM.properties[k as "slug"], k).toBeTruthy();
    for (const [k, v] of Object.entries(SKILL_ITEM.properties)) expect((v as { description?: string }).description, k).toBeTruthy();
  });
});

describe("parseSlug", () => {
  it("accepts owner/name in either case and refuses anything else", () => {
    expect(parseSlug("Owner/Name")).toEqual(["Owner", "Name"]);
    expect(parseSlug("o/n")).toEqual(["o", "n"]);
    expect(parseSlug("../x")).toBeNull();
    expect(parseSlug("a/b/c")).toBeNull();
    expect(parseSlug("-bad/n")).toBeNull();
    expect(parseSlug(undefined)).toBeNull();
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
  it("skillmd_get returns the whole record, sanitised but not trimmed", async () => {
    const r = await handleCall(
      "skillmd_get",
      { slug: "o/n" },
      ctx({ api: (async () => ({ slug: "o/n", title: "T\x1b[2J", type: "pack", verified: true, category_slug: "x" })) as ToolContext["api"] }),
    );
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent).toEqual({ slug: "o/n", title: "T", type: "pack", verified: true, category_slug: "x" });
  });
  it("skillmd_trending passes range, category and limit through to the leaderboard", async () => {
    let seen = "";
    const r = await handleCall(
      "skillmd_trending",
      { range: "30d", category: "devops", limit: 5 },
      ctx({
        api: (async (p: string) => {
          seen = p;
          return { items: [{ slug: "o/n", title: "T", description: "d", install_count: 3 }] };
        }) as ToolContext["api"],
      }),
    );
    expect(seen).toBe("/api/leaderboard?range=30d&limit=5&category=devops");
    expect((r.structuredContent as { items: Record<string, unknown>[] }).items[0]).toEqual({ slug: "o/n", title: "T", description: "d" });
  });
  it("skillmd_recommend ranks the based_on skill's category and drops the skill itself", async () => {
    const paths: string[] = [];
    const r = await handleCall(
      "skillmd_recommend",
      { based_on: "o/n", limit: 3 },
      ctx({
        api: (async (p: string) => {
          paths.push(p);
          if (p.startsWith("/api/skills/")) return { category_slug: "dev ops" };
          return { items: [{ slug: "o/n", title: "Self", description: "d" }, { slug: "o/other", title: "Other", description: "d" }] };
        }) as ToolContext["api"],
      }),
    );
    expect(paths[0]).toBe("/api/skills/o/n");
    expect(paths[1]).toBe("/api/leaderboard?range=all&limit=3&category=dev%20ops");
    expect((r.structuredContent as { items: { slug: string }[] }).items.map((i) => i.slug)).toEqual(["o/other"]);
  });
  it("skillmd_recommend falls back to 30d trending when the base skill has no category", async () => {
    const paths: string[] = [];
    await handleCall(
      "skillmd_recommend",
      { based_on: "o/n" },
      ctx({
        api: (async (p: string) => {
          paths.push(p);
          return p.startsWith("/api/skills/") ? {} : { items: [] };
        }) as ToolContext["api"],
      }),
    );
    expect(paths[1]).toBe("/api/leaderboard?range=30d&limit=10");
  });
  it("skillmd_lint fetches a slug and lints the registry copy", async () => {
    const r = await handleCall(
      "skillmd_lint",
      { slug: "o/hello" },
      ctx({ api: (async () => ({ slug: "o/hello", raw_md: VALID, verified: true })) as ToolContext["api"] }),
    );
    expect(r.isError).toBeFalsy();
    expect((r.structuredContent as { ok: boolean }).ok).toBe(true);
  });
  // buildContext() hands back a context whose api rejects when createClient()
  // threw, so a bad SKILLMD_API is a per-call notice instead of a server that
  // dies before it can answer anything.
  it("reports an unavailable client as a notice on every tool call", async () => {
    const r = await handleCall(
      "skillmd_search",
      { query: "x" },
      ctx({
        api: (async () => {
          throw new Error("SkillMD client unavailable: refusing http");
        }) as ToolContext["api"],
      }),
    );
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toBe("SkillMD client unavailable: refusing http");
  });
  it("unknown tools are an error result, not a throw", async () => {
    const r = await handleCall("nope", {}, ctx());
    expect(r.isError).toBe(true);
  });
});
