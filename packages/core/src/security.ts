// Line-aware security scanner. Shared by the registry and the CLI so both
// surface identical flags, reporting a line number + snippet for each finding
// (used by lint/scan + SARIF).

export type SecurityFlag = "docs_only" | "executes_scripts" | "network_calls" | "reads_secrets" | "untrusted_install";

// untrusted_install: fetch-and-execute from a source the user doesn't implicitly
// trust — a custom npm/pip registry (attacker-controlled supply chain), piping a
// download straight into a shell, or installing from a raw URL. These are the
// patterns the AI verdict floors to "warning" (see audit pipeline) because a
// pinned version is no protection when the registry itself is the attacker's.
export const UNTRUSTED_INSTALL_RE = new RegExp(
  [
    /(?:npx|npm|yarn|pnpm|bun)\b[^\n]*--registry[= ]/.source, // custom npm registry
    /npm\s+config\s+set\s+registry/.source,
    /pip3?\s+install\b[^\n]*(?:--index-url|--extra-index-url|-i\s+https?:)/.source, // custom pip index
    /(?:curl|wget)\b[^\n|]*\|\s*(?:sudo\s+)?(?:ba|z|fi)?sh\b/.source, // curl … | sh
    /(?:iwr|irm|invoke-webrequest|invoke-restmethod)\b[^\n|]*\|\s*iex\b/.source, // PowerShell pipe-to-exec
    /bash\s+<\(\s*(?:curl|wget)/.source, // bash <(curl …)
    /(?:pip3?|npm|npx)\s+(?:install|--yes|-y)?\s*[^\n]*https?:\/\/(?!registry\.npmjs\.org|pypi\.org|files\.pythonhosted\.org)[^\s'"`]+\.(?:whl|tar\.gz|tgz|zip)\b/.source, // install from raw archive URL
  ].join("|"),
  "i",
);

const RULES: [Exclude<SecurityFlag, "docs_only">, RegExp][] = [
  ["untrusted_install", UNTRUSTED_INSTALL_RE],
  ["executes_scripts", /```(?:sh|bash|python|py|js|ts|ruby|rb)\b|\b(subprocess|os\.system|child_process|exec\()/i],
  ["network_calls", /\b(fetch|requests\.|urllib|axios|curl|wget|https?:\/\/|websocket)\b/i],
  ["reads_secrets", /\b(api[_-]?key|secret|token|password|os\.environ|process\.env|getenv)\b/i],
];

export interface SecurityFinding {
  flag: Exclude<SecurityFlag, "docs_only">;
  line: number;
  snippet: string;
}

export interface SecurityResult {
  flags: SecurityFlag[];
  findings: SecurityFinding[];
}

export function scanSecurity(body: string): SecurityResult {
  const findings: SecurityFinding[] = [];
  body.split(/\r?\n/).forEach((text, i) => {
    for (const [flag, re] of RULES) {
      if (re.test(text)) findings.push({ flag, line: i + 1, snippet: text.trim().slice(0, 120) });
    }
  });
  const flags = [...new Set(findings.map((f) => f.flag))];
  return { flags: flags.length ? flags : ["docs_only"], findings };
}
