// Removing a skill means three things: the per-agent links, the canonical copy
// and the lock entry. `-a` peels off one agent instead and keeps the canonical
// copy alive while any other agent still points at it.
import { Command } from "commander";
import { rmSync } from "node:fs";
import { join, resolve } from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { agentDir, canonicalDir } from "../agents.js";
import type { ScopeOptions } from "../agents.js";
import { isSkillDirOrLink, listInstalled, uninstallSkill } from "../installer.js";
import { readLock, upsertEntry } from "../lock.js";
import { isInteractive, nonInteractiveHint, scopesFor } from "../env.js";
import { GLYPH } from "../ui.js";

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

/** Every return path is one document in --json mode: the human lines never leak
 *  into stdout that a caller is parsing. */
function finish(flags: RemoveFlags, result: RemoveResult, doc: unknown): RemoveResult {
  return flags.json ? { ...result, output: JSON.stringify(doc, null, 2) } : result;
}

const scopeLabel = (scope: ScopeOptions): "global" | "project" => scope.global ? "global" : "project";

export async function runRemove(names: string[], flags: RemoveFlags, deps: RemoveDeps = defaultDeps(flags)): Promise<RemoveResult> {
  const scopes: ScopeOptions[] = scopesFor(flags).map((global) => ({ global, cwd: flags.cwd, home: flags.home }));
  const where = scopes.map(scopeLabel).join(" and ");
  const lines: string[] = [];
  if (flags.all && names.length) {
    const error = "--all cannot be combined with skill names";
    return finish(flags, { removed: [], exitCode: 1, output: pc.red(error) }, { ok: false, error });
  }

  const perScope = scopes.map((scope) => ({ scope, installed: listInstalled(scope) }));
  const allNames = [...new Set(perScope.flatMap((s) => s.installed.map((i) => i.name)))];
  const nothingInstalled = `No installed skills found in ${where} scope.`;
  let targets = names;
  if (flags.all) {
    // Without this, an empty scope fell through to `known.length === 0` and
    // printed a blank line before exiting 1 — say what happened instead.
    if (allNames.length === 0) {
      return finish(flags, { removed: [], exitCode: 1, output: pc.dim(nothingInstalled) }, { ok: false, error: nothingInstalled });
    }
    targets = allNames;
  } else if (targets.length === 0) {
    if (!deps.pick) {
      const error = "Give one or more skill names, or --all.";
      return finish(flags, { removed: [], exitCode: 1, output: pc.red(`${error} `) + pc.dim(nonInteractiveHint("skill names and -y")) }, { ok: false, error });
    }
    if (allNames.length === 0) {
      return finish(flags, { removed: [], exitCode: 1, output: pc.dim(nothingInstalled) }, { ok: false, error: nothingInstalled });
    }
    const picked = await deps.pick({ names: allNames });
    if (!picked) return finish(flags, { removed: [], exitCode: 0, cancelled: true, output: pc.dim("Nothing removed.") }, { ok: true, removed: [], cancelled: true });
    targets = picked;
  }

  const known = targets.filter((n) => allNames.includes(n));
  const missing = targets.filter((n) => !known.includes(n));
  for (const n of missing) lines.push(pc.yellow(`- ${n} not installed (${where} scope)`));
  if (known.length === 0) {
    const output = lines.join("\n");
    return finish(flags, { removed: [], exitCode: 1, output }, { ok: false, error: `not installed: ${missing.join(", ")}`, missing });
  }

  if (!flags.yes) {
    const what = flags.agent?.length ? `from ${flags.agent.join(", ")}` : "from every agent";
    const ok = deps.confirm ? await deps.confirm(`Remove ${known.length} skill${known.length === 1 ? "" : "s"} (${known.join(", ")}) ${what} in ${where} scope?`) : null;
    if (ok === null) {
      const error = nonInteractiveHint("-y");
      return finish(flags, { removed: [], exitCode: 1, output: pc.red(error) }, { ok: false, error });
    }
    if (!ok) return finish(flags, { removed: [], exitCode: 0, cancelled: true, output: pc.dim("Nothing removed.") }, { ok: true, removed: [], cancelled: true });
  }

  const removed: string[] = [];
  const skipped: { skill: string; agent: string; scope: string; reason: string }[] = [];
  let changed = 0;
  for (const name of known) {
    for (const { scope, installed } of perScope) {
      if (!installed.some((s) => s.name === name)) continue;
      const tag = scopes.length > 1 ? pc.dim(` [${scopeLabel(scope)}]`) : "";
      if (flags.agent?.length) {
        const lock = readLock({ global: Boolean(scope.global), cwd: scope.cwd, home: scope.home });
        const entry = lock.skills[name];
        const canonRoot = resolve(canonicalDir(scope));
        let acted = false;
        for (const a of flags.agent) {
          let dir: string;
          try {
            dir = agentDir(a, scope);
          } catch (e) {
            lines.push(pc.yellow(`- ${a}: ${e instanceof Error ? e.message : String(e)}`));
            continue;
          }
          // The canonical copy is the skill itself, not a link into an agent dir:
          // deleting it here would take the skill away from every other agent.
          if (resolve(dir) === canonRoot || entry?.mode[a] === "canonical") {
            lines.push(pc.dim(`${GLYPH.skip} ${name}: ${a} reads the canonical copy directly — unlinking is a no-op (use remove without -a to delete the skill)`));
            skipped.push({ skill: name, agent: a, scope: scopeLabel(scope), reason: "reads the canonical copy directly" });
            acted = true;
            continue;
          }
          const pth = join(dir, name);
          // rmSync on a junction/symlink unlinks it without touching the target.
          if (isSkillDirOrLink(pth)) {
            rmSync(pth, { recursive: true, force: true });
            removed.push(pth);
            acted = true;
            lines.push(pc.green(`${GLYPH.ok} removed ${name} from ${a}`) + tag);
          }
        }
        if (!acted) lines.push(pc.yellow(`- ${name} is not linked into ${flags.agent.join(", ")}`) + tag);
        if (entry) {
          const left = entry.agents.filter((a) => !flags.agent!.includes(a));
          if (left.length) upsertEntry({ global: Boolean(scope.global), cwd: scope.cwd, home: scope.home }, name, { ...entry, agents: left, mode: Object.fromEntries(Object.entries(entry.mode).filter(([a]) => left.includes(a))) });
          else {
            const r = uninstallSkill(name, scope);
            removed.push(...r.removed);
            lines.push(pc.dim(`  (no agents left — removed the canonical copy too)`));
          }
        }
        if (acted) changed++;
        continue;
      }
      const r = uninstallSkill(name, scope);
      removed.push(...r.removed);
      changed++;
      lines.push(pc.green(`${GLYPH.ok} removed ${name}`) + tag + pc.dim(` (${r.removed.length} path${r.removed.length === 1 ? "" : "s"}${r.untracked ? ", untracked" : ""})`));
    }
  }
  const exitCode: 0 | 1 = changed ? 0 : 1;
  const doc: Record<string, unknown> = { ok: exitCode === 0, removed, missing };
  if (skipped.length) doc.skipped = skipped;
  return finish(flags, { removed, exitCode, output: lines.join("\n") }, doc);
}

export function removeCommand(): Command {
  return new Command("remove").alias("rm")
    .description("Remove installed skills (links, canonical copy and lock entry)")
    .argument("[names...]", "skill names (omit to pick interactively)")
    .option("-g, --global", "only user-level skills")
    .option("-p, --project", "only this project's skills")
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
