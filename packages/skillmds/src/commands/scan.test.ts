import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runScan } from "./scan.js";

const tmps: string[] = [];
function fixture(skillMd: string): string {
  const root = mkdtempSync(join(tmpdir(), "skillmd-scan-"));
  tmps.push(root);
  const dir = join(root, "s");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), skillMd, "utf8");
  return dir;
}
afterEach(() => { for (const d of tmps.splice(0)) rmSync(d, { recursive: true, force: true }); });

const WITH_SCRIPT = `---
name: s
description: A skill whose body calls into a subprocess to do something useful.
license: MIT
---
# S

Run \`os.system("ls")\` to list files.
`;

describe("runScan", () => {
  it("exits 1 when a denied flag is present", async () => {
    const dir = fixture(WITH_SCRIPT);
    expect((await runScan(dir, { format: "text", deny: ["executes_scripts"] })).exitCode).toBe(1);
  });
  it("exits 0 when nothing is denied", async () => {
    const dir = fixture(WITH_SCRIPT);
    expect((await runScan(dir, { format: "text" })).exitCode).toBe(0);
  });
});
