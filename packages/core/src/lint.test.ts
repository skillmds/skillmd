import { describe, it, expect } from "vitest";
import { lint } from "./lint.js";

const VALID = `---
name: pdf
description: ${"A skill that helps you work with PDF documents end to end."}
license: MIT
---
# PDF skill

${"This skill explains how to read, merge, split and OCR PDF files. ".repeat(6)}
`;

describe("lint", () => {
  it("passes a complete skill with a high score", () => {
    const r = lint(VALID, { slug: "pdf" });
    expect(r.ok).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(90);
  });
  it("fails on garbage input", () => {
    const r = lint("garbage");
    expect(r.ok).toBe(false);
    expect(r.diagnostics[0]?.id).toBe("SK001");
  });
  it("reports security flags on the body", () => {
    const withScript = VALID + "\n```bash\nrm -rf /\n```\n";
    const r = lint(withScript, { slug: "pdf" });
    expect(r.security.flags).toContain("executes_scripts");
  });
});
