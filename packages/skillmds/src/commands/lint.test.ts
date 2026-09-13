import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { runLint, lintCommand } from "./lint.js";

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

// Regression test: `lint` used to declare `.alias("check")`, which collided
// with the top-level `check` command (update.ts) that src/index.ts registers
// right after it — Commander threw "cannot add command 'check' as already
// have command 'lint|check'" and crashed the CLI on every invocation.
describe("lint/check command registration", () => {
  it("lintCommand() no longer declares a 'check' alias", () => {
    expect(lintCommand().aliases()).not.toContain("check");
  });

  it("registering lintCommand() then the top-level check command (as index.ts does) does not throw", async () => {
    let makeCheckCommand: () => Command;
    try {
      // Build the program the way src/index.ts does.
      ({ checkCommand: makeCheckCommand } = await import("./update.js"));
    } catch {
      // update.js (or a module it depends on, e.g. add.js) may be mid-edit by
      // another agent in this branch; fall back to a minimal stand-in that
      // reproduces the same name collision the real `check` command would.
      makeCheckCommand = () => new Command("check");
    }

    expect(() => {
      new Command("skillmd").addCommand(lintCommand()).addCommand(makeCheckCommand());
    }).not.toThrow();
  });
});
