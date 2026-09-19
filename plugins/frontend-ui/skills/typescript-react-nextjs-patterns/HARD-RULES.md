# Hard Rules Digest

Every [HARD RULE] in this skill, one line each. This file exists for context-loss
recovery: it is small enough to re-inject after compaction — via CLAUDE.md, a
`SessionStart` hook, or a manual re-read — so the non-negotiable rules survive even
when the loaded rule files have been summarized away.

Each section names its source files. The digest tells you *what* the rule is;
read the source file before applying it to a non-obvious case — that's where the
reasoning, examples, and exceptions-that-aren't-exceptions live.

## TypeScript

Sources: `rules/typescript-core.md`, `playbooks/type-error-debugging.md`

- Narrow with `typeof` / `in` / `instanceof` / equality — not type assertions.
- Use `unknown` + narrowing, never `any`. `any` infects downstream code.
- Never "fix" a type error with `as`, `any`, `@ts-ignore`, or a blind `| undefined`.

## Trust boundaries

Sources: `rules/data-fetching-and-api-types.md`, `rules/forms-and-validation.md`

- Validate ALL external data at runtime (API responses, URL params, FormData,
  localStorage, postMessage). Zod or equivalent. Static types validate nothing.
- Validate environment variables with a schema at startup.
- FormData values are `string | File | null` — never `as string` without checking.
- Validate on both client AND server: client for UX, server for security.

## React

Sources: `rules/react-typescript-patterns.md`, `rules/state-management.md`,
`rules/performance-and-accessibility.md`

- Props: `interface`, extend native HTML attributes when wrapping elements,
  `?` only on truly optional fields.
- `children` is `React.ReactNode`, never `JSX.Element`.
- Never copy server data into client state — the query owns the data.
- Zustand: select slices (`useStore(s => s.x)`), never the whole store.
  Persisted stores need `version` + `migrate`.
- Effect deps: no objects/arrays — destructure to primitives. Effects that add
  listeners, timers, or subscriptions need cleanup.
- Don't pass freshly created objects/callbacks to memoized children.

## Next.js

Source: `rules/nextjs-typescript.md`

- 15+: `params` and `searchParams` are Promises — await them.
- Server Components are the default; push `"use client"` as deep as possible.
- Props crossing the server/client boundary must be RSC-serializable: plain
  callbacks and class instances can't cross; `Date`, `Map`, `Set`, TypedArrays,
  and Promises can. Pages Router `getServerSideProps` is stricter — JSON only.
- Protect server-only modules with `import 'server-only'`.
- `middleware.ts` (≤15) runs on the Edge runtime — Web APIs only, no Node.js APIs.
  Next.js 16 renames it `proxy.ts` (export `proxy`) and runs it on Node.js.

## Hydration

Source: `playbooks/hydration-issues.md`

- `typeof window !== 'undefined'` in render does NOT fix hydration mismatches —
  the client runs both paths during hydration and compares.

## Accessibility

Source: `rules/performance-and-accessibility.md`

- Every `<input>` has a `<label>` (visible or `aria-label`); error messages use
  `role="alert"`.
- Interactive elements: focusable, keyboard-operable, accessibly named.
- Contrast: 4.5:1 for normal text, 3:1 for large text and UI components.

## Review

Source: `rules/code-review-rules.md`

- Flag as risk, not preference: `any` / `as` / `!` without justification, missing
  trust-boundary validation, object/array effect deps, missing effect cleanup,
  server data in `useState`, `"use client"` at page level, un-awaited `params`,
  Server Actions without FormData validation.
