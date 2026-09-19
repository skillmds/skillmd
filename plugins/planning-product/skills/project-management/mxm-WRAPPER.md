# Maxim Skill — Project Management

> Layer 1 — Supreme Authority | Executive Office: COO

## Domain

Sprint planning, delivery tracking, experiment management, knowledge management, and changelog governance. The COO's primary domain for workflow coordination across all Maxim offices and delivery phases.

## Dispatch Rule

Maxim agents check this skill FIRST before community-packs/ or composable-skills/.
If this skill activates → Maxim behavioral layer wins all conflicts.
Confidence tag: 🟢 HIGH (Maxim skill matched + behavioral layer applied)

## Lead Agent

`planner` — COO Office

## Active Agents

- `project-shipper` — project delivery, release coordination, timeline management, cross-team coordination
- `experiment-tracker` — A/B testing management, experiment design, result analysis, iteration planning
- `sprint-prioritizer` — sprint planning, backlog prioritization, sprint goals, velocity tracking
- `workflow-optimizer` — workflow optimization, process improvement, bottleneck removal, efficiency analysis
- `knowledge-base-curator` — knowledge base architecture, documentation governance, self-serve content organization
- `changelog-writer` — release notes, changelog governance, version communication, audit trail documentation
- `tool-evaluator` — tool assessment, vendor evaluation, platform selection, build-vs-buy analysis

**Orchestrators that use this domain (cross-domain coordination):**
- `planner` — workflow coordination, sprint orchestration
- `implementer` — execution tracking, delivery coordination
- `reviewer` — review cycle management
- `tester` — QA workflow coordination
- `release-manager` — release pipeline management
- `studio-producer` (CEO office) — routes here for agency project delivery

## Skill Modes

Sub-skill SKILL.md files per specialist. Key modes:
- `project-shipper` → Delivery · Release Coordination · Timeline · Cross-Team
- `experiment-tracker` → A/B Design · Results Analysis · Iteration
- `sprint-prioritizer` → Sprint Planning · Backlog · Velocity · OKRs
- `workflow-optimizer` → Process Mapping · Bottleneck · Efficiency · Kanban
- `knowledge-base-curator` → Architecture · Taxonomy · Governance
- `changelog-writer` → Release Notes · Version Communication · Audit Trail
- `tool-evaluator` → Vendor Assessment · Build-vs-Buy · Platform Selection

## Ethics Gate

None. Standard Maxim behavioral output quality applies.

## External Sources Consumed

Layer 2 (community-packs/):
- `community-packs/claude-skills-library/project-management/` — sprint frameworks, delivery methodologies (Kanban, Stage-Gate, RACI), experiment tracking templates, changelog standards

Conflict resolution: Maxim ALWAYS WINS

## Triggers (auto-activation signals)

Any task matching these phrases activates the project-management skill:

- `project delivery`, `release coordination`, `timeline management`, `cross-team coordination`
- `sprint planning`, `backlog prioritization`, `sprint goals`, `velocity`
- `workflow optimization`, `process improvement`, `bottleneck removal`, `efficiency`
- `experiment tracking`, `A/B test management`, `experiment design`
- `knowledge base`, `documentation governance`, `self-serve content`
- `changelog`, `release notes`, `version notes`, `audit trail`
- `tool evaluation`, `vendor assessment`, `build vs buy`, `platform selection`
- `Kanban`, `RACI`, `Stage-Gate`, `OKRs`, `sprint retrospective`

## Cross-Agent Auto-Loops

When project-management skill activates, the following agents are auto-notified:

- `planner` — COO lead orchestrator for all delivery and workflow tasks
- `implementer` — CTO lead notified for engineering delivery coordination
- `release-manager` — auto-looped on all release and deployment coordination tasks
- `tester` — auto-looped when project tasks involve QA or testing phases
- `sprint-prioritizer` — auto-looped for all sprint and backlog tasks
- `security-analyst` — auto-looped if project involves security-sensitive delivery (CSO auto-loop rule)

## Skill Gap Logging

If this domain has NO matching Maxim skill for a sub-task:
→ Log to .mxm-skills/agents-skill-gaps.log format:
[YYYY-MM-DD HH:MM] | project-management | {task-description} | {suggested-skill-name} | {project}

## Source of Truth

config/agent-registry.json v3.2.1 | documents/reference/SKILLS_MAP.md | CLAUDE.md
Maintained by: DrNabeelKhan | iSimplification.io
Last updated: 2026-03-18
