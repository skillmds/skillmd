// Lint rule engine. Each rule is a pure function over a ParsedSkill that returns
// zero or more diagnostics. Rule IDs (SK0xx) are stable and referenced by
// `skillmd rules`, SARIF output, and GitHub annotations.
import type { ParsedSkill } from "./parse.js";
import { MAX_DESCRIPTION, MAX_NAME, MAX_SKILL_BYTES, slugify } from "./parse.js";

export type Severity = "error" | "warn" | "info";

export interface Diagnostic {
  id: string;
  severity: Severity;
  message: string;
  line?: number;
}

export interface RuleContext {
  /** Slug or directory name the skill lives under, used by SK040. */
  slug?: string;
}

export interface Rule {
  id: string;
  severity: Severity;
  description: string;
  check(skill: ParsedSkill, ctx: RuleContext): Diagnostic[];
}

// UTF-8 byte length without depending on TextEncoder (keeps core lib-free so it
// runs unchanged in Node, browsers, and edge runtimes).
function utf8Bytes(s: string): number {
  let bytes = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      bytes += 4;
      i++; // surrogate pair consumes the next code unit
    } else bytes += 3;
  }
  return bytes;
}

const diag = (rule: Rule, message: string, line?: number): Diagnostic => ({
  id: rule.id,
  severity: rule.severity,
  message,
  ...(line !== undefined ? { line } : {}),
});

export const RULES: Rule[] = [
  {
    id: "SK002",
    severity: "error",
    description: "name must be present and ≤ 120 chars",
    check(s, _ctx) {
      const out: Diagnostic[] = [];
      if (!s.name.trim()) out.push(diag(this, "frontmatter 'name' is required"));
      else if (s.name.length > MAX_NAME) out.push(diag(this, `name must be ≤ ${MAX_NAME} chars`));
      return out;
    },
  },
  {
    id: "SK003",
    severity: "error",
    description: "description must be present and ≤ 1024 chars",
    check(s, _ctx) {
      const out: Diagnostic[] = [];
      if (!s.description.trim()) out.push(diag(this, "frontmatter 'description' is required"));
      else if (s.description.length > MAX_DESCRIPTION) out.push(diag(this, `description must be ≤ ${MAX_DESCRIPTION} chars`));
      return out;
    },
  },
  {
    id: "SK010",
    severity: "warn",
    description: "description should be ≥ 20 chars (not too terse)",
    check(s, _ctx) {
      return s.description.trim().length > 0 && s.description.trim().length < 20
        ? [diag(this, "description is very terse (< 20 chars); add more detail to help discovery")]
        : [];
    },
  },
  {
    id: "SK011",
    severity: "warn",
    description: "license should be declared in frontmatter",
    check(s, _ctx) {
      return s.license ? [] : [diag(this, "no 'license' declared in frontmatter")];
    },
  },
  {
    id: "SK020",
    severity: "warn",
    description: "body should be ≥ 200 chars (not a stub)",
    check(s, _ctx) {
      return s.body.trim().length < 200
        ? [diag(this, "body is very short (< 200 chars); this looks like a stub")]
        : [];
    },
  },
  {
    id: "SK021",
    severity: "warn",
    description: "body should contain at least one Markdown heading",
    check(s, _ctx) {
      return /^#{1,6}\s/m.test(s.body) ? [] : [diag(this, "body has no Markdown headings; add structure with '#' headings")];
    },
  },
  {
    id: "SK030",
    severity: "error",
    description: "total SKILL.md size must be ≤ 256KB",
    check(s, _ctx) {
      return utf8Bytes(s.body) > MAX_SKILL_BYTES ? [diag(this, "SKILL.md exceeds 256KB")] : [];
    },
  },
  {
    id: "SK040",
    severity: "warn",
    description: "name should match its directory/slug",
    check(s, ctx) {
      if (!ctx.slug) return [];
      const expected = slugify(s.name);
      return expected === ctx.slug ? [] : [diag(this, `name slug '${expected}' does not match directory '${ctx.slug}'`)];
    },
  },
];

export function runRules(skill: ParsedSkill, ctx: RuleContext = {}): Diagnostic[] {
  return RULES.flatMap((r) => r.check(skill, ctx));
}
