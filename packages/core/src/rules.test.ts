import { describe, it, expect } from "vitest";
import { runRules } from "./rules.js";
import type { ParsedSkill } from "./parse.js";

const skill = (over: Partial<ParsedSkill> = {}): ParsedSkill => ({
  name: "pdf",
  description: "A".repeat(40),
  license: "MIT",
  body: "# Title\n" + "x".repeat(300),
  type: "single",
  ...over,
});

describe("runRules", () => {
  it("flags terse description as warning (SK010)", () => {
    const diags = runRules(skill({ description: "short" }));
    expect(diags.find((d) => d.id === "SK010")?.severity).toBe("warn");
  });
  it("passes a complete skill with no errors", () => {
    const diags = runRules(skill());
    expect(diags.filter((d) => d.severity === "error")).toHaveLength(0);
  });
  it("warns on missing license (SK011)", () => {
    const diags = runRules(skill({ license: null }));
    expect(diags.some((d) => d.id === "SK011")).toBe(true);
  });
  it("warns on a stub body (SK020) and no headings (SK021)", () => {
    const diags = runRules(skill({ body: "tiny" }));
    expect(diags.some((d) => d.id === "SK020")).toBe(true);
    expect(diags.some((d) => d.id === "SK021")).toBe(true);
  });
  it("warns when name does not match its slug (SK040)", () => {
    const diags = runRules(skill({ name: "Some Name" }), { slug: "different" });
    expect(diags.some((d) => d.id === "SK040")).toBe(true);
  });
});
