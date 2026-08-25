import { Command } from "commander";
import pc from "picocolors";
import { createClient } from "../api.js";

interface SearchFlags {
  category?: string;
  verified?: boolean;
  type?: "single" | "pack";
  minRating?: string;
  limit?: string;
  json?: boolean;
  token?: string;
  api?: string;
}

export interface SearchItem {
  slug: string;
  title: string;
  description: string;
  verified?: boolean;
  type?: "single" | "pack";
  repo_stars?: number | null;
  install_count?: number;
  avg_rating?: number;
  rating_count?: number;
}

const MAX_LINE_WIDTH = 100;

// compact star count: 2500000 → "2.5M", 223700 → "223.7k", 970 → "970", 42048 → "42k"
export function formatStars(n: number): string {
  if (n >= 1_000_000) {
    const m = Math.round((n / 1_000_000) * 10) / 10;
    return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (n >= 1000) {
    const k = Math.round((n / 1000) * 10) / 10;
    return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return String(n);
}

/** Truncate text to fit `width` columns, appending an ellipsis when cut. */
export function truncate(text: string, width: number): string {
  if (text.length <= width) return text;
  if (width <= 1) return "…";
  return `${text.slice(0, width - 1).trimEnd()}…`;
}

/** Render one search result as a two-line, non-wrapping card:
 *    bold(slug)  dim(★ stars)  [✓]  dim([pack])
 *      dim(description, truncated to fit the terminal)
 */
export function formatSearchResult(item: SearchItem, width: number = process.stdout.columns ?? 80): string {
  const stars = item.repo_stars != null ? pc.dim(`★ ${formatStars(item.repo_stars)}`) : "";
  const check = item.verified ? pc.green("✓") : "";
  const pack = item.type === "pack" ? pc.dim("[pack]") : "";
  const head = [pc.bold(item.slug), stars, check, pack].filter(Boolean).join(" ");

  const indent = "  ";
  const lineWidth = Math.max(10, Math.min(width, MAX_LINE_WIDTH) - indent.length);
  const desc = `${indent}${pc.dim(truncate(item.description ?? "", lineWidth))}`;

  return `${head}\n${desc}`;
}

export async function runSearch(query: string, flags: SearchFlags): Promise<{ items: SearchItem[]; output: string }> {
  const { api } = createClient(flags);
  // Mirrors the skillmd_search query building in bin/skillmd-mcp.mjs.
  const params = new URLSearchParams({ q: query, limit: String(flags.limit ?? 20) });
  if (flags.category) params.set("category", flags.category);
  if (flags.verified) params.set("verified", "true");
  if (flags.type) params.set("type", flags.type);
  if (flags.minRating != null) params.set("min_rating", String(flags.minRating));

  const r = await api<{ items?: SearchItem[] }>(`/api/search?${params}`);
  const items = r.items ?? [];

  if (flags.json) return { items, output: JSON.stringify(items, null, 2) };

  const lines = items.map((s) => formatSearchResult(s));
  return { items, output: lines.join("\n\n") || "No skills found." };
}

export function searchCommand(): Command {
  return new Command("search")
    .description("Search the SkillMD registry")
    .argument("<query>", "search terms")
    .option("--category <slug>", "filter by category")
    .option("--verified", "only verified skills")
    .option("--type <type>", "single | pack")
    .option("--min-rating <n>", "minimum average rating (0-5)")
    .option("--limit <n>", "max results", "20")
    .option("--json", "machine-readable output")
    .action(async (query: string, opts: SearchFlags, cmd: Command) => {
      const merged = { ...cmd.parent?.opts(), ...opts };
      const run = await runSearch(query, merged);
      console.log(run.output);
    });
}
