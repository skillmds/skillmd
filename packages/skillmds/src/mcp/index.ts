// Entry for bin/skillmd-mcp.mjs. Same dispatch rule as before: any argv or a
// TTY stdin means "run the CLI"; a bare invocation over piped stdio is how MCP
// clients launch us.
import { startMcpServer } from "./server.js";

if (process.argv.length > 2 || process.stdin.isTTY) {
  await import("../index.js"); // the CLI parses process.argv itself
} else {
  await startMcpServer();
}
