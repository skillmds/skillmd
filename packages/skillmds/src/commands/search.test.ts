import { describe, it, expect } from "vitest";
import { formatStars, truncate, formatSearchResult } from "./search.js";
import type { SearchItem } from "./search.js";

describe("formatStars", () => {
  it("formats large counts with one decimal, e.g. 223700 -> 223.7k", () => {
    expect(formatStars(223700)).toBe("223.7k");
  });
  it("leaves sub-1000 counts unchanged, e.g. 970 -> 970", () => {
    expect(formatStars(970)).toBe("970");
  });
  it("strips a trailing .0, e.g. 42048 -> 42k", () => {
    expect(formatStars(42048)).toBe("42k");
  });
  it("uses a millions branch for 1e6+, e.g. 2500000 -> 2.5M and 3000000 -> 3M", () => {
    expect(formatStars(2_500_000)).toBe("2.5M");
    expect(formatStars(3_000_000)).toBe("3M");
  });
});

describe("truncate", () => {
  it("returns text unchanged when it already fits", () => {
    expect(truncate("short", 20)).toBe("short");
  });
  it("truncates with an ellipsis when text overflows the width", () => {
    const long = "This is a very long description that will not fit on one line.";
    const out = truncate(long, 20);
    expect(out.length).toBeLessThanOrEqual(20);
    expect(out.endsWith("…")).toBe(true);
  });
});

// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string): string => s.replace(/\x1b\[[0-9;]*m/g, "");

const BASE: SearchItem = {
  slug: "anthropic/pdf",
  title: "PDF",
  description: "Read, write, and manipulate PDF documents with ease and precision across many use cases.",
};

describe("formatSearchResult", () => {
  it("shows a verified marker only when verified", () => {
    const verified = formatSearchResult({ ...BASE, verified: true }, 80);
    const unverified = formatSearchResult({ ...BASE, verified: false }, 80);
    expect(verified).toContain("✓");
    expect(unverified).not.toContain("✓");
  });

  it("renders repo stars instead of a rating", () => {
    const out = formatSearchResult({ ...BASE, repo_stars: 42048 }, 80);
    expect(out).toContain("★");
    expect(out).toContain("42k");
    expect(out).not.toMatch(/\(\d+\)/); // no more "4.2 (5)" rating-count parens
  });

  it("omits the rating text entirely even when avg_rating is present", () => {
    const out = formatSearchResult({ ...BASE, avg_rating: 4.2, rating_count: 5 }, 80);
    expect(out).not.toContain("4.2");
    expect(out).not.toContain("(5)");
  });

  it("marks packs with a [pack] tag", () => {
    const out = formatSearchResult({ ...BASE, type: "pack" }, 80);
    expect(out).toContain("[pack]");
  });

  it("keeps the description line within the terminal width, with an ellipsis", () => {
    const out = formatSearchResult({ ...BASE, description: "x".repeat(300) }, 40);
    const descLine = stripAnsi(out.split("\n")[1] ?? "");
    expect(descLine.length).toBeLessThanOrEqual(40);
    expect(descLine.endsWith("…")).toBe(true);
  });

  it("caps the line width at ~100 even on very wide terminals", () => {
    const out = formatSearchResult({ ...BASE, description: "y".repeat(300) }, 400);
    const descLine = stripAnsi(out.split("\n")[1] ?? "");
    expect(descLine.length).toBeLessThanOrEqual(100);
  });

  it("produces exactly two lines per result", () => {
    const out = formatSearchResult(BASE, 80);
    expect(out.split("\n")).toHaveLength(2);
  });
});
