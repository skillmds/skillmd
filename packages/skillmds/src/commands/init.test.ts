import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initSkill } from "./init.js";
import { lint } from "@skillmds/core";

const tmps: string[] = [];
function tmp(): string { const d = mkdtempSync(join(tmpdir(), "skillmd-init-")); tmps.push(d); return d; }
afterEach(() => { for (const d of tmps.splice(0)) rmSync(d, { recursive: true, force: true }); });

describe("initSkill", () => {
  it("scaffolds a SKILL.md that lints with zero errors", () => {
    const dir = tmp();
    const file = initSkill("my-skill", { dir });
    const raw = readFileSync(file, "utf8");
    const result = lint(raw, { slug: "my-skill" });
    expect(result.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    expect(result.ok).toBe(true);
  });
});
