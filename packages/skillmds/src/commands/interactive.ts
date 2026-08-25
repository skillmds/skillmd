// Guided interactive mode, shown when `skillmd` is run with no command on a TTY.
import * as p from "@clack/prompts";
import pc from "picocolors";
import { runLint } from "./lint.js";
import { runScan } from "./scan.js";
import { runSearch, formatStars, truncate } from "./search.js";
import type { SearchItem } from "./search.js";
import { runAdd } from "./add.js";
import { initSkill } from "./init.js";
import { installedSkills } from "../agents.js";
import { parseSkillMd } from "@skillmd/core";

function bail(v: unknown): v is symbol {
  if (p.isCancel(v)) {
    p.cancel("Cancelled.");
    return true;
  }
  return false;
}

/** Browse search results: pick one, see a compact card, install (project or
 *  global), or peek at the page URL — looping back to the results list after
 *  each action so the user can keep grabbing skills without re-querying. */
async function browseSearchResults(items: SearchItem[]): Promise<void> {
  const cols = process.stdout.columns ?? 80;
  for (;;) {
    const picked = await p.select({
      message: "Search results",
      options: [
        ...items.map((item) => {
          // Build the label twice: a plain (uncolored) version whose length is
          // the VISIBLE width clack repaints against, and the colored version we
          // actually show. Measuring the colored string would over-count the
          // ANSI escapes and let soft-wrap break clack's frame accounting.
          const starsTxt = item.repo_stars != null ? ` ★${formatStars(item.repo_stars)}` : "";
          const checkTxt = item.verified ? " ✓" : "";
          const plainLabel = `${item.slug}${starsTxt}${checkTxt}`;
          const label = `${pc.bold(item.slug)}${starsTxt ? pc.dim(starsTxt) : ""}${checkTxt ? pc.green(checkTxt) : ""}`;
          const hintWidth = Math.max(10, cols - plainLabel.length - 6);
          return {
            value: item.slug,
            label,
            hint: truncate(item.description ?? "", hintWidth),
          };
        }),
        { value: "__back", label: "← Back to menu" },
      ],
    });
    if (p.isCancel(picked) || picked === "__back") return;

    const item = items.find((i) => i.slug === picked);
    if (!item) continue;

    await browseOneResult(item);
  }
}

/** Compact card + action menu for a single picked result. Loops until the
 *  user backs out to the results list. */
async function browseOneResult(item: SearchItem): Promise<void> {
  // Print the card once on entry; the loop below only re-renders the action
  // select so "Show page URL" and post-install status don't re-dump the note.
  const starsTxt = item.repo_stars != null ? `★ ${formatStars(item.repo_stars)} stars` : "";
  const meta = [
    starsTxt,
    item.verified ? pc.green("✓ verified") : "unverified",
    item.type === "pack" ? "pack" : "",
  ].filter(Boolean).join(" · ");
  p.note([item.description ?? "", pc.dim(meta)].join("\n"), item.slug);

  for (;;) {
    const action = await p.select({
      message: "What next?",
      options: [
        { value: "project", label: "Install to this project" },
        { value: "global", label: "Install globally (user dir)" },
        { value: "url", label: "Show page URL" },
        { value: "back", label: "← Back to results" },
      ],
    });
    if (p.isCancel(action) || action === "back") return;

    if (action === "url") {
      p.log.message(pc.dim(`https://skillmd.com/skills/${item.slug}`));
      continue;
    }

    // No spinner around runAdd: it may open its own clack confirm prompt for
    // unverified skills, and a live spinner garbles the terminal around prompts.
    p.log.step(`Installing ${item.slug}…`);
    try {
      const run = await runAdd(item.slug, action === "global" ? { global: true } : {});
      console.log(run.output);
      if (run.exitCode === 0) p.log.success("Installed.");
      else p.log.warn("Not installed.");
    } catch (err) {
      p.log.error(err instanceof Error ? err.message : String(err));
    }
    // fall through to the same card so the user can try another action
  }
}

export async function runInteractive(): Promise<void> {
  p.intro(pc.bgCyan(pc.black(" skillmd ")));

  // Menu loops until Quit/cancel so one action doesn't silently end the session.
  for (;;) {
  const action = await p.select({
    message: "What would you like to do?",
    options: [
      { value: "lint", label: "Lint a skill", hint: "validate a SKILL.md" },
      { value: "scan", label: "Security scan", hint: "scripts, network, secrets" },
      { value: "search", label: "Search the registry" },
      { value: "init", label: "Create a new skill" },
      { value: "list", label: "List installed skills" },
      { value: "help", label: "Show all commands" },
      { value: "quit", label: "Quit" },
    ],
  });
  if (bail(action) || action === "quit") break;

  switch (action) {
    case "lint":
    case "scan": {
      const path = await p.text({ message: "Path to a skill or folder", placeholder: ".", defaultValue: "." });
      if (bail(path)) break;
      const target = String(path || ".");
      const s = p.spinner();
      s.start(action === "lint" ? "Linting" : "Scanning");
      try {
        const run = action === "lint"
          ? await runLint(target, { format: "text" })
          : await runScan(target, { format: "text" });
        s.stop("Done");
        console.log(run.output);
        process.exitCode = run.exitCode;
      } catch (err) {
        s.stop(pc.red(err instanceof Error ? err.message : String(err)));
        process.exitCode = 1;
      }
      break;
    }
    case "search": {
      const query = await p.text({ message: "Search the registry for" });
      if (bail(query)) break;
      const verified = await p.confirm({ message: "Verified skills only?", initialValue: false });
      if (bail(verified)) break;
      const s = p.spinner();
      s.start("Searching");
      try {
        const run = await runSearch(String(query), { verified: Boolean(verified), limit: "20" });
        s.stop(`${run.items.length} result${run.items.length === 1 ? "" : "s"}`);
        if (run.items.length === 0) {
          p.log.info("No results.");
          break;
        }
        await browseSearchResults(run.items);
      } catch (err) {
        s.stop(pc.red(err instanceof Error ? err.message : String(err)));
        process.exitCode = 1;
      }
      break;
    }
    case "init": {
      const name = await p.text({ message: "Skill name", placeholder: "my-skill" });
      if (bail(name)) break;
      const description = await p.text({ message: "One-line description", placeholder: "What this skill helps an agent do" });
      if (bail(description)) break;
      try {
        const file = initSkill(String(name), { description: String(description || "") });
        p.log.success(`Created ${pc.bold(file)}`);
      } catch (err) {
        p.log.error(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      }
      break;
    }
    case "list": {
      // project and global are separate scopes in installedSkills — show both
      const skills = [...installedSkills({}), ...installedSkills({ global: true })];
      if (skills.length === 0) {
        p.log.info("No installed skills found (checked this folder and your user directory).");
      } else {
        p.log.message(
          skills
            .map((sk) => {
              const parsed = parseSkillMd(sk.raw);
              const desc = "error" in parsed ? pc.red(`(invalid SKILL.md — ${parsed.error})`) : pc.dim(parsed.description.slice(0, 70));
              return `${pc.bold(sk.name)} ${pc.dim(`[${sk.agent}/${sk.scope}]`)}\n  ${desc}`;
            })
            .join("\n"),
        );
      }
      break;
    }
    case "help": {
      p.note(
        [
          `${pc.bold("lint")} [path]      validate SKILL.md + quality score`,
          `${pc.bold("scan")} [path]      security scan`,
          `${pc.bold("search")} <query>   search the registry`,
          `${pc.bold("add")} <source>     install a skill (lints first)`,
          `${pc.bold("info")} <slug>      registry details for a skill`,
          `${pc.bold("init")} [name]      scaffold a new skill`,
          `${pc.bold("list / remove / update")}   manage installed skills`,
          `${pc.bold("publish")} [path]   publish (fails on lint errors)`,
          `${pc.bold("rules / login")}`,
        ].join("\n"),
        "Commands (run: skillmd <command>)",
      );
      break;
    }
  }
  }

  p.outro(pc.dim("skillmd.com"));
}
