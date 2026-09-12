import { Command } from "commander";
import * as p from "@clack/prompts";
import { readConfig, writeConfig, configPath, hostOf, DEFAULT_API } from "../config.js";

export function loginCommand(): Command {
  return new Command("login")
    .description("Store a SkillMD personal access token for publishing")
    .option("--token <token>", "token to store (otherwise prompt)")
    .option("--api <url>", "registry API base to store")
    .action(async (opts: { token?: string; api?: string }) => {
      let token = opts.token;
      if (!token) {
        const answer = await p.password({ message: "Paste your SkillMD token (from your account page)" });
        if (p.isCancel(answer)) { p.cancel("Cancelled."); return; }
        token = answer;
      }
      if (!token) { console.error("A token is required."); process.exitCode = 1; return; }
      const cfg = readConfig();
      cfg.token = token;
      if (opts.api) cfg.api = opts.api;
      // Bind the token to the host it was issued for — it is never sent anywhere else.
      cfg.tokenHost = hostOf(opts.api ?? cfg.api ?? DEFAULT_API);
      writeConfig(cfg);
      console.log(`Saved token to ${configPath()}`);
    });
}

export function logoutCommand(): Command {
  return new Command("logout")
    .description("Remove the stored SkillMD token")
    .action(() => {
      const cfg = readConfig();
      delete cfg.token;
      delete cfg.tokenHost;
      writeConfig(cfg);
      console.log("Removed stored token.");
    });
}
