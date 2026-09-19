# typescript-react-nextjs-patterns

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8+-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react&logoColor=black)
![Next.js](https://img.shields.io/badge/Next.js-15+-000?logo=next.js)

> TypeScript, React, Next.js를 위한 실전형 Agent Skill

English README: [README.md](README.md)

실제 TypeScript 프론트엔드에서 일하는 AI 코딩 에이전트를 위한 구조화된 마크다운 레퍼런스입니다. 특히 React 패턴과 Next.js App Router 아키텍처에 강하게 초점을 맞추고 있습니다.

**npm 패키지가 아닙니다. 튜토리얼도 아닙니다.** 프론트엔드 엔지니어를 보조하는 AI 에이전트를 위한, 실무 중심의 필드 매뉴얼입니다.

## Before / After

### 이 skill이 없을 때

```ts
User: "이 API 호출 타입 잡아줘";
Agent: const user: User = await res.json(); // ❌ 런타임 검증 없음
```

### 이 skill이 있을 때

```ts
User: "이 API 호출 타입 잡아줘";
Agent: const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
});
type User = z.infer<typeof userSchema>;
const user = userSchema.parse(await res.json()); // ✅ 런타임 검증 + 타입 안정성
```

### 이 skill이 없을 때

```ts
User: "이 컴포넌트에 로딩 상태 추가해줘";
Agent: const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState(null);
const [data, setData] = useState(null); // ❌ boolean 플래그 + nullable 필드 남용
```

### 이 skill이 있을 때

```ts
User: "이 컴포넌트에 로딩 상태 추가해줘";
// 판별 유니온으로 불가능한 상태를 아예 표현할 수 없게 만듦
Agent: type State<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };
```

## 설치

```bash
# 전역 설치 (모든 프로젝트)
git clone https://github.com/leejpsd/typescript-react-nextjs-patterns.git ~/.claude/skills/typescript-react-nextjs-patterns

# 프로젝트 전용 설치
git clone https://github.com/leejpsd/typescript-react-nextjs-patterns.git .claude/skills/typescript-react-nextjs-patterns
```

Claude Code, Cursor, Codex, Gemini CLI, 그리고 `SKILL.md`를 읽을 수 있는 모든 에이전트에서 사용할 수 있습니다.

## 구조

```text
typescript-react-nextjs-patterns/
├── SKILL.md                                ← 허브: 에이전트 규칙, 의사결정 가이드, 체크리스트
├── HARD-RULES.md                           ← 모든 [HARD RULE]을 한 페이지로 (compaction 생존 키트)
├── rules/                                  ← 패턴 레퍼런스 모음 (필요할 때 로드)
│   ├── typescript-core.md                     narrowing, unions, generics, utility types, as const, satisfies
│   ├── react-typescript-patterns.md           Props, children, events, refs, hooks, context
│   ├── nextjs-typescript.md                   App Router, params, Server Actions, RSC, Cache Components, proxy.ts, useOptimistic
│   ├── component-patterns.md                  판별 Props, compound components, modal/dialog, polymorphic
│   ├── data-fetching-and-api-types.md         Fetch, Zod, TanStack Query, Result<T,E>, pagination, error handling
│   ├── forms-and-validation.md                Form state, Zod, react-hook-form, Server Actions, multi-step forms
│   ├── state-management.md                    local vs context vs Zustand (+ middleware) vs TanStack Query vs URL state
│   ├── performance-and-accessibility.md       메모이제이션, effects, semantic HTML, ARIA, focus management
│   ├── debugging-checklists.md                빠른 진단 라우터, serialization, null access
│   ├── code-review-rules.md                   risk vs preference, architecture smells, comment templates
│   └── anti-patterns.md                       흔한 실수 13가지와 원인, 해결법
├── playbooks/                              ← 단계별 디버깅 가이드
│   ├── type-error-debugging.md                체계적인 타입 에러 해결
│   ├── hydration-issues.md                    SSR/CSR mismatch 진단 흐름도
│   └── effect-dependency-bugs.md              loops, stale closures, useEffectEvent, StrictMode, cleanups
├── README.md
├── README.ko.md
└── LICENSE
```

## 버전 커버리지

마지막 최신화: **2026년 7월**. 문서가 다루는 기준선:

| 영역 | 기준 |
|------|------|
| React | **19.x 우선** — ref를 일반 prop으로, `<Context>` 프로바이더 문법, `use()`; **19.2**의 `useEffectEvent` + `<Activity>`; React 18 방식은 legacy로 라벨링해 유지; React Compiler 1.0 인식 |
| Next.js | **15+** (async `params`, 생성형 `PageProps<'/route'>` 헬퍼) 및 **16** (Cache Components `'use cache'` / `cacheLife` / `updateTag`, Node 런타임의 `proxy.ts`) |
| TypeScript | 예제는 5.5+ 기준 (inferred type predicates, `NoInfer`, const type params); **6.0**과 Go 네이티브 **7.0**까지 버전 노트 |
| 라이브러리 | Zod 4 (`z.email()`, `z.flattenError()`), TanStack Query v5, Zustand v5, react-hook-form 7, nuqs v2 |

버전 의존 규칙은 해당 위치에 라벨로 명시됩니다 (예: `forwardRef` — React 18 전용, Edge 런타임 middleware — Next.js 15 이하).

## 무엇이 다른가

대부분의 프론트엔드 skill은 TypeScript 팁 모음에 머무르지만, 이 skill은 React와 Next.js에서 에이전트가 실제로 자주 틀리는 지점을 더 깊게 다룹니다. Props 설계, effect 안정성, 상태 소유권, server/client boundary, `searchParams`, Server Actions, hydration, serialization, 그리고 리뷰 단계의 아키텍처 판단까지 실무 관점에서 다룹니다.

즉, 단순히 패턴을 나열하는 문서가 아니라 React와 Next.js 코드베이스에서 에이전트가 더 안전한 판단을 하도록 돕는 운영형 레퍼런스에 가깝습니다.

| 항목                   | 일반적인 skill | 이 skill                                                       |
| ---------------------- | -------------- | -------------------------------------------------------------- |
| React + Next.js 깊이   | 얕거나 범용적  | 실제 React 패턴과 Next.js App Router 제약을 깊게 다룸          |
| 패턴 가이드            | ✅             | ✅                                                             |
| 에이전트 행동 규칙     | ❌             | ✅ 무엇을 먼저 확인해야 하는지, 무엇을 가정하면 안 되는지 제시 |
| 의사결정 가이드        | ❌             | ✅ 상황별 추천 패턴과 참고 파일 제시                           |
| 디버깅 플레이북        | ❌             | ✅ 타입 에러, hydration, effect, serialization 대응            |
| 코드 리뷰 휴리스틱     | ❌             | ✅ risk vs preference, comment templates 제공                  |
| 규칙 분류              | ❌             | ✅ [HARD RULE] / [DEFAULT] / [SITUATIONAL]                     |
| 생성 + 리뷰 체크리스트 | ❌             | ✅ `SKILL.md`에 별도 제공                                      |
| compaction 복구        | ❌             | ✅ HARD-RULES.md 다이제스트 + 재독 지시                        |
| 버전 최신성            | React 18에 멈춤 | ✅ React 19.2 / Next.js 16 / Zod 4 / TS 7 기준, legacy 경로 라벨링 |

## Context Compaction에서 살아남기

에이전트 세션이 길어지면 컨텍스트가 압축(compaction)되고, 세션 초반에 로드된
skill 내용은 작업 도중 요약으로 대체되곤 합니다. 세 겹으로 대응합니다.

1. **디스크가 원본입니다.** compaction은 내용을 언로드할 뿐 파괴하지 않습니다.
   `SKILL.md`는 얇은 라우터라 복구 비용이 파일 하나 재독 수준이고, 압축 이후에는
   요약만 보고 답하지 말고 해당 rules 파일을 다시 읽으라는 지시가 명시되어 있습니다.
2. **`HARD-RULES.md`는 생존 키트입니다.** 모든 [HARD RULE]을 원본 파일 포인터와
   함께 한 페이지로 압축했습니다. 컨텍스트에 상주시켜도 부담 없는 크기입니다.
3. **선택: 자동 재주입.** `HARD-RULES.md`를 프로젝트 `CLAUDE.md`에 붙여넣거나,
   Claude Code의 `SessionStart` 훅을 걸어 compaction 후 세션이 재개될 때마다
   자동으로 다시 들어오게 할 수 있습니다. `.claude/settings.json`에:

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

`SessionStart` 훅의 stdout은 에이전트 컨텍스트에 추가되므로, 요약이 규칙을
밀어내는 순간 하드 룰이 대화에 다시 들어옵니다.

## 각 파일이 담고 있는 것

모든 모듈은 일관된 구조를 따릅니다.

- **Scope** + **Consult when** + **See also** (상호 참조)
- **핵심 규칙**을 [HARD RULE], [DEFAULT], [SITUATIONAL]로 구분
- **When to use / When NOT to use**
- 실제 프론트엔드 시나리오 기반의 **예제** (forms, APIs, lists, modals)
- 잘못된 접근을 보여주는 **반례**
- 무엇을 얻고 무엇을 잃는지 설명하는 **트레이드오프**
- 실제 장애로 이어지는 **공통 버그 패턴**
- PR에 바로 활용 가능한 **리뷰 체크리스트**

## 기여

PR은 언제나 환영합니다. 특히 아래 영역을 우선적으로 보강하고 싶습니다.

- Testing patterns (Vitest, Testing Library)
- Internationalization typing
- More debugging playbooks (React Query cache, Zustand devtools)
- Accessibility deep dive (ARIA patterns, focus management)
- Proxy (middleware) typing patterns

### 새 규칙을 기여하는 방법

새 규칙을 추가할 때는 기존 `rules/*.md` 문서의 템플릿을 따르는 것을 권장합니다.

1. Scope + Consult when + See also
2. [HARD RULE] / [DEFAULT] / [SITUATIONAL]로 라벨링된 패턴
3. 장난감 예제가 아닌 실제 예제
4. Common bug patterns
5. Review checklist

## 라이선스

MIT
