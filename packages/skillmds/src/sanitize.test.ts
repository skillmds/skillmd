import { describe, it, expect } from "vitest";
import { stripTerminalEscapes, safeText } from "./sanitize.js";

describe("stripTerminalEscapes", () => {
  it("removes CSI sequences (colours, cursor moves, clear screen)", () => {
    expect(stripTerminalEscapes("a\x1b[31mred\x1b[0m b\x1b[2J")).toBe("ared b");
  });
  it("removes OSC sequences terminated by BEL or ST", () => {
    expect(stripTerminalEscapes("x\x1b]0;evil title\x07y")).toBe("xy");
    expect(stripTerminalEscapes("x\x1b]8;;http://e\x1b\\link\x1b]8;;\x1b\\y")).toBe("xlinky");
  });
  it("removes C0/C1 control characters but keeps tab and newline", () => {
    expect(stripTerminalEscapes("a\x00b\x07c\x9bd\te\nf")).toBe("abcd\te\nf");
  });
  it("leaves ordinary unicode alone", () => {
    expect(stripTerminalEscapes("ünïcode ✓ — ok")).toBe("ünïcode ✓ — ok");
  });
});

describe("safeText", () => {
  it("strips escapes, collapses newlines to spaces and caps length", () => {
    expect(safeText("line1\nline2\x1b[31m!", 10)).toBe("line1 lin…");
  });
  it("returns an empty string for non-strings", () => {
    expect(safeText(undefined)).toBe("");
    expect(safeText(42 as unknown as string)).toBe("");
  });
});
