// SKILL.md parsing + classification. Single source of truth shared by the
// registry and the CLI so client and server agree on what a "valid" skill is.
import { parse as parseYaml } from "yaml";

export interface ParsedSkill {
  name: string;
  description: string;
  license: string | null;
  body: string;
  type: "single" | "pack";
}

export type ParseResult = ParsedSkill | { error: string };

export const MAX_SKILL_BYTES = 256 * 1024;
export const MAX_DESCRIPTION = 1024;
export const MAX_NAME = 120;

export const slugify = (s: string): string =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "skill";

export function parseSkillMd(raw: string, type: "single" | "pack" = "single"): ParseResult {
  if (!raw || raw.length > MAX_SKILL_BYTES) return { error: "SKILL.md missing or too large (max 256KB)" };
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { error: "Missing YAML frontmatter (--- ... ---)" };
  let fm: Record<string, unknown>;
  try {
    fm = (parseYaml(m[1] ?? "") ?? {}) as Record<string, unknown>;
  } catch {
    return { error: "Invalid YAML frontmatter" };
  }
  const name = String(fm.name ?? "").trim();
  const description = String(fm.description ?? "").replace(/\s+/g, " ").trim();
  if (!name) return { error: "frontmatter 'name' is required" };
  if (!description) return { error: "frontmatter 'description' is required" };
  if (description.length > MAX_DESCRIPTION) return { error: `description must be <= ${MAX_DESCRIPTION} chars` };

  return {
    name: name.slice(0, MAX_NAME),
    description: description.slice(0, MAX_DESCRIPTION),
    license: fm.license ? String(fm.license).slice(0, 64) : null,
    body: m[2] ?? "",
    type,
  };
}

const CATEGORY_KEYWORDS: [string, RegExp][] = [
  ["devops", /docker|kubernetes|k8s|terraform|ci\/cd|deploy|helm|pipeline/i],
  ["data", /\b(csv|xlsx|excel|spreadsheet|sql|dataframe|pandas|etl|analytics)\b/i],
  ["docs", /\b(docx|word|pdf|markdown|report|documentation|slides?|pptx)\b/i],
  ["web", /\b(html|css|react|vue|svelte|frontend|browser|tailwind|a11y)\b/i],
  ["ai-ml", /\b(llm|embedding|rag|prompt|agent|fine-?tune|model|mcp)\b/i],
  ["security", /\b(security|vulnerabilit|secret|audit|owasp|exploit|xss)\b/i],
  ["design", /\b(image|figma|design|video|audio|svg|canvas)\b/i],
  ["research", /\b(research|citation|summari[sz]e|knowledge)\b/i],
  ["finance", /\b(invoice|account|financ|budget|revenue|business)\b/i],
  ["integrations", /\b(api|webhook|graphql|rest|integration|oauth|slack)\b/i],
  ["productivity", /\b(email|calendar|todo|task|notion|workflow)\b/i],
  ["coding", /\b(code|refactor|test|debug|lint|typescript|python|rust|golang)\b/i],
];

export function categorize(text: string): string {
  for (const [slug, re] of CATEGORY_KEYWORDS) if (re.test(text)) return slug;
  return "coding";
}
