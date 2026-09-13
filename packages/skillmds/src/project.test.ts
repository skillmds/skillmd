import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { looksLikeProject } from "./project.js";

const tmps: string[] = [];
function tmp(): string { const d = mkdtempSync(join(tmpdir(), "skillmd-project-")); tmps.push(d); return d; }
afterEach(() => { for (const d of tmps.splice(0)) rmSync(d, { recursive: true, force: true }); });

describe("looksLikeProject", () => {
  it("treats an existing agent dot-dir as a project marker", () => {
    const cwd = tmp();
    expect(looksLikeProject(cwd)).toBe(false);
    mkdirSync(join(cwd, ".cursor"));
    expect(looksLikeProject(cwd)).toBe(true);
  });

  it("recognises legacy agent roots via projectRoots (.codex, .kilocode)", () => {
    const cwd = tmp(); mkdirSync(join(cwd, ".codex"));
    expect(looksLikeProject(cwd)).toBe(true);
    const cwd2 = tmp(); mkdirSync(join(cwd2, ".kilocode"));
    expect(looksLikeProject(cwd2)).toBe(true);
  });
});
