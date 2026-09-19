# typescript-react-nextjs-patterns
![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8+-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react&logoColor=black)
![Next.js](https://img.shields.io/badge/Next.js-15+-000?logo=next.js)

> Production-grade Agent Skill for TypeScript, React, and Next.js.

Korean README: [README.ko.md](README.ko.md)

A structured markdown reference built for AI coding agents working on real TypeScript frontends, with especially strong coverage of React patterns and Next.js App Router architecture.

**Not an npm package. Not a tutorial.** A field manual for AI agents helping frontend engineers.

## Before / After

### Without this skill

```
User: "Type this API call"
Agent: const user: User = await res.json()  // ❌ no runtime validation
```

### With this skill

```
User: "Type this API call"
Agent:
  const userSchema = z.object({ id: z.string(), name: z.string(), email: z.email() })
  type User = z.infer<typeof userSchema>
  const user = userSchema.parse(await res.json())  // ✅ runtime + type safety
```

### Without this skill

```
User: "Add loading state to this component"
Agent: const [isLoading, setIsLoading] = useState(false)
       const [error, setError] = useState(null)
       const [data, setData] = useState(null)  // ❌ boolean flags, nullable fields
```

### With this skill

```
User: "Add loading state to this component"
Agent: // Uses discriminated union — impossible states are unrepresentable
  type State<T> =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'success'; data: T }
    | { status: 'error'; error: Error }
```

## Install

```bash
# Global (all projects)
git clone https://github.com/leejpsd/typescript-react-nextjs-patterns.git ~/.claude/skills/typescript-react-nextjs-patterns

# Project-only
git clone https://github.com/leejpsd/typescript-react-nextjs-patterns.git .claude/skills/typescript-react-nextjs-patterns
```

Compatible with Claude Code, Cursor, Codex, Gemini CLI, and any agent reading `SKILL.md`.

## Structure

```
typescript-react-nextjs-patterns/
├── SKILL.md                                ← Hub: agent rules, decision guide, checklists
├── HARD-RULES.md                           ← Every [HARD RULE] on one page (compaction survival kit)
├── rules/                                  ← Pattern references (loaded on demand)
│   ├── typescript-core.md                     Narrowing, unions, generics, utility types, as const, satisfies
│   ├── react-typescript-patterns.md           Props, children, events, refs, hooks, context
│   ├── nextjs-typescript.md                   App Router, params, Server Actions, RSC, Cache Components, proxy.ts, useOptimistic
│   ├── component-patterns.md                  Discriminated Props, compound components, modal/dialog, polymorphic
│   ├── data-fetching-and-api-types.md         Fetch, Zod, TanStack Query, Result<T,E>, pagination, error handling
│   ├── forms-and-validation.md                Form state, Zod, react-hook-form, Server Actions, multi-step forms
│   ├── state-management.md                    Local vs context vs Zustand (+ middleware) vs TanStack Query vs URL
│   ├── performance-and-accessibility.md       Memoization, effects, semantic HTML, ARIA, focus management
│   ├── debugging-checklists.md                Quick diagnosis router, serialization, null access
│   ├── code-review-rules.md                   Risk vs preference, architecture smells, comment templates
│   └── anti-patterns.md                       13 common mistakes with root causes and fixes
├── playbooks/                              ← Step-by-step debugging guides
│   ├── type-error-debugging.md                Systematic type error resolution
│   ├── hydration-issues.md                    SSR/CSR mismatch diagnosis flowchart
│   └── effect-dependency-bugs.md              Loops, stale closures, useEffectEvent, StrictMode, cleanups
├── README.md
└── LICENSE
```

## Version Coverage

Last currency sweep: **July 2026**. The content documents:

| Area | Baseline |
|------|----------|
| React | **19.x-first** — ref as prop, `<Context>` provider syntax, `use()`; **19.2** `useEffectEvent` + `<Activity>`; React 18 variants kept and marked as legacy; React Compiler 1.0 awareness |
| Next.js | **15+** (async `params`, generated `PageProps<'/route'>` helpers) and **16** (Cache Components `'use cache'` / `cacheLife` / `updateTag`, `proxy.ts` on the Node runtime) |
| TypeScript | 5.5+ in examples (inferred type predicates, `NoInfer`, const type params); version notes through **6.0** and the Go-native **7.0** |
| Libraries | Zod 4 (`z.email()`, `z.flattenError()`), TanStack Query v5, Zustand v5, react-hook-form 7, nuqs v2 |

Version-dependent rules are labeled in place (e.g. `forwardRef` — React 18 codebases only; Edge-runtime middleware — Next.js ≤15).

## What Makes This Different

Most frontend skills stop at generic TypeScript tips. This one is intentionally stronger on React and Next.js, where coding agents most often make costly mistakes: props design, effects, state ownership, server/client boundaries, `searchParams`, Server Actions, hydration, serialization, and review-time architecture tradeoffs.

It is designed not just to suggest patterns, but to help an agent make safer decisions in production React and Next.js codebases.

| Feature | Typical skill | This skill |
|---------|-------------|-----------|
| React + Next.js depth | Limited or generic | Strong coverage of real React patterns and Next.js App Router constraints |
| Pattern guidance | ✅ | ✅ |
| Agent behavior rules | ❌ | ✅ What to check first, what NOT to assume |
| Decision guide | ❌ | ✅ Situation → recommended pattern → file |
| Debugging playbooks | ❌ | ✅ Type errors, hydration, effects, serialization |
| Code review heuristics | ❌ | ✅ Risk vs preference, comment templates |
| Rule classification | ❌ | ✅ [HARD RULE] / [DEFAULT] / [SITUATIONAL] |
| Generation + review checklists | ❌ | ✅ Separate checklists in SKILL.md |
| Compaction recovery | ❌ | ✅ HARD-RULES.md digest + re-read instructions |
| Version currency | Often frozen at React 18 | ✅ React 19.2 / Next.js 16 / Zod 4 / TS 7 baseline, legacy paths labeled |

## Surviving Context Compaction

Long agent sessions get compacted, and skill content loaded early is often
summarized away mid-task. Three layers deal with this:

1. **Disk is the source of truth.** Compaction unloads content; it never destroys
   it. `SKILL.md` is a thin router, so recovery costs one file read — and it
   explicitly instructs agents to re-read the relevant rules file after compaction
   instead of answering from the summary.
2. **`HARD-RULES.md` is the survival kit.** Every [HARD RULE] compressed to one
   page, with pointers back to the source files. Small enough to stay in context
   permanently.
3. **Optional: re-inject automatically.** Paste `HARD-RULES.md` into your
   project's `CLAUDE.md`, or add a Claude Code `SessionStart` hook so it comes
   back on its own whenever a session resumes from compaction. In
   `.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "compact",
        "hooks": [
          {
            "type": "command",
            "command": "cat .claude/skills/typescript-react-nextjs-patterns/HARD-RULES.md"
          }
        ]
      }
    ]
  }
}
```

`SessionStart` hook stdout is added to the agent's context, so the hard rules
re-enter the conversation the moment the summary replaces them.

## Each File Contains

Consistent structure across all modules:

- **Scope** + **Consult when** + **See also** (cross-references)
- **Key rules** labeled as [HARD RULE], [DEFAULT], or [SITUATIONAL]
- **When to use / When NOT to use**
- **Examples** from real frontend scenarios (forms, APIs, lists, modals)
- **Counterexamples** showing the wrong approach
- **Tradeoffs** — what you gain and what you lose
- **Common bug patterns** — specific failure modes
- **Review checklist** — copy-pasteable for PRs

## Contributing

PRs welcome. Priority areas:

- Testing patterns (Vitest, Testing Library)
- Internationalization typing
- More debugging playbooks (React Query cache, Zustand devtools)
- Accessibility deep dive (ARIA patterns, focus management)
- Proxy (middleware) typing patterns

### How to contribute a new rule

Each file should follow the template in any existing `rules/*.md` file:
1. Scope + Consult when + See also
2. Patterns labeled [HARD RULE] / [DEFAULT] / [SITUATIONAL]
3. Real-world examples (not toy math examples)
4. Common bug patterns
5. Review checklist

## License

MIT
