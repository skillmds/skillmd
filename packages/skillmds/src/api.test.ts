import { describe, it, expect, afterEach, vi } from "vitest";
import { createHash } from "node:crypto";
import { parseSkillMd } from "@skillmd/core";
import { createClient, reconstructSkillMd, skillMdFor, fetchBundle, IntegrityError, RegistryError, isAllowedSourceUrl } from "./api.js";

const sha = (s: string) => createHash("sha256").update(Buffer.from(s, "utf8")).digest("hex");
const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
// Minimal Response stand-in for the bundle JSON endpoint.
const bundleResponse = (files: unknown[]) => ({ ok: true, json: async () => ({ files }) });

describe("fetchBundle integrity", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("accepts a registry-stored file whose bytes match the reported sha256", async () => {
    const body = "print('hello')\n";
    vi.stubGlobal("fetch", vi.fn(async () => bundleResponse([{ path: "run.py", content_base64: b64(body), sha256: sha(body) }])));
    const out = await fetchBundle("https://api.test", "owner/pack");
    expect(out).not.toBeNull();
    expect(out!.find((f) => f.path === "run.py")!.contents.toString("utf8")).toBe(body);
  });

  it("throws IntegrityError when the bytes do not match the reported sha256", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => bundleResponse([{ path: "run.py", content_base64: b64("tampered"), sha256: sha("original") }])));
    await expect(fetchBundle("https://api.test", "owner/pack")).rejects.toBeInstanceOf(IntegrityError);
  });

  it("does not verify files that carry no sha256 (reconstructed inline SKILL.md)", async () => {
    const md = "---\nname: x\n---\nbody\n";
    vi.stubGlobal("fetch", vi.fn(async () => bundleResponse([{ path: "SKILL.md", content_base64: b64(md), storage: "inline" }])));
    const out = await fetchBundle("https://api.test", "owner/pack");
    expect(out!.find((f) => f.path === "SKILL.md")!.contents.toString("utf8")).toBe(md);
  });

  it("refuses to fetch a source_url pointing off the GitHub raw hosts (SSRF guard)", async () => {
    const fetchMock = vi.fn(async (input: any) => {
      // Only the bundle endpoint should ever be fetched; the evil source_url must not.
      if (String(input).endsWith("/bundle?format=json")) {
        return bundleResponse([{ path: "run.py", source_url: "http://169.254.169.254/latest/meta-data/", storage: "github" }]) as any;
      }
      throw new Error(`unexpected fetch: ${input}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const out = await fetchBundle("https://api.test", "owner/pack");
    expect(out).toEqual([]); // evil file skipped, never requested
    expect(fetchMock).toHaveBeenCalledTimes(1); // bundle only — no SSRF fetch
  });
});

describe("isAllowedSourceUrl", () => {
  it("allows pinned GitHub raw hosts over https", () => {
    expect(isAllowedSourceUrl("https://raw.githubusercontent.com/o/r/abc123/x.py")).toBe(true);
    expect(isAllowedSourceUrl("https://gist.githubusercontent.com/o/id/raw/x")).toBe(true);
  });
  it("refuses non-GitHub hosts, non-https, and internal/metadata addresses", () => {
    expect(isAllowedSourceUrl("http://raw.githubusercontent.com/o/r/x")).toBe(false); // not https
    expect(isAllowedSourceUrl("https://evil.com/x")).toBe(false);
    expect(isAllowedSourceUrl("http://169.254.169.254/latest/meta-data/")).toBe(false);
    expect(isAllowedSourceUrl("http://localhost:8787/admin")).toBe(false);
    expect(isAllowedSourceUrl("file:///etc/passwd")).toBe(false);
    expect(isAllowedSourceUrl("not a url")).toBe(false);
  });
});

describe("api() error classification", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("tags HTTP failures with their status (proxy 403, registry 5xx)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 403, text: async () => "egress denied" })));
    const { api } = createClient({ api: "https://api.test" });
    const err = await api("/api/skills/o/n").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RegistryError);
    expect((err as RegistryError).status).toBe(403);
    expect((err as RegistryError).message).toContain("403");
  });

  it("tags network-level failures without a status (DNS, refused connection)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed", { cause: new Error("getaddrinfo ENOTFOUND api.test") }); }));
    const { api } = createClient({ api: "https://api.test" });
    const err = await api("/api/skills/o/n").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RegistryError);
    expect((err as RegistryError).status).toBeUndefined();
    expect((err as RegistryError).message).toContain("ENOTFOUND");
  });
});

describe("reconstructSkillMd", () => {
  it("round-trips descriptions with YAML-hostile characters", () => {
    const skill = {
      slug: "owner/tricky",
      title: "tricky",
      description: 'Use when: user says "plan #1", or {weird} stuff',
      body_md: "# Body\n",
      license: "MIT",
    };
    const raw = reconstructSkillMd(skill);
    const parsed = parseSkillMd(raw);
    expect("error" in parsed).toBe(false);
    if (!("error" in parsed)) {
      expect(parsed.name).toBe("tricky");
      expect(parsed.description).toBe('Use when: user says "plan #1", or {weird} stuff');
      expect(parsed.license).toBe("MIT");
      expect(parsed.body).toContain("# Body");
    }
  });
});

describe("skillMdFor", () => {
  it("returns raw_md verbatim when present, ignoring body_md/description", () => {
    const skill = {
      slug: "owner/verbatim",
      title: "verbatim",
      description: "ignored description",
      body_md: "ignored body",
      raw_md: "---\nname: verbatim\ndescription: exact raw content\n---\n\n# Exact\n",
    };
    expect(skillMdFor(skill)).toBe(skill.raw_md);
  });

  it("returns raw_md verbatim even when description diverges from its frontmatter", () => {
    // Publish-time override divergence: a publisher supplied name/description
    // override form fields that changed the registry's title/description columns
    // (for search/display), but raw_md preserves the author's original frontmatter.
    // Installs must deliver the author's SKILL.md verbatim, NOT the overridden fields.
    const skill = {
      slug: "owner/override-divergence",
      title: "Registry Display Title",
      description: "overridden registry description for search",
      body_md: "reconstructed body that must be ignored",
      raw_md: "---\nname: authors-name\ndescription: the author's original description\n---\n\n# Author Body\n",
    };
    expect(skillMdFor(skill)).toBe(skill.raw_md);
    // guard: the reconstructed form (built from the overridden columns) is NOT what installs get
    expect(skillMdFor(skill)).not.toBe(reconstructSkillMd(skill));
  });

  it("falls back to reconstruction when raw_md is absent", () => {
    const skill = {
      slug: "owner/tricky",
      title: "tricky",
      description: 'Use when: user says "plan #1", or {weird} stuff',
      body_md: "# Body\n",
      license: "MIT",
    };
    expect(skillMdFor(skill)).toBe(reconstructSkillMd(skill));
  });
});
