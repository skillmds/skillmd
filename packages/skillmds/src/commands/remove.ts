// Removing a skill means three things: the per-agent links, the canonical copy
// and the lock entry. `-a` peels off one agent instead and keeps the canonical
// copy alive while any other agent still points at it.
import { Command } from "commander";
import { existsSync, rmSync, lstatSync } from "node:fs";
import { join } from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { agentDir } from "../agents.js";
import { listInstalled, uninstallSkill } from "../installer.js";
import { readLock, upsertEntry } from "../lock.js";
import { isInteractive, nonInteractiveHint } from "../env.js";

export interface RemoveFlags { global?: boolean; project?: boolean; agent?: string[]; all?: boolean; yes?: boolean; json?: boolean; cwd?: string; home?: string }
export interface RemoveDeps {
  confirm?: (msg: string) => Promise<boolean>;
  pick?: (ctx: { names: string[] }) => Promise<string[] | null>;
}
export interface RemoveResult { removed: string[]; exitCode: 0 | 1; output: string; cancelled?: boolean }

const defaultDeps = (flags: RemoveFlags): RemoveDeps => isInteractive(flags) ? {
  confirm: async (msg) => { const a = await p.confirm({ message: msg, initialValue: false }); return !p.isCancel(a) && a; },
  pick: async ({ names }) => { const a = await p.multiselect({ message: "Which skills do you want to remove?", options: names.map((n) => ({ value: n, label: n })), required: true }); return p.isCancel(a) ? null : (a as string[]); },
} : {};

/** The installer's rule, mirrored: a path is ours to delete only if it is a
 *  link or a directory that actually holds a SKILL.md. Anything else under an
 *  agent dir is the user's data, never ours. */
function isSkillPath(pth: string): boolean {
  try {
    const st = lstatSync(pth);
    return st.isSymbolicLink() || (st.isDirectory() && existsSync(join(pth, "SKILL.md")));
  } catch { return false; }
}

export async function runRemove(names: string[], flags: RemoveFlags, deps: RemoveDeps = defaultDeps(flags)): Promise<RemoveResult> {
  const scope = { global: Boolean(flags.global), cwd: flags.cwd, home: flags.home };
  const lines: string[] = [];
  if (flags.all && names.length) return { removed: [], exitCode: 1, output: pc.red("--all cannot be combined with skill names") };

  const installed = listInstalled(scope);
  let targets = names;
  if (flags.all) targets = installed.map((s) => s.name);
  else if (targets.length === 0) {
    if (!deps.pick) return { removed: [], exitCode: 1, output: pc.red("Give one or more skill names, or --all. ") + pc.dim(nonInteractiveHint("skill names and -y")) };
    if (installed.length === 0) return { removed: [], exitCode: 1, output: pc.dim("No installed skills found in this scope.") };
    const picked = await deps.pick({ names: installed.map((s) => s.name) });
    if (!picked) return { removed: [], exitCode: 0, cancelled: true, output: pc.dim("Nothing removed.") };
    targets = picked;
  }

  const known = targets.filter((n) => installed.some((s) => s.name === n));
  const missing = targets.filter((n) => !known.includes(n));
  for (const n of missing) lines.push(pc.yellow(`- ${n} not installed (${scope.global ? "global" : "project"} scope)`));
  if (known.length === 0) return { removed: [], exitCode: 1, output: lines.join("\n") };

  if (!flags.yes) {
    const what = flags.agent?.length ? `from ${flags.agent.join(", ")}` : "from every agent";
    const ok = deps.confirm ? await deps.confirm(`Remove ${known.length} skill${known.length === 1 ? "" : "s"} (${known.join(", ")}) ${what}?`) : null;
    if (ok === null) return { removed: [], exitCode: 1, output: pc.red(nonInteractiveHint("-y")) };
    if (!ok) return { removed: [], exitCode: 0, cancelled: true, output: pc.dim("Nothing removed.") };
  }

  const removed: string[] = [];
  for (const name of known) {
    if (flags.agent?.length) {
      const lock = readLock(scope);
      const entry = lock.skills[name];
      for (const a of flags.agent) {
        let pth: string;
        try {
          pth = join(agentDir(a, scope), name);
        } catch (e) {
          lines.push(pc.yellow(`- ${a}: ${e instanceof Error ? e.message : String(e)}`));
          continue;
        }
        // rmSync on a junction/symlink unlinks it without touching the target.
        if (isSkillPath(pth)) { rmSync(pth, { recursive: true, force: true }); removed.push(pth); lines.push(pc.green(`✓ removed ${name} from ${a}`)); }
      }
      if (entry) {
        const left = entry.agents.filter((a) => !flags.agent!.includes(a));
        if (left.length) upsertEntry(scope, name, { ...entry, agents: left, mode: Object.fromEntries(Object.entries(entry.mode).filter(([a]) => left.includes(a))) });
        else { const r = uninstallSkill(name, scope); removed.push(...r.removed); lines.push(pc.dim(`  (no agents left — removed the canonical copy too)`)); }
      }
      continue;
    }
    const r = uninstallSkill(name, scope);
    removed.push(...r.removed);
    lines.push(pc.green(`✓ removed ${name}`) + pc.dim(` (${r.removed.length} path${r.removed.length === 1 ? "" : "s"}${r.untracked ? ", untracked" : ""})`));
  }
  const exitCode: 0 | 1 = removed.length ? 0 : 1;
  if (flags.json) return { removed, exitCode, output: JSON.stringify({ ok: exitCode === 0, removed, missing }, null, 2) };
  return { removed, exitCode, output: lines.join("\n") };
}

export function removeCommand(): Command {
  return new Command("remove").alias("rm")
    .description("Remove installed skills (links, canonical copy and lock entry)")
    .argument("[names...]", "skill names (omit to pick interactively)")
    .option("-g, --global", "user-level scope (default: this project)")
    .option("-a, --agent <agents...>", "remove only from these agents")
    .option("--all", "remove every skill in the scope")
    .option("-y, --yes", "skip the confirmation")
    .option("--json", "machine-readable output")
    .action(async (names: string[], opts: RemoveFlags, cmd: Command) => {
      const run = await runRemove(names, { ...cmd.parent?.opts(), ...opts });
      console.log(run.output);
      process.exitCode = run.exitCode;
    });
}
