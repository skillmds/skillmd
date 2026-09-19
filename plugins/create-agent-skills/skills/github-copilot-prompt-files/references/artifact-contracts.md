# Prompt contract

Prompt files use `.prompt.md`. The file name is the default slash name; a
frontmatter `name` can override it. `agent` can be a built-in mode or custom
agent, `tools` is a list, and `model` must name a model exposed by the host.
Use `#tool:<tool-name>` only for an inspected tool. Keep input placeholders
named, unique, and tied to observable output fields.
