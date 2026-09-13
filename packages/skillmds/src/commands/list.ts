// What is installed, where did it come from, and how is it linked? One row per
// skill across both scopes, reading the lock for provenance and the SKILL.md on
// disk for the description (untrusted text — always through safeText).
import { Command } from "commander";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pc from "picocolors";
import { parseSkillMd } from "@skillmds/core";
import { listInstalled } from "../installer.js";
import type { InstalledSkillInfo } from "../installer.js";
import { safeText } from "../sanitize.js";
import { scopesFor } from "../env.js";

export interface ListFlags { global?: boolean; project?: boolean; agent?: string[]; json?: boolean; cwd?: string; home?: string }
export interface ListItem extends InstalledSkillInfo { description: string }

export function runList(flags: ListFlags = {}): { items: ListItem[]; output: string } {
  const scopes = scopesFor(flags);
  let items: ListItem[] = [];
  for (const global of scopes) {
    for (const s of listInstalled({ global, cwd: flags.cwd, home: flags.home })) {
      const md = join(s.path, "SKILL.md");
      let description = "";
      if (existsSync(md)) {
        const parsed = parseSkillMd(readFileSync(md, "utf8"));
        description = "error" in parsed ? `(invalid SKILL.md — ${parsed.error})` : parsed.description;
      }
      items.push({ ...s, description: safeText(description, 80) });
    }
  }
  if (flags.agent?.length) items = items.filter((i) => i.agents.some((a) => flags.agent!.includes(a)));
  items.sort((a, b) => a.name.localeCompare(b.name) || a.scope.localeCompare(b.scope));
  if (flags.json) {
    return { items, output: JSON.stringify(items.map(({ name, scope, path, agents, source, mode, tracked, description }) => ({ name, scope, path, agents, source: source ?? null, mode, tracked, description })), null, 2) };
  }
  if (items.length === 0) return { items, output: pc.dim("No installed skills found. Install one with `skillmd add owner/name`.") };
  const w = Math.max(...items.map((i) => i.name.length), 4);
  const lines = items.map((i) => {
    const tag = i.tracked ? pc.dim(i.source ?? "") : pc.yellow("untracked");
    const modes = [...new Set(Object.values(i.mode))].join("/");
    return `${pc.bold(i.name.padEnd(w))}  ${pc.cyan(i.scope.padEnd(7))}  ${i.agents.join(", ").padEnd(24)}  ${pc.dim(modes.padEnd(9))}  ${tag}\n${" ".repeat(w + 2)}${pc.dim(i.description)}`;
  });
  return { items, output: lines.join("\n") };
}

export function listCommand(): Command {
  return new Command("list").alias("ls")
    .description("List installed skills (project and global) with their source and link mode")
    .option("-g, --global", "only user-level skills")
    .option("-p, --project", "only this project's skills")
    .option("-a, --agent <agents...>", "only skills linked into these agents")
    .option("--json", "machine-readable output")
    .action((opts: ListFlags, cmd: Command) => { console.log(runList({ ...cmd.parent?.opts(), ...opts }).output); });
}
