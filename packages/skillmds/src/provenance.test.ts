import { describe, expect, it } from "vitest";
import { filesForInstall, withRegistrySource } from "./provenance.js";

const SRC = "https://skillmd.com/skills/benjitaylor/stageshow";

describe("withRegistrySource", () => {
  it("adds a metadata block at the end of a frontmatter that has none", () => {
    const md = "---\nname: stageshow\ndescription: Faux product UI.\n---\n\n# Stageshow\n";
    expect(withRegistrySource(md, "benjitaylor/stageshow")).toBe(
      `---\nname: stageshow\ndescription: Faux product UI.\nmetadata:\n  source: ${SRC}\n---\n\n# Stageshow\n`,
    );
  });

  it("adds one line to the author's metadata, at its indentation, and keeps their keys", () => {
    const md = "---\nname: stageshow\ndescription: d\nmetadata:\n    version: \"2\"\n    author: benji\nlicense: MIT\n---\nbody\n";
    expect(withRegistrySource(md, "benjitaylor/stageshow")).toBe(
      `---\nname: stageshow\ndescription: d\nmetadata:\n    source: ${SRC}\n    version: "2"\n    author: benji\nlicense: MIT\n---\nbody\n`,
    );
  });

  it("keeps CRLF files CRLF", () => {
    const md = "---\r\nname: stageshow\r\ndescription: d\r\n---\r\nbody\r\n";
    expect(withRegistrySource(md, "benjitaylor/stageshow")).toBe(
      `---\r\nname: stageshow\r\ndescription: d\r\nmetadata:\r\n  source: ${SRC}\r\n---\r\nbody\r\n`,
    );
  });

  it("never overrides an author's own source, a flow-style metadata, or a file without frontmatter", () => {
    const own = "---\nname: a\ndescription: d\nmetadata:\n  source: https://example.com/a\n---\n";
    const flow = "---\nname: a\ndescription: d\nmetadata: {version: 2}\n---\n";
    const none = "# Just a body\n";
    for (const md of [own, flow, none]) expect(withRegistrySource(md, "o/a")).toBe(md);
  });

  it("leaves the body alone even when it contains frontmatter-looking text", () => {
    const md = "---\nname: a\ndescription: d\n---\n\n```yaml\nmetadata:\n  x: 1\n```\n";
    expect(withRegistrySource(md, "o/a")).toBe(`---\nname: a\ndescription: d\nmetadata:\n  source: https://skillmd.com/skills/o/a\n---\n\n\`\`\`yaml\nmetadata:\n  x: 1\n\`\`\`\n`);
  });
});

describe("filesForInstall", () => {
  const files = [
    { path: "SKILL.md", contents: "---\nname: a\ndescription: d\n---\nbody\n" },
    { path: "scripts/run.sh", contents: Buffer.from("echo hi\n") },
  ];

  it("adds the source to a registry install's SKILL.md only", () => {
    const out = filesForInstall(files, "registry:o/a");
    expect(out[0]!.contents).toContain("  source: https://skillmd.com/skills/o/a\n");
    expect(out[1]).toBe(files[1]);
    // the input is not mutated: the lock digest is taken over the served bytes
    expect(files[0]!.contents).not.toContain("source:");
  });

  it("writes GitHub, gist and local installs exactly as fetched", () => {
    for (const source of ["github:o/r", "local:./x", "gist:u/1", "plugin:o/p"]) {
      expect(filesForInstall(files, source)).toBe(files);
    }
  });
});
