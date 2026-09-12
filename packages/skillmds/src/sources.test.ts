import { describe, it, expect } from "vitest";
import { parseSource, gigetInput } from "./sources.js";

const cases: Array<[string, ReturnType<typeof parseSource>]> = [
  ["./my-skill", { kind: "local", path: "./my-skill", display: "./my-skill" }],
  ["C:\\skills\\x", { kind: "local", path: "C:\\skills\\x", display: "C:\\skills\\x" }],
  ["anthropic/pdf", { kind: "slug", owner: "anthropic", name: "pdf", display: "anthropic/pdf" }],
  ["owner/repo#dev", { kind: "github", owner: "owner", repo: "repo", ref: "dev", display: "owner/repo#dev" }],
  ["owner/repo/skills/x", { kind: "github", owner: "owner", repo: "repo", subpath: "skills/x", display: "owner/repo/skills/x" }],
  ["owner/repo@my-skill", { kind: "github", owner: "owner", repo: "repo", skill: "my-skill", display: "owner/repo@my-skill" }],
  ["owner/repo#v2@my-skill", { kind: "github", owner: "owner", repo: "repo", ref: "v2", skill: "my-skill", display: "owner/repo#v2@my-skill" }],
  ["github:o/r", { kind: "github", owner: "o", repo: "r", display: "github:o/r" }],
  ["gh:o/r/sub", { kind: "github", owner: "o", repo: "r", subpath: "sub", display: "gh:o/r/sub" }],
  ["https://github.com/o/r", { kind: "github", owner: "o", repo: "r", display: "https://github.com/o/r" }],
  ["https://github.com/o/r.git", { kind: "github", owner: "o", repo: "r", display: "https://github.com/o/r.git" }],
  ["https://github.com/o/r/tree/dev/skills/x", { kind: "github", owner: "o", repo: "r", ref: "dev", subpath: "skills/x", display: "https://github.com/o/r/tree/dev/skills/x" }],
  ["https://github.com/o/r/blob/main/skills/x/SKILL.md", { kind: "github", owner: "o", repo: "r", ref: "main", subpath: "skills/x", display: "https://github.com/o/r/blob/main/skills/x/SKILL.md" }],
  ["https://gist.github.com/u/0123456789abcdef", { kind: "gist", user: "u", id: "0123456789abcdef", display: "https://gist.github.com/u/0123456789abcdef" }],
];

describe("parseSource", () => {
  for (const [input, expected] of cases) {
    it(`parses ${input}`, () => { expect(parseSource(input, { exists: () => false })).toEqual(expected); });
  }
  it("treats an existing path as local even without ./", () => {
    expect(parseSource("my-skill", { exists: (p) => p === "my-skill" }).kind).toBe("local");
  });
  it("--ref overrides a ref in the source", () => {
    const s = parseSource("o/r#dev", { exists: () => false, ref: "v3" });
    expect(s.kind === "github" && s.ref).toBe("v3");
  });
  it("rejects subpaths that escape the repo", () => {
    expect(() => parseSource("o/r/../../etc", { exists: () => false })).toThrow(/\.\./);
    expect(() => parseSource("https://github.com/o/r/tree/main/a/../b", { exists: () => false })).toThrow(/\.\./);
  });
  it("names unsupported hosts with the local-clone workaround", () => {
    expect(() => parseSource("git@github.com:o/r.git", { exists: () => false })).toThrow(/clone it locally/);
    expect(() => parseSource("https://gitlab.com/o/r", { exists: () => false })).toThrow(/GitLab.*clone it locally/);
    expect(() => parseSource("https://example.com/x", { exists: () => false })).toThrow(/not a supported source/);
  });
  it("rejects garbage", () => {
    expect(() => parseSource("", { exists: () => false })).toThrow();
    expect(() => parseSource("just-a-word", { exists: () => false })).toThrow(/owner\/name/);
  });
});

describe("gigetInput", () => {
  it("builds github:owner/repo[/sub][#ref]", () => {
    expect(gigetInput({ kind: "github", owner: "o", repo: "r", display: "" })).toBe("github:o/r");
    expect(gigetInput({ kind: "github", owner: "o", repo: "r", subpath: "skills/x", ref: "dev", display: "" })).toBe("github:o/r/skills/x#dev");
  });
});
