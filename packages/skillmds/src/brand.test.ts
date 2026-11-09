import { describe, expect, it } from "vitest";
import { PassThrough } from "node:stream";
import { ASCII_SPINNER, SPINNERS, SQUARES, WORDMARK_WIDTH, brandWord, canAnimate, orange, playLogo, truecolor, unicodeSupported, waitFor, wordmarkLines } from "./brand.js";

const plain = (s: string) => s;
const ESC = String.fromCharCode(27);
const stripAnsi = (s: string) => s.replace(new RegExp(`${ESC}\\[[0-9;?]*[A-Za-z]`, "g"), "");

describe("wordmark", () => {
  it("draws the logo at rest: six lines, 54 cells wide, squares in place", () => {
    expect(wordmarkLines(SQUARES, plain)).toEqual([
      "          ▄▄      ▄▄ ▄▄ ▄▄                     ▄▄",
      "          ██      ▀▀ ██ ██                     ██",
      "▄████████ ██  ▄█▀ ██ ██ ██  ▄█████████   ▄███████",
      "██▄▄▄▄▄▄  ██▄█▀   ██ ██ ██  ██   ██   ██ ██    ██",
      " ▀▀▀▀▀▀██ ██▀█▄   ██ ██ ██  ██   ██   ██ ██    ██   ██",
      "████████▀ ██  ▀█▄ ██ ██ ██  ██   ██   ██ ██████   ██",
    ]);
    for (const line of wordmarkLines(SQUARES, plain)) expect(line.length).toBeLessThanOrEqual(WORDMARK_WIDTH);
  });

  it("leaves the squares out when none are given (the first frame of the drop)", () => {
    const bare = wordmarkLines([], plain);
    expect(bare[4]).toBe(" ▀▀▀▀▀▀██ ██▀█▄   ██ ██ ██  ██   ██   ██ ██    ██");
    expect(bare[5]).toBe("████████▀ ██  ▀█▄ ██ ██ ██  ██   ██   ██ ██████");
  });

  it("clips a square that is still above the logo while it falls", () => {
    const falling = wordmarkLines([{ x: 50, y: -2 }], plain);
    expect(falling.join("\n")).toBe(wordmarkLines([], plain).join("\n"));
    expect(wordmarkLines([{ x: 50, y: -1 }], plain)[0]).toMatch(/▀▀$/);
  });

  it("paints only md and the squares, never skill", () => {
    const tagged = wordmarkLines(SQUARES, (s) => `<${s}>`);
    const painted = tagged.flatMap((l) => [...l.matchAll(/<([^>]*)>/g)].map((m) => m[1]!.trim()));
    // "skill" occupies columns 0-25: nothing painted starts before column 28.
    for (const line of tagged) {
      const firstPaint = line.indexOf("<");
      if (firstPaint >= 0) expect(stripAnsi(line.slice(0, firstPaint)).length).toBeGreaterThanOrEqual(28);
    }
    expect(painted.join("")).not.toBe("");
  });
});

describe("spinners", () => {
  it("keeps every frame of a kind the same width, so the text never jitters", () => {
    for (const { frames } of [...Object.values(SPINNERS), ASCII_SPINNER]) {
      const widths = new Set(frames.map((f) => f.length));
      expect(widths.size).toBe(1);
    }
  });

  it("builds drop, hop and walk only from the two squares", () => {
    for (const { frames } of Object.values(SPINNERS)) expect(frames.join("")).toMatch(/^[▀▄ ]+$/);
  });
});

describe("colour", () => {
  it("uses the exact brand orange on truecolor terminals and the nearest 256-colour elsewhere", () => {
    expect(orange("md", { COLORTERM: "truecolor" }, true)).toBe(`${ESC}[38;2;214;83;41mmd${ESC}[39m`);
    expect(orange("md", {}, true)).toBe(`${ESC}[38;5;166mmd${ESC}[39m`);
  });

  it("is plain text when colour is off", () => {
    expect(orange("md", { COLORTERM: "truecolor" }, false)).toBe("md");
    expect(brandWord({}, false)).toBe("skillmd");
  });

  it("recognises common truecolor terminals", () => {
    expect(truecolor({ WT_SESSION: "x" })).toBe(true);
    expect(truecolor({ TERM_PROGRAM: "vscode" })).toBe(true);
    expect(truecolor({ TERM: "xterm-kitty" })).toBe(true);
    expect(truecolor({ TERM: "xterm-256color" })).toBe(false);
  });
});

describe("when motion is allowed", () => {
  it("only for a person at a real terminal", () => {
    expect(canAnimate({ isTTY: true }, { TERM: "xterm-256color" })).toBe(true);
    expect(canAnimate({ isTTY: false }, { TERM: "xterm-256color" })).toBe(false);
    expect(canAnimate({ isTTY: true }, { TERM: "dumb" })).toBe(false);
    expect(canAnimate({ isTTY: true }, { TERM: "xterm-256color", CI: "true" })).toBe(false);
    expect(canAnimate({ isTTY: true }, { TERM: "xterm-256color", CLAUDECODE: "1" })).toBe(false);
  });

  it("falls back to ASCII on consoles without block glyphs", () => {
    expect(unicodeSupported({}, "win32")).toBe(false);
    expect(unicodeSupported({ WT_SESSION: "x" }, "win32")).toBe(true);
    expect(unicodeSupported({ TERM: "xterm-256color" }, "linux")).toBe(true);
    expect(unicodeSupported({ TERM: "linux" }, "linux")).toBe(false);
  });
});

describe("playLogo", () => {
  it("prints the finished logo at once when it may not animate", async () => {
    const out = new PassThrough();
    let written = "";
    out.on("data", (c) => (written += c));
    await playLogo({ out: out as unknown as NodeJS.WriteStream, animate: false, indent: "  " });
    const lines = stripAnsi(written).split("\n");
    expect(lines.slice(0, 6)).toEqual(wordmarkLines(SQUARES, plain).map((l) => `  ${l}`));
  });
});

describe("waitFor", () => {
  it("passes the result through and draws nothing off a terminal", async () => {
    const stream = new PassThrough();
    let written = "";
    stream.on("data", (c) => (written += c));
    const r = await waitFor("hop", "Searching", Promise.resolve(42), { stream: stream as unknown as NodeJS.WriteStream, env: {} });
    expect(r).toBe(42);
    expect(written).toBe("");
  });

  it("draws on a terminal, then erases its line and hands the error back", async () => {
    const stream = Object.assign(new PassThrough(), { isTTY: true });
    let written = "";
    stream.on("data", (c) => (written += c));
    await expect(waitFor("walk", "Updating skills", Promise.reject(new Error("boom")), {
      stream: stream as unknown as NodeJS.WriteStream,
      env: { TERM: "xterm-256color" },
      also: { isTTY: true },
    })).rejects.toThrow("boom");
    expect(stripAnsi(written)).toContain("Updating skills…");
    expect(written.endsWith(`\r${ESC}[2K${ESC}[?25h`)).toBe(true);
  });

  it("stays quiet for --json", async () => {
    const stream = Object.assign(new PassThrough(), { isTTY: true });
    let written = "";
    stream.on("data", (c) => (written += c));
    await waitFor("drop", "Fetching", Promise.resolve(1), { json: true, stream: stream as unknown as NodeJS.WriteStream, env: { TERM: "xterm-256color" }, also: { isTTY: true } });
    expect(written).toBe("");
  });
});
