import { Command } from "commander";
import { readFileSync } from "node:fs";
import { lintCommand } from "./commands/lint.js";
import { scanCommand } from "./commands/scan.js";
import { rulesCommand } from "./commands/rules.js";
import { initCommand } from "./commands/init.js";
import { searchCommand } from "./commands/search.js";
import { infoCommand } from "./commands/info.js";
import { addCommand } from "./commands/add.js";
import { listCommand } from "./commands/list.js";
import { removeCommand } from "./commands/remove.js";
import { updateCommand } from "./commands/update.js";
import { publishCommand } from "./commands/publish.js";
import { loginCommand, logoutCommand } from "./commands/login.js";
import { runInteractive } from "./commands/interactive.js";

// Read the version from the package this CLI is bundled into (resolved at runtime
// relative to the built file), so it never drifts from package.json.
let version = "0.0.0";
try {
  version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
} catch {
  /* keep fallback */
}

const program = new Command("skillmd")
  .version(version)
  .description("Lint, validate, and install Agent Skills from the SkillMD registry.")
  .option("--json", "machine-readable output")
  .option("--token <token>", "SkillMD personal access token")
  .option("--api <url>", "override the registry API base URL");

// Quality commands.
program.addCommand(lintCommand());
program.addCommand(scanCommand());
program.addCommand(rulesCommand());
program.addCommand(initCommand());

// Registry commands.
program.addCommand(searchCommand());
program.addCommand(infoCommand());
program.addCommand(addCommand());
program.addCommand(listCommand());
program.addCommand(removeCommand());
program.addCommand(updateCommand());

// Publish + auth.
program.addCommand(publishCommand());
program.addCommand(loginCommand());
program.addCommand(logoutCommand());

// With no command: launch the guided menu on a terminal, or print help when
// output is piped / non-interactive (CI).
if (process.argv.slice(2).length === 0) {
  if (process.stdout.isTTY) {
    await runInteractive();
    process.exit(process.exitCode ?? 0);
  }
  program.outputHelp();
  process.exit(0);
}

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
