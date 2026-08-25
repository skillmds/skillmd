import { describe, it, expect } from "vitest";
import { parseSkillMd, slugify } from "./parse.js";

describe("parseSkillMd", () => {
  it("rejects missing frontmatter", () => {
    expect("error" in parseSkillMd("no frontmatter")).toBe(true);
  });
  it("requires name and description", () => {
    const r = parseSkillMd("---\nname: x\n---\nbody");
    expect("error" in r).toBe(true); // description missing
  });
  it("parses a valid skill", () => {
    const r = parseSkillMd("---\nname: PDF\ndescription: Work with PDFs\nlicense: MIT\n---\n# Body");
    expect(r).toMatchObject({ name: "PDF", description: "Work with PDFs", license: "MIT", type: "single" });
  });
  it("rejects descriptions over 1024 chars", () => {
    const r = parseSkillMd(`---\nname: x\ndescription: ${"a".repeat(1025)}\n---\nbody`);
    expect("error" in r).toBe(true);
  });
});

describe("slugify", () => {
  it("normalizes", () => expect(slugify("Hello World!")).toBe("hello-world"));
  it("falls back to 'skill' for empty input", () => expect(slugify("!!!")).toBe("skill"));
});

describe("description length limit (Claude Code allows 1024)", () => {
  it("accepts a 1024-char description", () => {
    const raw = `---\nname: x\ndescription: ${"a".repeat(1024)}\n---\nbody`;
    expect("error" in parseSkillMd(raw)).toBe(false);
  });
  it("rejects a 1025-char description", () => {
    const raw = `---\nname: x\ndescription: ${"a".repeat(1025)}\n---\nbody`;
    expect(parseSkillMd(raw)).toEqual({ error: "description must be <= 1024 chars" });
  });
});
