import { describe, it, expect } from "vitest";
import { installClaudePlugin, claudeCliAvailable, marketplacePluginName, MARKETPLACE_URL } from "./claudePlugin.js";

const ok = (stdout: string) => async () => ({ stdout, stderr: "" });

describe("claude plugin driver", () => {
  it("reports success from the output, not the exit code", async () => {
    const calls: string[][] = [];
    const exec = async (file: string, args: string[]) => {
      calls.push([file, ...args]);
      return { stdout: args[1] === "marketplace" ? "already on disk" : "Successfully installed plugin: docs-writing@skillmd", stderr: "" };
    };
    const res = await installClaudePlugin("skillmd", "docs-writing", { exec });
    expect(res).toEqual({ ok: true, name: "docs-writing@skillmd", marketplace: "skillmd" });
    // The marketplace is added every time: it is idempotent, so probing first
    // would be an extra call that can itself fail.
    expect(calls[0]).toEqual(["claude", "plugin", "marketplace", "add", MARKETPLACE_URL]);
    expect(calls[1]).toEqual(["claude", "plugin", "install", "docs-writing@skillmd"]);
  });

  // The real CLI exits 0 on this, which is the trap the whole module is built
  // around: a community plugin is not in the curated marketplace.
  it("treats 'not found in marketplace' as a failure despite exit 0", async () => {
    const exec = ok('Installing plugin "x@skillmd"...✘ Failed to install plugin "x@skillmd": Plugin "x" not found in marketplace "skillmd"');
    const res = await installClaudePlugin("skillmd", "x", { exec });
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.reason).toMatch(/not found in marketplace/);
  });

  it("fails softly when claude is not installed", async () => {
    const exec = async () => { throw new Error("spawn claude ENOENT"); };
    expect(await claudeCliAvailable({ exec })).toBe(false);
    const res = await installClaudePlugin("skillmd", "x", { exec });
    expect(res.ok).toBe(false);
  });

  it("does not claim success on unrecognised output", async () => {
    const res = await installClaudePlugin("skillmd", "x", { exec: ok("something else entirely") });
    expect(res.ok).toBe(false);
  });
});

describe("marketplace plugin names", () => {
  // Must match pluginName() in the site's pluginBundle.ts. A mismatch does not
  // error — it resolves to "not found in marketplace" and falls back silently.
  it("keeps the bare slug for curated plugins", () => {
    expect(marketplacePluginName("skillmd", "docs-writing")).toBe("docs-writing");
    expect(marketplacePluginName("SkillMD", "docs-writing")).toBe("docs-writing");
  });
  it("namespaces community plugins with their owner", () => {
    expect(marketplacePluginName("aliyun", "alibabacloud-aiops-skills")).toBe("aliyun-alibabacloud-aiops-skills");
  });
  it("kebab-cases both halves, as Claude Code requires", () => {
    expect(marketplacePluginName("Acme_Corp", "My Plugin!")).toBe("acme-corp-my-plugin");
    expect(marketplacePluginName("acme", "---")).toBe("acme-plugin");
  });
});
