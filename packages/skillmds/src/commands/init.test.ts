import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initSkill, runInit } from "./init.js";
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

describe("runInit non-interactive", () => {
  it("exits 1 with a hint when a name is needed and no prompt is available", async () => {
    const r = await runInit(undefined, { dir: tmp() }, {});
    expect(r.exitCode).toBe(1);
    expect(r.output).toMatch(/--name/);
  });
  it("--json returns the created path", async () => {
    const dir = tmp();
    const r = await runInit("My Skill", { dir, json: true, description: "Does a thing." }, {});
    expect(JSON.parse(r.output)).toMatchObject({ ok: true, file: expect.stringContaining("my-skill") });
  });
  it("a prompt answer is used when provided", async () => {
    const dir = tmp();
    const r = await runInit(undefined, { dir }, { prompt: async () => "Prompted" });
    expect(r.exitCode).toBe(0);
    expect(r.file).toContain("prompted");
  });
});
