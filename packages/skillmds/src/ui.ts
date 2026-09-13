// Shared terminal decoration, rendering, and exit-code policy for quality commands.
import { homedir } from "node:os";
import { relative, resolve, sep } from "node:path";
import pc from "picocolors";
import type { LintResult, Severity } from "@skillmds/core";
import type { InstallTarget } from "./installer.js";

/** Where to measure a path from when shortening it for display. */
export interface PathCtx { home?: string; cwd?: string }

export const decorate = (text: string, kind: Severity | "ok" | "dim"): string => {
  switch (kind) {
    case "error": return pc.red(text);
    case "warn": return pc.yellow(text);
    case "info": return pc.cyan(text);
    case "ok": return pc.green(text);
    case "dim": return pc.dim(text);
  }
};

const SEV_COLOR: Record<Severity, (s: string) => string> = {
  error: pc.red,
  warn: pc.yellow,
  info: pc.cyan,
};

/**
 * One vocabulary of marks for the whole CLI, so "skipped" looks the same in
 * `add` as it does in a lint report. Emoji glyphs are double-width — ALWAYS
 * follow them with a space so they don't overlap the next character.
 *
 * TODO: remove.ts and update.ts still hard-code their own ✓/↷/✗; fold them onto
 * GLYPH too (left alone here — those files have other owners in flight).
 */
export const GLYPH: Record<Severity | "ok" | "skip" | "blocked" | "replaced", string> = {
  error: "✖",
  warn: "⚠",
  info: "ℹ",
  ok: "✓",
  skip: "↷",
  blocked: "✗",
  replaced: "⚠",
};
const SEC_GLYPH = "⚑";

const SEV_ORDER: Severity[] = ["error", "warn", "info"];

// Group a skill's diagnostics by severity: one emoji per group + its rule ids.
// e.g. "✖ SK001   ⚠ SK011 SK040"
function chips(result: LintResult): string {
  const bySev: Record<Severity, string[]> = { error: [], warn: [], info: [] };
  for (const d of result.diagnostics) bySev[d.severity].push(d.id);
  return SEV_ORDER.filter((s) => bySev[s].length)
    .map((s) => `${GLYPH[s]} ${SEV_COLOR[s](bySev[s].join(" "))}`)
    .join("   ");
}

// Readable labels for security flags.
const SEC_LABEL: Record<string, string> = {
  network_calls: "Calls Network",
  executes_scripts: "Executes Scripts",
  reads_secrets: "Reads Secrets",
};

const titleCase = (flag: string) => flag.split("_").map((w) => w[0]!.toUpperCase() + w.slice(1)).join(" ");

const scoreColor = (s: number) => (s >= 80 ? pc.green : s >= 50 ? pc.yellow : pc.red);

// Short label: the skill's folder name, not the full path to SKILL.md.
function label(file: string): string {
  const parts = file.split(/[\\/]/).filter(Boolean);
  const i = parts.lastIndexOf("SKILL.md");
  return i > 0 ? parts[i - 1]! : parts[parts.length - 1] || file;
}

function securityFlags(result: LintResult): string[] {
  return result.security.flags.filter((f) => f !== "docs_only");
}

// Each flag rendered as its own "⚑ Label", space-separated.
function secLabels(result: LintResult): string {
  const flags = securityFlags(result);
  return flags.map((f) => pc.magenta(`${SEC_GLYPH} ${SEC_LABEL[f] ?? titleCase(f)}`)).join("  ");
}

function statusDot(result: LintResult): string {
  if (!result.ok) return pc.red("●");
  // Yellow when there's something to look at: warnings OR risky behaviour.
  const attention = result.diagnostics.some((d) => d.severity === "warn") || securityFlags(result).length > 0;
  return attention ? pc.yellow("●") : pc.green("●");
}

// A focused block for one failing skill: rule + message + full path (what/where/why).
function failureBlock(file: string, result: LintResult): string {
  const lines = [`${pc.red(GLYPH.error)} ${pc.bold(label(file))}`];
  for (const d of result.diagnostics.filter((x) => x.severity === "error")) {
    const loc = d.line !== undefined ? pc.dim(`:${d.line}`) : "";
    lines.push(`    ${SEV_COLOR.error(d.id)}${loc}  ${d.message}`);
  }
  lines.push(`    ${pc.dim(file)}`);
  return lines.join("\n");
}

// Detailed view — used when linting a single skill (room to show messages).
function renderOne(file: string, result: LintResult): string {
  const status = result.ok ? pc.green("● PASS") : pc.red("● FAIL");
  const out = [`${status}  ${pc.bold(label(file))}  ${pc.dim("quality")} ${scoreColor(result.score)(`${result.score}/100`)}`];
  for (const d of result.diagnostics) {
    const loc = d.line !== undefined ? pc.dim(`:${d.line}`) : "";
    out.push(`  ${GLYPH[d.severity]} ${SEV_COLOR[d.severity](d.id)}${loc}  ${d.message}`);
  }
  const sec = secLabels(result);
  if (sec) out.push(`  ${sec}`);
  return out.join("\n");
}

// Compact view — one line per skill when linting many. Aligned columns:
//   <dot> <score>  <name>  <rule ids>   <security codes>
function renderMany(results: { file: string; result: LintResult }[]): string {
  const names = results.map((r) => label(r.file));
  const w = Math.min(32, Math.max(4, ...names.map((n) => n.length)));
  const out: string[] = [];
  let anySec = false;

  results.forEach(({ result }, i) => {
    const score = scoreColor(result.score)(String(result.score).padStart(3));
    const nm = names[i]!;
    const name = (nm.length > w ? nm.slice(0, w - 1) + "…" : nm).padEnd(w);
    const secStr = secLabels(result);
    if (secStr) anySec = true;
    const sec = secStr ? `   ${secStr}` : "";
    out.push(`${statusDot(result)} ${score}  ${name}  ${chips(result)}${sec}`.trimEnd());
  });

  const failed = results.filter((r) => !r.result.ok).length;
  const warned = results.filter((r) => r.result.ok && r.result.diagnostics.some((d) => d.severity === "warn")).length;
  const clean = results.length - failed - warned;
  const avg = Math.round(results.reduce((s, r) => s + r.result.score, 0) / results.length);

  out.push("");
  const parts = [pc.green(`${clean} clean`)];
  if (warned) parts.push(pc.yellow(`${warned} warn`));
  if (failed) parts.push(pc.red(`${failed} fail`));
  out.push(`${parts.join(pc.dim(" · "))}   ${pc.dim("avg score")} ${scoreColor(avg)(`${avg}/100`)}`);
  if (anySec) out.push(pc.dim(`${SEC_GLYPH} = risky behaviour, factored into the score alongside spec correctness and completeness`));

  // Surface the failures at the bottom so they don't scroll off in a big run.
  const fails = results.filter((r) => !r.result.ok);
  if (fails.length) {
    out.push("");
    out.push(pc.red(pc.bold(`Failed (${fails.length}):`)));
    for (const f of fails.slice(0, 25)) out.push(failureBlock(f.file, f.result));
    if (fails.length > 25) out.push(pc.dim(`  …and ${fails.length - 25} more — run with --errors-only to see all`));
  }
  return out.join("\n");
}

// Failures-only view (skips the clean/warn list entirely).
function renderFailuresView(results: { file: string; result: LintResult }[]): string {
  const fails = results.filter((r) => !r.result.ok);
  if (!fails.length) return pc.green(`${GLYPH.ok} No failures across ${results.length} skill${results.length === 1 ? "" : "s"}.`);
  const out = fails.map((f) => failureBlock(f.file, f.result));
  out.push("");
  out.push(`${pc.red(`${fails.length} failed`)} ${pc.dim(`of ${results.length}`)}`);
  return out.join("\n");
}

export function renderReport(
  results: { file: string; result: LintResult }[],
  opts: { errorsOnly?: boolean } = {},
): string {
  if (results.length === 0) return pc.dim("No skills found.");
  if (opts.errorsOnly) return renderFailuresView(results);
  if (results.length === 1) return renderOne(results[0]!.file, results[0]!.result);
  return renderMany(results);
}

export interface GatePolicy {
  strict?: boolean;
  failOnWarning?: boolean;
}

/** Returns 0 (pass) or 1 (fail) per the gate policy. */
export function exitCodeFor(results: { result: LintResult }[], policy: GatePolicy = {}): 0 | 1 {
  for (const { result } of results) {
    const hasError = result.diagnostics.some((d) => d.severity === "error");
    const hasWarn = result.diagnostics.some((d) => d.severity === "warn");
    if (hasError) return 1;
    if ((policy.strict || policy.failOnWarning) && hasWarn) return 1;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Install reporting — the shared vocabulary for "here is what just landed on
// disk". Path shortening, column alignment and the summary block live here so
// add/update/remove all describe an install the same way.
// ---------------------------------------------------------------------------

/** ~/… for home-rooted paths, ./… for cwd-rooted paths, forward slashes. The
 *  roots themselves are "." and "~" — never "./" or "~/". */
export function shortPath(p: string, ctx: PathCtx = {}): string {
  const home = resolve(ctx.home ?? homedir());
  const cwd = resolve(ctx.cwd ?? process.cwd());
  const abs = resolve(p);
  const norm = (s: string) => s.split(sep).join("/");
  // cwd wins over home: inside a project, "./…" is the more useful address even
  // though the project also sits under $HOME.
  if (abs === cwd) return ".";
  if (abs.startsWith(cwd + sep)) return `./${norm(relative(cwd, abs))}`;
  if (abs === home) return "~";
  if (abs.startsWith(home + sep)) return `~/${norm(relative(home, abs))}`;
  return norm(abs);
}

const SGR = /\x1b\[[0-9;]*m/g;
/** Same pattern, sticky: matches only at an exact offset, so the walk below
 *  can't disturb (or be disturbed by) the global one's lastIndex. */
const SGR_AT = /\x1b\[[0-9;]*m/y;
const RESET = "\x1b[0m";

/** The text with every SGR escape removed — what a terminal actually shows. */
export function stripAnsi(s: string): string {
  return s.replace(SGR, "");
}

const visible = (s: string) => stripAnsi(s).length;

/**
 * Cut `s` to at most `max` VISIBLE characters, keeping its escape sequences
 * intact. A plain `slice()` would happily cut through the middle of an escape
 * and spill raw `[2m` into the terminal — or leave a colour open for the rest
 * of the screen — so styles are copied through whole and a reset is re-appended
 * when the cut lands inside one.
 */
export function truncateVisible(s: string, max: number): string {
  if (max <= 0) return "";
  if (visible(s) <= max) return s;
  let out = "";
  let shown = 0;
  let open = false;
  for (let i = 0; i < s.length && shown < max - 1;) {
    if (s[i] === "\x1b") {
      SGR_AT.lastIndex = i;
      const m = SGR_AT.exec(s);
      if (m) {
        out += m[0];
        open = m[0] !== RESET && m[0] !== "\x1b[m";
        i += m[0].length;
        continue;
      }
    }
    out += s[i];
    shown++;
    i++;
  }
  return out + "…" + (open ? RESET : "");
}

const termWidth = (w?: number): number => w ?? Math.min(process.stdout.columns ?? 100, 120);

/**
 * Left-aligned columns. Every column but the last is padded to its widest cell;
 * the last is truncated so the line stays inside `width`. Widths are measured
 * on the VISIBLE text, so coloured cells still line up.
 */
export function table(rows: string[][], opts: { width?: number; indent?: string } = {}): string {
  if (rows.length === 0) return "";
  const width = termWidth(opts.width);
  const indent = opts.indent ?? "";
  const cols = Math.max(...rows.map((r) => r.length));
  const widths = Array.from({ length: cols }, (_, i) => Math.max(...rows.map((r) => visible(r[i] ?? ""))));
  return rows.map((r) => {
    let line = indent;
    for (let i = 0; i < cols; i++) {
      const cell = r[i] ?? "";
      if (i < cols - 1) { line += cell + " ".repeat(widths[i]! - visible(cell) + 2); continue; }
      line += truncateVisible(cell, Math.max(4, width - visible(line)));
    }
    line = line.trimEnd();
    // The 4-column floor above can still overshoot on a very narrow terminal —
    // the budget is a promise, so clamp the finished line too.
    return visible(line) > width ? truncateVisible(line, width) : line;
  }).join("\n");
}

export interface InstallSummaryInput {
  name: string;
  score: number;
  flags: string[];
  source: string;
  canonical: string;
  targets: InstallTarget[];
  skipped: { agent: string; reason: string }[];
  /** Source of the install this one replaced, or "untracked". */
  replaced?: string;
}

/** The block printed for one installed skill: what landed, where, and how. */
export function renderInstallSummary(i: InstallSummaryInput, ctx: PathCtx & { width?: number } = {}): string {
  const width = termWidth(ctx.width);
  // A `local:` source carries an absolute path that on its own can be wider
  // than the terminal; shorten it the same way the target paths are shortened.
  const src = i.source.startsWith("local:") ? `local:${shortPath(i.source.slice(6), ctx)}` : i.source;
  const head = truncateVisible(
    pc.green(`${GLYPH.ok} ${i.name}`) + pc.dim(`  score ${i.score}${i.flags.length ? `  ${i.flags.join(", ")}` : ""}  from ${src}`),
    width,
  );
  // Agents sharing one physical path (the .agents/skills convention) collapse
  // into one row — "warp, cline  canonical  ~/.agents/skills/x".
  const byPath = new Map<string, { agents: string[]; mode: string }>();
  for (const t of i.targets) {
    const e = byPath.get(t.path);
    if (e) e.agents.push(t.agent);
    else byPath.set(t.path, { agents: [t.agent], mode: t.mode });
  }
  // Path last on purpose: table() truncates the final column, and the path is
  // the one cell that can be sacrificed without losing which agent got what.
  const rows = [...byPath.entries()].map(([path, e]) => [pc.cyan(e.agents.join(", ")), pc.dim(e.mode), shortPath(path, ctx)]);
  const body = rows.length
    ? table(rows, { width, indent: "  " })
    : truncateVisible(pc.dim(`  ${shortPath(i.canonical, ctx)}  canonical only`), width);
  const skipped = i.skipped.map((s) => truncateVisible(pc.dim(`  ${GLYPH.skip} ${s.agent}: ${s.reason}`), width));
  const replaced = i.replaced
    ? [truncateVisible(pc.yellow(`  ${GLYPH.replaced} replaced previous install (${i.replaced === "untracked" ? "untracked directory" : i.replaced})`), width)]
    : [];
  return [head, body, ...skipped, ...replaced].join("\n");
}

export const banner = (): string => pc.bgCyan(pc.black(" skillmd "));
