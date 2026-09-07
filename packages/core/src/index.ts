// Public surface of @skillmds/core — the shared parser, linter, security scanner,
// quality score, and report formatters used by the SkillMD registry, the
// `skillmd` CLI, and the `skillmds` MCP server.
export { parseSkillMd, slugify, categorize, MAX_SKILL_BYTES, MAX_DESCRIPTION, MAX_NAME } from "./parse.js";
export type { ParsedSkill, ParseResult } from "./parse.js";

export { scanSecurity, UNTRUSTED_INSTALL_RE } from "./security.js";
export type { SecurityFlag, SecurityFinding, SecurityResult } from "./security.js";

export { RULES, runRules } from "./rules.js";
export type { Rule, RuleContext, Diagnostic, Severity } from "./rules.js";

export { qualityScore } from "./quality.js";

export { lint } from "./lint.js";
export type { LintResult, LintOptions } from "./lint.js";

export { toText } from "./format/text.js";
export type { TextOptions } from "./format/text.js";
export { toJson } from "./format/json.js";
export type { JsonReportEntry } from "./format/json.js";
export { toSarif } from "./format/sarif.js";
export type { SarifLog } from "./format/sarif.js";
export { toGithub } from "./format/github.js";

export { skillMdFor, reconstructSkillMd, isAllowedSourceUrl, ALLOWED_SOURCE_HOSTS } from "./registry.js";
export type { RegistrySkillFields } from "./registry.js";
