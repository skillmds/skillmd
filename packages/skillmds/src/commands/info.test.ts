import { describe, it, expect } from "vitest";
import { runInfo } from "./info.js";
import type { DetailSkill } from "./info.js";

const SKILL: DetailSkill = {
  slug: "anthropic/pdf",
  title: "PDF",
  description: "Read and write PDFs.",
};

/** A stubbed registry client: runInfo's only network call. */
const stub = (skill: Partial<DetailSkill>) => ({
  api: async <T>(_path: string): Promise<T> => ({ ...SKILL, ...skill }) as T,
});

describe("runInfo", () => {
  it("rejects a slug that is not owner/name without going to the network", async () => {
    const r = await runInfo("pdf", {}, { api: async () => { throw new Error("should not fetch"); } });
    expect(r.exitCode).toBe(1);
    expect(r.output).toMatch(/owner\/name/);
  });

  it("strips terminal escapes out of the description", async () => {
    const r = await runInfo("anthropic/pdf", {}, stub({ description: "evil\x1b[2Jtext" }));
    expect(r.exitCode).toBe(0);
    expect(r.output).toContain("eviltext");
    expect(r.output).not.toContain("[2J");
  });

  it("strips terminal escapes out of every registry string it prints", async () => {
    const r = await runInfo("anthropic/pdf", {}, stub({
      slug: "anthropic\x1b[2J/pdf",
      category: "docs\x1b]0;pwned\x07",
      license: "MIT\x1b[2J",
      provenance: { source_repo: "owner/repo\x1b[2J", commit_sha: "abc123def456" },
      install: { cli: "skillmd add x\x1b[2J" },
    }));
    expect(r.output).not.toContain("[2J");
    expect(r.output).not.toContain("pwned");
    expect(r.output).toContain("anthropic/pdf");
  });

  it("--json passes the registry document straight through", async () => {
    const r = await runInfo("anthropic/pdf", { json: true }, stub({}));
    expect(JSON.parse(r.output)).toMatchObject({ slug: "anthropic/pdf" });
  });

  it("reports a 404 as 'not found' and anything else as unreachable", async () => {
    const notFound = await runInfo("a/b", {}, { api: async () => { throw new Error("SkillMD API 404 on /api/skills/a/b: "); } });
    expect(notFound.exitCode).toBe(1);
    expect(notFound.output).toMatch(/not found/i);
    const down = await runInfo("a/b", {}, { api: async () => { throw new Error("could not reach https://api.skillmd.com: boom"); } });
    expect(down.exitCode).toBe(1);
    expect(down.output).toMatch(/Could not reach/i);
  });
});
