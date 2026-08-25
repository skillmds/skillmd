import { describe, it, expect } from "vitest";
import { isAllowedSourceUrl, reconstructSkillMd, skillMdFor } from "./registry.js";

const base = { slug: "owner/my-skill", title: "My Skill", description: "Does a thing well." };

describe("reconstructSkillMd", () => {
  it("derives the frontmatter name from the slug and flattens newlines in the description", () => {
    const md = reconstructSkillMd({ ...base, description: "line one\nline two" });
    expect(md.startsWith("---\n")).toBe(true);
    expect(md).toContain("name: my-skill");
    expect(md).toContain("line one line two");
    expect(md).not.toContain("line one\nline two");
  });

  it("falls back to the title when the slug has no name segment", () => {
    const md = reconstructSkillMd({ ...base, slug: "loneowner" });
    expect(md).toContain("name: My Skill");
  });

  it("includes license only when present", () => {
    expect(reconstructSkillMd(base)).not.toContain("license:");
    expect(reconstructSkillMd({ ...base, license: "MIT" })).toContain("license: MIT");
  });

  it("YAML-quotes descriptions that would otherwise break frontmatter", () => {
    const md = reconstructSkillMd({ ...base, description: "usage: run it" });
    expect(md).toContain('description: "usage: run it"');
  });

  it("appends the body after the closing frontmatter fence", () => {
    const md = reconstructSkillMd({ ...base, body_md: "# Heading\n\nBody." });
    expect(md.endsWith("---\n# Heading\n\nBody.")).toBe(true);
  });
});

describe("skillMdFor", () => {
  it("returns raw_md verbatim when the registry has the published file", () => {
    const raw = "---\nname: exact\n---\noriginal bytes\n";
    expect(skillMdFor({ ...base, raw_md: raw })).toBe(raw);
  });

  it("reconstructs when raw_md is absent or null", () => {
    expect(skillMdFor({ ...base, raw_md: null })).toContain("name: my-skill");
    expect(skillMdFor(base)).toContain("name: my-skill");
  });
});

describe("isAllowedSourceUrl (client-side SSRF guard)", () => {
  it("accepts the pinned GitHub raw hosts over https", () => {
    expect(isAllowedSourceUrl("https://raw.githubusercontent.com/o/r/main/f.py")).toBe(true);
    expect(isAllowedSourceUrl("https://gist.githubusercontent.com/o/id/raw/f.py")).toBe(true);
  });

  it("rejects http, other hosts, internal addresses, and garbage", () => {
    expect(isAllowedSourceUrl("http://raw.githubusercontent.com/o/r/main/f.py")).toBe(false);
    expect(isAllowedSourceUrl("https://evil.com/f.py")).toBe(false);
    expect(isAllowedSourceUrl("http://169.254.169.254/latest/meta-data/")).toBe(false);
    expect(isAllowedSourceUrl("not a url")).toBe(false);
    expect(isAllowedSourceUrl("")).toBe(false);
  });
});
