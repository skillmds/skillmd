// Registry titles/descriptions and SKILL.md frontmatter are untrusted text.
// Printed raw they can carry ANSI/OSC sequences that clear the screen, move
// the cursor over our own security-flags line, or set the terminal title.
// Strip anything that is not printable before it reaches a terminal.

// ESC [ … final byte (CSI) | ESC ] … BEL/ST (OSC) | other ESC-prefixed
// two-byte sequences | lone C0 (except \t \n) | C1 (0x80–0x9f).
const CSI = /\x1b\[[0-?]*[ -/]*[@-~]/g;
const OSC = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;
const ESC_OTHER = /\x1b[@-Z\\-_]/g;
const C0 = /[\x00-\x08\x0b-\x1f\x7f]/g;
const C1 = /[\x80-\x9f]/g;

export function stripTerminalEscapes(input: string): string {
  return input.replace(OSC, "").replace(CSI, "").replace(ESC_OTHER, "").replace(C0, "").replace(C1, "");
}

/** One-line, escape-free, length-capped rendering of an untrusted string. */
export function safeText(input: unknown, max = 400): string {
  if (typeof input !== "string") return "";
  const flat = stripTerminalEscapes(input).replace(/\s*\n\s*/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1).trimEnd()}…`;
}
