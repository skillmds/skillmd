// Shared terminal decoration, rendering, and exit-code policy for quality commands.
import pc from "picocolors";
import type { LintResult, Severity } from "@skillmd/core";

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

// Emoji glyphs are double-width — ALWAYS follow them with a space so they don't
// overlap the next character.
const GLYPH: Record<Severity, string> = {
  error: "✖",
  warn: "⚠",
  info: "ℹ",
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
  const lines = [`${pc.red("✖")} ${pc.bold(label(file))}`];
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
  if (!fails.length) return pc.green(`✓ No failures across ${results.length} skill${results.length === 1 ? "" : "s"}.`);
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
