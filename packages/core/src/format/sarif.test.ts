import { describe, it, expect } from "vitest";
import { toSarif } from "./sarif.js";
import { toGithub } from "./github.js";
import { lint } from "../lint.js";

const broken = lint("garbage");

describe("toSarif", () => {
  it("produces a SARIF 2.1.0 log named skillmd", () => {
    const log = toSarif([{ file: "./SKILL.md", result: broken }]);
    expect(log.version).toBe("2.1.0");
    expect(log.$schema).toContain("sarif-2.1.0");
    const run = log.runs[0] as any;
    expect(run.tool.driver.name).toBe("skillmd");
    expect(run.results.length).toBe(broken.diagnostics.length);
  });
});

describe("toGithub", () => {
  it("emits workflow annotations", () => {
    const out = toGithub([{ file: "SKILL.md", result: broken }]);
    expect(out).toContain("::error file=SKILL.md");
    expect(out).toContain("title=SK001");
  });
});
