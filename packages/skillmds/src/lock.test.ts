import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readLock, writeLock, upsertEntry, removeEntry, lockPath } from "./lock.js";
import type { LockEntry } from "./lock.js";

const tmps: string[] = [];
const tmp = () => { const d = mkdtempSync(join(tmpdir(), "skillmd-lock-")); tmps.push(d); return d; };
afterEach(() => { for (const d of tmps.splice(0)) rmSync(d, { recursive: true, force: true }); });

const entry = (over: Partial<LockEntry> = {}): LockEntry => ({
  source: "registry:o/n", agents: ["claude-code"], mode: { "claude-code": "junction" }, ...over,
});

describe("lock files", () => {
  it("project lock lives at <root>/skills-lock.json, global at <home>/.skillmd/lock.json", () => {
    expect(lockPath({ global: false, cwd: "/p" })).toBe(join("/p", "skills-lock.json"));
    expect(lockPath({ global: true, home: "/h" })).toBe(join("/h", ".skillmd", "lock.json"));
  });
  it("reads an empty lock when the file is missing", () => {
    expect(readLock({ global: false, cwd: tmp() })).toEqual({ version: 1, skills: {} });
  });
  it("round-trips entries with sorted keys and no timestamps in project scope", () => {
    const cwd = tmp();
    const scope = { global: false, cwd };
    upsertEntry(scope, "zeta", entry());
    upsertEntry(scope, "alpha", entry({ source: "github:o/r#main", commit_sha: "abc", installedAt: "2026-01-01T00:00:00Z" }));
    const text = readFileSync(join(cwd, "skills-lock.json"), "utf8");
    expect(text.indexOf('"alpha"')).toBeLessThan(text.indexOf('"zeta"'));
    expect(text).not.toContain("installedAt");
    expect(readLock(scope).skills.alpha?.commit_sha).toBe("abc");
  });
  it("keeps timestamps in global scope", () => {
    const home = tmp();
    const scope = { global: true, home };
    upsertEntry(scope, "x", entry({ installedAt: "2026-01-01T00:00:00Z" }));
    expect(readLock(scope).skills.x?.installedAt).toBe("2026-01-01T00:00:00Z");
  });
  it("removeEntry deletes the key and reports whether it existed", () => {
    const scope = { global: false, cwd: tmp() };
    upsertEntry(scope, "x", entry());
    expect(removeEntry(scope, "x")).toBe(true);
    expect(removeEntry(scope, "x")).toBe(false);
    expect(readLock(scope).skills).toEqual({});
  });
  it("a corrupt lock is backed up, warned about, and treated as empty", () => {
    const cwd = tmp();
    writeFileSync(join(cwd, "skills-lock.json"), "{ not json", "utf8");
    const warnings: string[] = [];
    const lock = readLock({ global: false, cwd }, { warn: (m) => warnings.push(m) });
    expect(lock.skills).toEqual({});
    expect(warnings[0]).toMatch(/could not parse/);
    writeLock({ global: false, cwd }, lock);
    expect(existsSync(join(cwd, "skills-lock.json.bak"))).toBe(true);
  });
});

describe("lock files: refusing to silently discard", () => {
  it("upsertEntry warns before rewriting a corrupt lock, and still writes the entry", () => {
    const cwd = tmp();
    const scope = { global: false, cwd };
    writeFileSync(join(cwd, "skills-lock.json"), "{ not json", "utf8");
    const warnings: string[] = [];
    upsertEntry(scope, "x", entry(), { warn: (m) => warnings.push(m) });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/could not parse/);
    expect(readLock(scope).skills.x?.source).toBe("registry:o/n");
    expect(existsSync(join(cwd, "skills-lock.json.bak"))).toBe(true);
  });

  it("removeEntry warns before rewriting a corrupt lock", () => {
    const cwd = tmp();
    const scope = { global: false, cwd };
    writeFileSync(join(cwd, "skills-lock.json"), "{ not json", "utf8");
    const warnings: string[] = [];
    expect(removeEntry(scope, "x", { warn: (m) => warnings.push(m) })).toBe(false);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/could not parse/);
  });

  it("an unknown lock version is treated as unreadable, not as an empty lock", () => {
    const cwd = tmp();
    const scope = { global: false, cwd };
    writeFileSync(join(cwd, "skills-lock.json"), JSON.stringify({ version: 2, skills: { a: entry() } }), "utf8");
    const warnings: string[] = [];
    expect(readLock(scope, { warn: (m) => warnings.push(m) }).skills).toEqual({});
    expect(warnings[0]).toMatch(/unsupported lock version 2/);
    writeLock(scope, { version: 1, skills: {} });
    expect(existsSync(join(cwd, "skills-lock.json.bak"))).toBe(true);
  });

  it("a skills array is rejected rather than read as a record", () => {
    const cwd = tmp();
    const scope = { global: false, cwd };
    writeFileSync(join(cwd, "skills-lock.json"), JSON.stringify({ version: 1, skills: [] }), "utf8");
    const warnings: string[] = [];
    expect(readLock(scope, { warn: (m) => warnings.push(m) }).skills).toEqual({});
    expect(warnings[0]).toMatch(/could not parse/);
  });

  it("a failed rename leaves no temp file behind", () => {
    const cwd = tmp();
    mkdirSync(join(cwd, "skills-lock.json"));
    expect(() => writeLock({ global: false, cwd }, { version: 1, skills: { x: entry() } })).toThrow();
    expect(readdirSync(cwd).filter((f) => f.startsWith("skills-lock.json.tmp-"))).toEqual([]);
  });

  it("upsertEntry keeps the original install date across re-installs", () => {
    const home = tmp();
    const scope = { global: true, home };
    upsertEntry(scope, "x", entry({ installedAt: "2026-01-01T00:00:00Z" }));
    upsertEntry(scope, "x", entry({ installedAt: "2026-06-06T00:00:00Z" }));
    expect(readLock(scope).skills.x?.installedAt).toBe("2026-01-01T00:00:00Z");
  });
});
