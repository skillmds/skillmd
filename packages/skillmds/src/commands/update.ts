import { Command } from "commander";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import pc from "picocolors";
import { lint } from "@skillmd/core";
import { createClient, skillMdFor } from "../api.js";
import type { RegistrySkill } from "../api.js";
import { installedSkills } from "../agents.js";
import type { ScopeOptions, InstalledSkill } from "../agents.js";

interface UpdateFlags {
  global?: boolean;
  token?: string;
  api?: string;
}

// Re-fetch a registry skill by its installed name and rewrite SKILL.md if changed.
// Only skills whose name resolves to a registry slug are updated; local-only skills are skipped.
export async function runUpdate(names: string[], flags: UpdateFlags, scope: ScopeOptions = {}): Promise<{ updated: string[]; output: string }> {
  const { api } = createClient(flags);
  const installed = installedSkills(scope).filter((s) => names.length === 0 || names.includes(s.name));
  const updated: string[] = [];
  const lines: string[] = [];

  for (const s of installed) {
    const slug = await findRegistrySlug(api, s);
    if (!slug) { lines.push(pc.dim(`- ${s.name} skipped (no registry match)`)); continue; }
    try {
      const [owner, name] = slug.split("/");
      const skill = await api<RegistrySkill>(`/api/skills/${owner}/${name}`);
      const next = skillMdFor(skill);
      if (next.trim() === s.raw.trim()) { lines.push(pc.dim(`- ${s.name} already up to date`)); continue; }
      const result = lint(next, { slug: s.name });
      if (!result.ok) { lines.push(pc.red(`✗ ${s.name} update failed lint — skipped`)); continue; }
      writeFileSync(join(s.path, "SKILL.md"), next, "utf8");
      updated.push(s.name);
      lines.push(pc.green(`✓ updated ${s.name}`));
    } catch {
      lines.push(pc.red(`✗ ${s.name} update error`));
    }
  }
  return { updated, output: lines.join("\n") || "Nothing to update." };
}

async function findRegistrySlug(api: ReturnType<typeof createClient>["api"], s: InstalledSkill): Promise<string | null> {
  const r = await api<{ items?: { slug: string }[] }>(`/api/search?q=${encodeURIComponent(s.name)}&limit=5`).catch(() => null);
  const hit = r?.items?.find((it) => it.slug.split("/")[1] === s.name);
  return hit?.slug ?? null;
}

export function updateCommand(): Command {
  return new Command("update")
    .description("Update installed skills from the registry (re-lints before writing)")
    .argument("[names...]", "specific skills to update (default: all)")
    .option("-g, --global", "only global skills")
    .action(async (names: string[], opts: UpdateFlags, cmd: Command) => {
      const merged = { ...cmd.parent?.opts(), ...opts };
      const run = await runUpdate(names, merged, { global: opts.global });
      console.log(run.output);
    });
}
