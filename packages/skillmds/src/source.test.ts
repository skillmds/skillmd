import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findSkillFiles, collectFiles } from "./source.js";

const tmps: string[] = [];
function tmp(): string { const d = mkdtempSync(join(tmpdir(), "skillmd-src-")); tmps.push(d); return d; }
afterEach(() => { for (const d of tmps.splice(0)) rmSync(d, { recursive: true, force: true }); });

describe("findSkillFiles", () => {
  it("returns [] for an unreadable/nonexistent directory instead of throwing", () => {
    expect(findSkillFiles(join(tmp(), "does-not-exist"))).toEqual([]);
  });

  it("finds nested SKILL.md files and skips ignored dirs", () => {
    const root = tmp();
    mkdirSync(join(root, "a"), { recursive: true });
    writeFileSync(join(root, "a", "SKILL.md"), "x");
    mkdirSync(join(root, "node_modules", "pkg"), { recursive: true });
    writeFileSync(join(root, "node_modules", "pkg", "SKILL.md"), "x"); // must be ignored
    const found = findSkillFiles(root);
    expect(found).toHaveLength(1);
    expect(found[0]).toContain(join("a", "SKILL.md"));
  });
});

describe("collectFiles", () => {
  it("returns every file with forward-slash relative paths, skipping .git", () => {
    const root = mkdtempSync(join(tmpdir(), "skillmd-tree-"));
    writeFileSync(join(root, "SKILL.md"), "x");
    mkdirSync(join(root, "assets"));
    writeFileSync(join(root, "assets", "a.md"), "y");
    mkdirSync(join(root, ".git"));
    writeFileSync(join(root, ".git", "HEAD"), "z");
    const files = collectFiles(root, root).map((f) => f.path).sort();
    expect(files).toEqual(["SKILL.md", "assets/a.md"]);
  });

  it("never follows symlinks (tarballs can smuggle links pointing outside the pack root)", () => {
    const root = mkdtempSync(join(tmpdir(), "skillmd-tree-"));
    tmps.push(root);
    writeFileSync(join(root, "SKILL.md"), "x");
    const outside = tmp();
    writeFileSync(join(outside, "secret.txt"), "top secret");
    try {
      symlinkSync(join(outside, "secret.txt"), join(root, "link.md"), "file");
    } catch {
      // Symlink creation needs elevation/Developer Mode on Windows; nothing to
      // assert if we can't create one. The lstat guard is still exercised above.
      return;
    }
    const files = collectFiles(root, root).map((f) => f.path);
    expect(files).toEqual(["SKILL.md"]);
    expect(files).not.toContain("link.md");
  });

  it("throws a clear error when the pack exceeds the file-count cap", () => {
    const root = mkdtempSync(join(tmpdir(), "skillmd-tree-"));
    tmps.push(root);
    writeFileSync(join(root, "a.md"), "1");
    writeFileSync(join(root, "b.md"), "2");
    writeFileSync(join(root, "c.md"), "3");
    expect(() => collectFiles(root, root, { maxFiles: 2 })).toThrow(/pack too large/);
    expect(collectFiles(root, root, { maxFiles: 3 })).toHaveLength(3);
  });

  it("throws a clear error when the pack exceeds the byte cap", () => {
    const root = mkdtempSync(join(tmpdir(), "skillmd-tree-"));
    tmps.push(root);
    writeFileSync(join(root, "big.md"), "x".repeat(64));
    expect(() => collectFiles(root, root, { maxBytes: 32 })).toThrow(/pack too large/);
  });
});
