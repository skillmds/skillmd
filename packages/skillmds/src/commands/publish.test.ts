import { describe, it, expect, vi } from "vitest";
import { runPublish } from "./publish.js";
import type { PublishDeps } from "./publish.js";

const BROKEN = "---\nname: bad\n---\nbody"; // missing description
const GOOD = `---
name: good
description: A complete, well-documented skill that explains a genuinely useful task.
license: MIT
---
# Good

${"Detailed body content that comfortably exceeds two hundred characters in length. ".repeat(3)}
`;

function deps(raw: string, submit = vi.fn(async () => ({ slug: "me/good", status: "pending" }))): PublishDeps {
  return { resolve: async () => [{ path: "SKILL.md", raw, slug: "good" }], submit };
}

describe("runPublish gate", () => {
  it("refuses to publish a skill with lint errors and never calls submit", async () => {
    const submit = vi.fn(async () => ({ slug: "x" }));
    const run = await runPublish(".", {}, deps(BROKEN, submit));
    expect(run.exitCode).toBe(1);
    expect(run.published).toBe(false);
    expect(submit).not.toHaveBeenCalled();
  });

  it("publishes a clean skill", async () => {
    const submit = vi.fn(async () => ({ slug: "me/good", status: "pending" }));
    const run = await runPublish(".", {}, deps(GOOD, submit));
    expect(run.exitCode).toBe(0);
    expect(run.published).toBe(true);
    expect(submit).toHaveBeenCalledOnce();
  });

  it("dry-run lints but does not submit", async () => {
    const submit = vi.fn(async () => ({ slug: "x" }));
    const run = await runPublish(".", { dryRun: true }, deps(GOOD, submit));
    expect(run.published).toBe(false);
    expect(run.exitCode).toBe(0);
    expect(submit).not.toHaveBeenCalled();
  });
});
