import { describe, it, expect } from "vitest";
import { qualityScore, VERIFIED_FLOOR } from "./quality.js";
import type { Diagnostic } from "./rules.js";
import type { SecurityResult } from "./security.js";

const sec = (flags: SecurityResult["flags"]): SecurityResult => ({ flags, findings: [] });
const warn = (n: number): Diagnostic[] => Array.from({ length: n }, (_, i) => ({ id: `W${i}`, severity: "warn", message: "" }));

describe("qualityScore", () => {
  it("a clean skill scores 100", () => {
    expect(qualityScore([], sec(["docs_only"]))).toBe(100);
  });

  it("the 'safe' security flags barely dent the score", () => {
    expect(qualityScore([], sec(["reads_secrets"]))).toBe(98);
    expect(qualityScore([], sec(["network_calls"]))).toBe(99);
    // The common documentation case — mentions env vars AND a URL — stays high.
    expect(qualityScore([], sec(["reads_secrets", "network_calls"]))).toBeGreaterThanOrEqual(95);
  });

  it("executes_scripts costs more than the safe flags but is still modest", () => {
    expect(qualityScore([], sec(["executes_scripts"]))).toBe(95);
  });

  it("floors verified skills at 85 despite warnings and flags", () => {
    const noisy = qualityScore(warn(4), sec(["reads_secrets", "network_calls", "executes_scripts"]));
    expect(noisy).toBeLessThan(VERIFIED_FLOOR);
    expect(qualityScore(warn(4), sec(["reads_secrets", "network_calls", "executes_scripts"]), { verified: true })).toBe(VERIFIED_FLOOR);
  });

  it("keeps a verified skill's real score when it already beats the floor", () => {
    expect(qualityScore([], sec(["reads_secrets"]), { verified: true })).toBe(98);
  });

  it("does not floor a verified skill that fails to parse", () => {
    const broken: Diagnostic[] = [{ id: "SK001", severity: "error", message: "unparseable" }];
    expect(qualityScore(broken, sec(["docs_only"]), { verified: true })).toBeLessThan(VERIFIED_FLOOR);
  });
});
