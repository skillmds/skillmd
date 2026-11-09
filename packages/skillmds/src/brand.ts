// The SkillMD brand in a terminal: the orange, the "skillmd." wordmark drawn in
// half-block characters, its two squares dropping into place on launch, and the
// loading animations made from those same two squares.
//
// Rules carried over from the brand files (Skillmd-01..04.svg):
//   * "skill" is ink. Here that is the terminal's own foreground, so the logo
//     reads on light AND dark themes; nothing is forced to white or black.
//   * "md" and the two squares are the brand orange #d65329.
import pc from "picocolors";
import { detectHostAgent } from "./env.js";

type Env = NodeJS.ProcessEnv;

/** Unicode-capable terminal? (is-unicode-supported, inlined.) Legacy Windows
 *  consoles get ASCII fallbacks instead of block glyphs. */
export function unicodeSupported(env: Env = process.env, platform: string = process.platform): boolean {
  if (platform !== "win32") return env.TERM !== "linux";
  return Boolean(env.CI)
    || Boolean(env.WT_SESSION)
    || Boolean(env.TERMINUS_SUBLIME)
    || env.ConEmuTask === "{cmd::Cmder}"
    || env.TERM_PROGRAM === "Terminus-Sublime"
    || env.TERM_PROGRAM === "vscode"
    || env.TERM === "xterm-256color"
    || env.TERM === "alacritty"
    || env.TERMINAL_EMULATOR === "JetBrains-JediTerm";
}

/** 24-bit colour? Otherwise the nearest 256-colour orange is used. */
export function truecolor(env: Env = process.env): boolean {
  if (/^(truecolor|24bit)$/i.test(env.COLORTERM ?? "")) return true;
  if (env.WT_SESSION || env.KITTY_WINDOW_ID) return true;
  if (/^(vscode|iTerm\.app|WezTerm|Hyper|ghostty)$/.test(env.TERM_PROGRAM ?? "")) return true;
  return /(truecolor|24bit|direct|kitty|ghostty)/i.test(env.TERM ?? "");
}

/** Paint text the brand orange. Plain text when colour is off (NO_COLOR, pipes). */
export function orange(text: string, env: Env = process.env, colour: boolean = pc.isColorSupported): string {
  if (!colour) return text;
  const open = truecolor(env) ? "\x1b[38;2;214;83;41m" : "\x1b[38;5;166m";
  return `${open}${text}\x1b[39m`;
}

/** Whether a stream may carry motion: a real terminal, a person (not CI or an
 *  agent driving the CLI), glyphs we can draw, and a terminal that redraws. */
export function canAnimate(stream: { isTTY?: boolean }, env: Env = process.env): boolean {
  return Boolean(stream.isTTY)
    && detectHostAgent(env) === null
    && env.TERM !== "dumb"
    && unicodeSupported(env);
}

// ---------------------------------------------------------------- spinners --

/** The loading animations, each built from the logo's two squares.
 *  drop: they fall into place, hold, clear (fetching a skill or its details)
 *  hop:  they swap places (searching)
 *  walk: the pair climbs along the line (installing, updating, publishing, checking) */
export type SpinnerKind = "drop" | "hop" | "walk";

export const SPINNERS: Record<SpinnerKind, { frames: string[]; interval: number }> = {
  drop: { frames: ["  ", "▀ ", "▄ ", "▄▀", "▄▀", "▄▀", "▄▀", "▄▀", "  "], interval: 90 },
  hop: { frames: ["▄▀", "▀▄"], interval: 240 },
  walk: { frames: ["▄▀  ", " ▄▀ ", "  ▄▀", "   ▄", "    ", "▀   "], interval: 110 },
};

/** For consoles without block glyphs. */
export const ASCII_SPINNER = { frames: ["•", "o", "O", "0"], interval: 120 };

/** A loading line on stderr for the plain (non-framed) commands: drawn only for
 *  a person at a terminal, erased without a trace when the work is done, so the
 *  command's own output is exactly what it was before. */
export async function waitFor<T>(
  kind: SpinnerKind,
  message: string,
  work: Promise<T> | (() => Promise<T>),
  opts: { json?: boolean; stream?: NodeJS.WriteStream; env?: Env; also?: { isTTY?: boolean } } = {},
): Promise<T> {
  const stream = opts.stream ?? process.stderr;
  const env = opts.env ?? process.env;
  const job = typeof work === "function" ? work() : work;
  const show = !opts.json && canAnimate(stream, env) && canAnimate(opts.also ?? process.stdout, env);
  if (!show) return job;
  const { frames, interval } = SPINNERS[kind];
  const text = message.replace(/[.…]+$/, "");
  let i = 0;
  const draw = () => stream.write(`\r\x1b[2K${orange(frames[i++ % frames.length]!, env)} ${text}…`);
  stream.write("\x1b[?25l");
  draw();
  const timer = setInterval(draw, interval);
  const restore = () => stream.write("\x1b[?25h");
  process.once("exit", restore);
  try {
    return await job;
  } finally {
    clearInterval(timer);
    stream.write("\r\x1b[2K\x1b[?25h");
    process.removeListener("exit", restore);
  }
}

// ---------------------------------------------------------------- wordmark --

// The wordmark as an 11 x 54 pixel grid, hand-fitted to Skillmd-01.svg at a
// stroke of 2 px. Drawn from row 1 of a 12-row canvas so the x-height, the bars
// and both squares fall on whole character cells (two pixel rows per cell).
const LETTERS: { x: number; md?: boolean; rows: Record<number, string> }[] = [
  { x: 0, rows: { 3: ".########", 4: "#########", 5: "##.......", 6: "########.", 7: ".########", 8: ".......##", 9: "#########", 10: "########." } }, // s
  { x: 10, rows: { 0: "##", 1: "##", 2: "##", 3: "##...##", 4: "##..##", 5: "##.##", 6: "####", 7: "####", 8: "##.##", 9: "##..##", 10: "##...##" } }, // k
  { x: 18, rows: { 0: "##", 1: "##", 3: "##", 4: "##", 5: "##", 6: "##", 7: "##", 8: "##", 9: "##", 10: "##" } }, // i
  { x: 21, rows: Object.fromEntries([...Array(11).keys()].map((r) => [r, "##"])) }, // l
  { x: 24, rows: Object.fromEntries([...Array(11).keys()].map((r) => [r, "##"])) }, // l
  { x: 28, md: true, rows: { 3: ".#########", 4: "##########", 5: "##...##...##", 6: "##...##...##", 7: "##...##...##", 8: "##...##...##", 9: "##...##...##", 10: "##...##...##" } }, // m
  { x: 41, md: true, rows: { 0: "......##", 1: "......##", 2: "......##", 3: ".#######", 4: "########", 5: "##....##", 6: "##....##", 7: "##....##", 8: "##....##", 9: "######", 10: "######" } }, // d
];
export const WORDMARK_WIDTH = 54;
const CANVAS_ROWS = 12;
/** Where the two squares rest (canvas pixels, top-left of each 2x2 square). */
export const SQUARES = [{ x: 50, y: 10 }, { x: 52, y: 8 }] as const;

type Pixel = "ink" | "md" | null;

/** The logo as terminal lines. `squares` are the positions to draw the two
 *  squares at (any y, even off-canvas while they fall); default: at rest. */
export function wordmarkLines(
  squares: readonly { x: number; y: number }[] = SQUARES,
  paint: (s: string) => string = (s) => orange(s),
): string[] {
  const grid: Pixel[][] = [...Array(CANVAS_ROWS)].map(() => Array<Pixel>(WORDMARK_WIDTH).fill(null));
  for (const L of LETTERS) {
    for (const [r, row] of Object.entries(L.rows)) {
      [...row].forEach((c, i) => { if (c === "#") grid[Number(r) + 1]![L.x + i] = L.md ? "md" : "ink"; });
    }
  }
  for (const sq of squares) {
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const y = Math.round(sq.y) + dy, x = Math.round(sq.x) + dx;
      if (y >= 0 && y < CANVAS_ROWS && x >= 0 && x < WORDMARK_WIDTH) grid[y]![x] = "md";
    }
  }
  const lines: string[] = [];
  for (let r = 0; r < CANVAS_ROWS; r += 2) {
    let line = "";
    let run = "";
    let runMd = false;
    const flush = () => { if (run) line += runMd ? paint(run) : run; run = ""; };
    // Stop at the last drawn cell: trailing blanks inside a painted run would
    // survive a trim once the colour codes wrap them.
    let end = WORDMARK_WIDTH;
    while (end > 0 && !grid[r]![end - 1] && !grid[r + 1]![end - 1]) end--;
    for (let x = 0; x < end; x++) {
      const top = grid[r]![x], bottom = grid[r + 1]![x];
      // "skill" and "md" never share a cell, so one colour per cell is enough.
      const md = (top ?? bottom) === "md";
      const ch = top && bottom ? "█" : top ? "▀" : bottom ? "▄" : " ";
      if (ch !== " " && md !== runMd) flush();
      if (ch !== " ") runMd = md;
      run += ch;
    }
    flush();
    lines.push(line);
  }
  return lines;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const easeIn = (t: number) => t * t;

/** The launch moment: the wordmark, then its two squares drop in one after the
 *  other with a small bounce. Under a second; any key skips to the end. Prints
 *  the finished logo straight away when motion isn't appropriate. */
export async function playLogo(opts: {
  out?: NodeJS.WriteStream;
  input?: NodeJS.ReadStream;
  env?: Env;
  indent?: string;
  animate?: boolean;
} = {}): Promise<void> {
  const out = opts.out ?? process.stdout;
  const input = opts.input ?? process.stdin;
  const env = opts.env ?? process.env;
  const indent = opts.indent ?? "  ";
  const animate = opts.animate ?? (canAnimate(out, env) && pc.isColorSupported && Boolean(input.isTTY));
  const show = (lines: string[]) => lines.map((l) => (l ? indent + l : "")).join("\n");

  if (!animate) {
    out.write(`${show(wordmarkLines())}\n`);
    return;
  }

  let skipped = false;
  const onKey = (key: Buffer) => {
    skipped = true;
    if (key.toString() === "\u0003") { out.write("\x1b[?25h\n"); process.exit(130); }
  };
  const restoreCursor = () => out.write("\x1b[?25h");
  out.write("\x1b[?25l");
  process.once("exit", restoreCursor);
  input.setRawMode?.(true);
  input.on("data", onKey);
  input.resume();

  let drawn = 0;
  const paint = (squares: readonly { x: number; y: number }[]) => {
    const lines = wordmarkLines(squares);
    out.write(`${drawn ? `\x1b[${drawn}A` : ""}${lines.map((l) => `\x1b[2K${l ? indent + l : ""}`).join("\n")}\n`);
    drawn = lines.length;
  };

  try {
    paint([]);
    await sleep(160);
    const [first, second] = SQUARES;
    for (const [n, target] of [first, second].entries()) {
      const landed = n === 0 ? [] : [first];
      const steps = 9;
      for (let s = 0; s <= steps && !skipped; s++) {
        paint([...landed, { x: target.x, y: -2 + (target.y + 2) * easeIn(s / steps) }]);
        await sleep(22);
      }
      if (skipped) break;
      paint([...landed, { x: target.x, y: target.y - 1 }]); // the bounce
      await sleep(40);
      paint([...landed, target]);
      await sleep(90);
    }
  } finally {
    paint(SQUARES);
    input.removeListener("data", onKey);
    input.setRawMode?.(false);
    input.pause();
    out.write("\x1b[?25h");
    process.removeListener("exit", restoreCursor);
  }
}

/** One-line brand mark for framed commands (`add`, `lint`): "skill" + orange "md". */
export function brandWord(env: Env = process.env, colour: boolean = pc.isColorSupported): string {
  return `${colour ? pc.bold("skill") : "skill"}${colour ? pc.bold(orange("md", env, colour)) : "md"}`;
}
