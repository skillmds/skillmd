# Maxim Wrapper — Design Resources

## Behavioral Layer

This skill is a **reference library**, not a generative skill. It provides raw design data (values, ratios, checklists, patterns) that other Maxim skills and agents consume.

## Maxim Enhancement Rules

When any design agent loads a reference from this library:

1. **Context-aware selection** — Only load the reference files relevant to the current task. Do not dump the entire library.
2. **Project override check** — Always check if the active project has a customized `DESIGN.md` in its root or `documents/architecture/`. Project-specific values override these defaults.
3. **Behavioral framing** — When presenting design choices to users, apply:
   - **Aesthetic-Usability Effect** — beautiful things are perceived as more usable
   - **Cognitive Load Theory** — reduce choices, increase clarity
   - **Hick's Law** — fewer options = faster decisions
   - **Fitts's Law** — size and distance affect interaction cost
4. **Confidence tagging** — All outputs using these references: 🟢 HIGH (standards-based data)
5. **Accessibility auto-check** — Any visual design output must cross-reference `references/accessibility.md` for contrast and target size compliance

## Conflict Resolution

- Project DESIGN.md overrides library defaults
- Maxim behavioral framing always applied on top of raw reference data
- If external skill (ui-ux-pro-max-skill) conflicts with these references, Maxim values win

## CSO Auto-Loop

- PII in design mockups → flag to security-analyst
- Third-party font/asset licensing → flag to compliance skill
- Cookie consent UI patterns → flag to data-privacy-officer
