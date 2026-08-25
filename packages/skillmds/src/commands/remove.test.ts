import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runRemove } from "./remove.js";
import { agentDir } from "../agents.js";

const tmps: string[] = [];
function tmp(): string { const d = mkdtempSync(join(tmpdir(), "skillmd-rm-")); tmps.push(d); return d; }
afterEach(() => { for (const d of tmps.splice(0)) rmSync(d, { recursive: true, force: true }); });

describe("runRemove", () => {
  it("removes an installed skill", () => {
    const cwd = tmp();
    const dir = join(agentDir("claude-code", { cwd }), "foo");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), "---\nname: foo\ndescription: d\n---\nbody", "utf8");

    const run = runRemove(["foo"], { cwd });
    expect(run.removed).toHaveLength(1);
    expect(existsSync(dir)).toBe(false);
  });
});
