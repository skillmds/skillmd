// Helpers shared by every registry client (the CLI, the MCP server) for turning
// registry responses into installable SKILL.md files, plus the client-side SSRF
// guard for companion-file downloads. One implementation here replaces the
// hand-synced copies the clients used to carry.
import { stringify as stringifyYaml } from "yaml";

/** The registry-response fields needed to materialize a SKILL.md. Structural
 *  subset of the full payload returned by GET /api/skills/:owner/:name. */
export interface RegistrySkillFields {
  slug: string;
  title: string;
  description: string;
  body_md?: string;
  raw_md?: string | null;
  license?: string | null;
}

/** The exact SKILL.md to install: the published raw file when the registry has
 *  it, otherwise frontmatter reconstructed with proper YAML quoting. */
export function skillMdFor(skill: RegistrySkillFields): string {
  if (skill.raw_md) return skill.raw_md;
  return reconstructSkillMd(skill);
}

export function reconstructSkillMd(skill: RegistrySkillFields): string {
  const name = skill.slug.split("/")[1] || skill.title;
  const fm: Record<string, unknown> = { name, description: String(skill.description).replace(/\n/g, " ") };
  if (skill.license) fm.license = skill.license;
  return `---\n${stringifyYaml(fm)}---\n${skill.body_md || ""}`;
}

// Companion files not stored by the registry carry a registry-supplied
// `source_url`. The registry only ever pins these to GitHub raw hosts, so
// anything else (an internal address, an attacker host) is a sign of a
// hostile/compromised registry response — refuse to fetch it (client-side
// SSRF guard) rather than blindly requesting the URL.
export const ALLOWED_SOURCE_HOSTS: ReadonlySet<string> = new Set([
  "raw.githubusercontent.com",
  "gist.githubusercontent.com",
]);

export function isAllowedSourceUrl(u: string): boolean {
  try {
    const parsed = new URL(u);
    return parsed.protocol === "https:" && ALLOWED_SOURCE_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}
