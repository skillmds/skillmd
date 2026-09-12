// Shared caps for anything the CLI or MCP server downloads and writes. Skills
// are docs-plus-templates, not datasets: a tree past these limits is either
// the wrong directory or something hostile.
export const MAX_PACK_FILES = 200;
export const MAX_PACK_BYTES = 20 * 1024 * 1024;
/** Every network call gets this budget (registry, GitHub raw, gist, giget). */
export const FETCH_TIMEOUT_MS = 30_000;
/** Windows reserved device names — mkdir/writeFile fail on them in confusing ways. */
export const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;
