# Maxim Skill — Product

> Layer 1 — Supreme Authority | Executive Office: CPO

## Domain

Strategic product decisions, pricing strategy, backlog prioritisation, and trend intelligence. The "deciding what to build" domain — distinct from product-development-research (which handles discovering and validating what to build).

## Dispatch Rule

Maxim agents check this skill FIRST before community-packs/ or composable-skills/.
If this skill activates → Maxim behavioral layer wins all conflicts.
Confidence tag: 🟢 HIGH (Maxim skill matched + behavioral layer applied)

## Lead Agent

`product-strategist` — CPO Office

## Active Agents

- `feedback-synthesizer` — synthesizes user feedback, support tickets, NPS data into product signals
- `pricing-strategist` — pricing model design, value-based pricing, competitive pricing analysis
- `trend-researcher` — market trend intelligence, emerging signal detection, strategic trend application
- `sprint-prioritizer` — sprint planning, backlog prioritization, sprint goals, velocity tracking (COO office, routes here for product backlog work)
- `product-manager` — product management, cross-functional coordination, feature scoping (CPO office)

## Skill Modes

Sub-skill SKILL.md files per specialist. Key modes:
- `feedback-synthesizer` → Synthesis · Insight Extraction · Signal Prioritization
- `pricing-strategist` → Value-Based · Competitive · Freemium · Enterprise
- `trend-researcher` → Signal Detection · Trend Analysis · Strategic Application
- `sprint-prioritizer` → Sprint Planning · Backlog Grooming · Velocity · OKRs
- `product-manager` → Feature Scoping · Roadmap · Stakeholder Alignment

## Ethics Gate

None. Standard Maxim behavioral output quality applies.
Note: When product decisions involve user behavioral data or PII → compliance skill auto-looped (CSO auto-loop rule).

## External Sources Consumed

Layer 2 (community-packs/):
- `community-packs/claude-skills-library/product-team/` — product strategy frameworks, roadmap templates, prioritization models (RICE, WSJF, ICE), product discovery patterns

Conflict resolution: Maxim ALWAYS WINS

## Triggers (auto-activation signals)

Any task matching these phrases activates the product skill:

- `product strategy`, `product roadmap`, `go-to-market`, `product vision`
- `sprint planning`, `backlog prioritization`, `sprint goals`, `velocity`
- `pricing model`, `pricing strategy`, `value-based pricing`, `freemium`
- `feature prioritization`, `what to build`, `product decision`
- `user feedback`, `NPS`, `feedback synthesis`, `product signal`
- `trend research`, `market signal`, `trend intelligence`
- `OKRs`, `product metrics`, `product KPIs`, `north star metric`
- `RICE`, `WSJF`, `ICE scoring`, `prioritization framework`

## Cross-Agent Auto-Loops

When product skill activates, the following agents are auto-notified:

- `product-strategist` — CPO lead for all strategic product decisions
- `product-development-research` skill — auto-looped when product decisions require research validation
- `sprint-prioritizer` — auto-looped for all backlog and sprint planning tasks
- `behavior-science-persuasion` skill — auto-looped for pricing psychology and user motivation analysis
- `design` skill — auto-looped when product decisions require UX validation
- `security-analyst` — auto-looped if product features involve auth, payments, or PII (CSO auto-loop rule)

## Skill Gap Logging

If this domain has NO matching Maxim skill for a sub-task:
→ Log to .mxm-skills/agents-skill-gaps.log format:
[YYYY-MM-DD HH:MM] | product | {task-description} | {suggested-skill-name} | {project}

## Source of Truth

config/agent-registry.json v3.2.1 | documents/reference/SKILLS_MAP.md | CLAUDE.md
Maintained by: DrNabeelKhan | iSimplification.io
Last updated: 2026-03-18
