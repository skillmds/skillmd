import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runLint } from "./lint.js";

const tmps: string[] = [];
function fixture(name: string, skillMd: string): string {
  const root = mkdtempSync(join(tmpdir(), "skillmd-lint-"));
  tmps.push(root);
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), skillMd, "utf8");
  return dir;
}
afterEach(() => { for (const d of tmps.splice(0)) rmSync(d, { recursive: true, force: true }); });

const TERSE = `---
name: terse
description: short
license: MIT
---
# Terse

${"This is a body that is comfortably over two hundred characters long so the stub rule does not fire here at all. ".repeat(3)}
`;

const VALID = `---
name: good
description: A thorough skill that explains how to do a useful thing for agents.
license: MIT
---
# Good

${"Detailed instructions that go well beyond two hundred characters to satisfy the body length rule. ".repeat(3)}
`;

describe("runLint", () => {
  it("passes a terse-description skill normally (exit 0) but fails under --strict (exit 1)", async () => {
    const dir = fixture("terse", TERSE);
    expect((await runLint(dir, { format: "text" })).exitCode).toBe(0);
    expect((await runLint(dir, { format: "text", strict: true })).exitCode).toBe(1);
  });

  it("emits valid JSON containing a score", async () => {
    const dir = fixture("good", VALID);
    const run = await runLint(dir, { format: "json" });
    const parsed = JSON.parse(run.output);
    expect(parsed[0]).toHaveProperty("score");
    expect(run.exitCode).toBe(0);
  });

  it("--fix inserts a missing license", async () => {
    const dir = fixture("nolicense", VALID.replace("license: MIT\n", ""));
    const file = join(dir, "SKILL.md");
    await runLint(dir, { format: "text", fix: true });
    expect(readFileSync(file, "utf8")).toContain("license: UNKNOWN");
  });
});
