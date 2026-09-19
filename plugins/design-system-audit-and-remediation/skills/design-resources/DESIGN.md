# DESIGN.md — Project Design System Standard

> **TEMPLATE** — Copy this file to your project root or `documents/architecture/` and fill in your brand values.
> Remove placeholder examples and replace with your actual design decisions.

---

## 1. Visual Theme & Atmosphere

Define the emotional and aesthetic direction of the product.

**Mood Keywords:** `[modern, clean, trustworthy]` | `[playful, vibrant, energetic]` | `[premium, minimal, sophisticated]`

**Visual References:**
- Primary inspiration: `[e.g., Linear — precision + clarity]`
- Secondary inspiration: `[e.g., Stripe — documentation elegance]`
- Anti-references (what to avoid): `[e.g., cluttered dashboards, aggressive color use]`

**Surface Treatment:**
- Background: `[flat / subtle gradient / textured]`
- Borders: `[sharp / soft radius / borderless]`
- Iconography style: `[outline / filled / duotone]`
- Illustration style: `[geometric / organic / isometric / none]`
- Photography treatment: `[duotone overlay / natural / desaturated]`

---

## 2. Color Palette & Roles

Define semantic color roles. Use HSL for easy manipulation.

### Primary Palette

| Role | Light Mode | Dark Mode | Usage |
|---|---|---|---|
| `--color-primary` | `hsl(220, 90%, 56%)` | `hsl(220, 90%, 64%)` | Primary actions, links, focus rings |
| `--color-primary-hover` | `hsl(220, 90%, 48%)` | `hsl(220, 90%, 72%)` | Hover state for primary elements |
| `--color-secondary` | `hsl(260, 60%, 55%)` | `hsl(260, 60%, 65%)` | Secondary actions, accents |

### Semantic Colors

| Role | Light Mode | Dark Mode | Usage |
|---|---|---|---|
| `--color-success` | `hsl(142, 72%, 40%)` | `hsl(142, 72%, 50%)` | Confirmations, completed states |
| `--color-warning` | `hsl(38, 95%, 50%)` | `hsl(38, 95%, 60%)` | Cautions, pending states |
| `--color-error` | `hsl(0, 84%, 50%)` | `hsl(0, 84%, 60%)` | Errors, destructive actions |
| `--color-info` | `hsl(200, 80%, 50%)` | `hsl(200, 80%, 60%)` | Informational callouts |

### Surface Colors

| Role | Light Mode | Dark Mode | Usage |
|---|---|---|---|
| `--color-bg` | `hsl(0, 0%, 100%)` | `hsl(220, 20%, 10%)` | Page background |
| `--color-surface` | `hsl(220, 20%, 98%)` | `hsl(220, 20%, 14%)` | Card/panel background |
| `--color-surface-raised` | `hsl(0, 0%, 100%)` | `hsl(220, 20%, 18%)` | Elevated surfaces (modals, popovers) |
| `--color-border` | `hsl(220, 15%, 88%)` | `hsl(220, 15%, 25%)` | Dividers, input borders |
| `--color-text` | `hsl(220, 20%, 12%)` | `hsl(220, 20%, 92%)` | Primary text |
| `--color-text-secondary` | `hsl(220, 10%, 45%)` | `hsl(220, 10%, 60%)` | Secondary/muted text |

---

## 3. Typography Rules

### Font Stack

| Role | Font Family | Fallback |
|---|---|---|
| Headings | `[Inter, Satoshi, or your choice]` | `system-ui, -apple-system, sans-serif` |
| Body | `[Inter, Satoshi, or your choice]` | `system-ui, -apple-system, sans-serif` |
| Monospace | `[JetBrains Mono, Fira Code]` | `ui-monospace, monospace` |

### Type Scale

Using `[Major Third (1.250)]` ratio. Base size: `16px`.

| Level | Size | Weight | Line Height | Letter Spacing | Usage |
|---|---|---|---|---|---|
| `display` | `3.052rem` (48.8px) | 700 | 1.1 | -0.02em | Hero headlines |
| `h1` | `2.441rem` (39.1px) | 700 | 1.2 | -0.015em | Page titles |
| `h2` | `1.953rem` (31.3px) | 600 | 1.25 | -0.01em | Section headers |
| `h3` | `1.563rem` (25.0px) | 600 | 1.3 | -0.005em | Subsection headers |
| `h4` | `1.25rem` (20.0px) | 600 | 1.35 | 0 | Card titles |
| `body` | `1rem` (16px) | 400 | 1.5 | 0 | Body text |
| `body-sm` | `0.875rem` (14px) | 400 | 1.5 | 0.005em | Secondary text |
| `caption` | `0.75rem` (12px) | 400 | 1.4 | 0.01em | Labels, captions |
| `overline` | `0.75rem` (12px) | 600 | 1.4 | 0.08em | Overlines (uppercase) |

### Paragraph Rules

- Maximum line length: `65-75 characters` (measure)
- Paragraph spacing: `1.5em`
- No orphans/widows in critical sections

---

## 4. Component Stylings

### Buttons

| Variant | Background | Text | Border | Radius | Padding |
|---|---|---|---|---|---|
| Primary | `--color-primary` | white | none | `8px` | `10px 20px` |
| Secondary | transparent | `--color-primary` | `1px solid --color-primary` | `8px` | `10px 20px` |
| Ghost | transparent | `--color-text` | none | `8px` | `10px 20px` |
| Destructive | `--color-error` | white | none | `8px` | `10px 20px` |

**States:** hover (+8% lightness), active (-4% lightness), disabled (40% opacity), focus (2px ring offset)

### Inputs

| Property | Value |
|---|---|
| Height | `40px` (default), `32px` (compact), `48px` (large) |
| Border | `1px solid --color-border` |
| Border (focus) | `2px solid --color-primary` |
| Radius | `8px` |
| Padding | `8px 12px` |
| Error state | border: `--color-error`, helper text below in error color |

### Cards

| Property | Value |
|---|---|
| Background | `--color-surface` |
| Border | `1px solid --color-border` |
| Radius | `12px` |
| Padding | `24px` |
| Shadow | `0 1px 3px rgba(0,0,0,0.08)` |
| Shadow (hover) | `0 4px 12px rgba(0,0,0,0.12)` |

---

## 5. Layout Principles

### Spacing Scale

Base unit: `4px`. Use multiples only.

| Token | Value | Usage |
|---|---|---|
| `--space-1` | `4px` | Tight internal padding |
| `--space-2` | `8px` | Icon gaps, compact spacing |
| `--space-3` | `12px` | Input padding, small gaps |
| `--space-4` | `16px` | Default element spacing |
| `--space-5` | `20px` | Card internal padding |
| `--space-6` | `24px` | Section padding |
| `--space-8` | `32px` | Large section gaps |
| `--space-10` | `40px` | Page-level spacing |
| `--space-12` | `48px` | Hero sections |
| `--space-16` | `64px` | Major section dividers |

### Grid

| Property | Value |
|---|---|
| Type | `[CSS Grid / Flexbox / 12-column]` |
| Max content width | `1280px` |
| Column count | `12` |
| Gutter | `24px` (desktop), `16px` (mobile) |
| Margin | `auto` (centered) |

### Content Regions

| Region | Max Width | Usage |
|---|---|---|
| Narrow | `640px` | Forms, article text, settings |
| Default | `960px` | Main content area |
| Wide | `1280px` | Dashboard, data tables |
| Full | `100%` | Landing pages, hero sections |

---

## 6. Depth & Elevation

### Shadow Scale

| Level | Value | Usage |
|---|---|---|
| `--shadow-xs` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift (buttons at rest) |
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.08)` | Cards, raised surfaces |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.12)` | Dropdowns, hover cards |
| `--shadow-lg` | `0 8px 24px rgba(0,0,0,0.16)` | Modals, dialogs |
| `--shadow-xl` | `0 16px 48px rgba(0,0,0,0.20)` | Popovers, command palettes |

### Z-Index Scale

| Layer | Value | Usage |
|---|---|---|
| `--z-base` | `0` | Normal flow |
| `--z-dropdown` | `100` | Dropdowns, select menus |
| `--z-sticky` | `200` | Sticky headers, sidebars |
| `--z-overlay` | `300` | Overlays, backdrops |
| `--z-modal` | `400` | Modals, dialogs |
| `--z-popover` | `500` | Popovers, tooltips |
| `--z-toast` | `600` | Toast notifications |
| `--z-max` | `999` | Command palette, emergency UI |

---

## 7. Design Guardrails

### Do

- Use the spacing scale exclusively (no arbitrary pixel values)
- Maintain 4.5:1 contrast for body text (WCAG AA)
- Use semantic color tokens, never raw hex/hsl in components
- Keep interactive targets at least 44x44px (touch) / 24x24px (pointer)
- Test all states: default, hover, active, focus, disabled, loading, error, empty

### Do Not

- Mix more than 2 font families
- Use pure black (`#000`) on pure white (`#fff`) for body text — too harsh
- Create custom one-off colors outside the palette
- Use box shadows for borders or vice versa
- Animate layout properties (width, height, top, left) — use transform/opacity
- Rely on color alone to convey meaning (use icons, labels, patterns)

---

## 8. Responsive Behavior

### Breakpoints

| Name | Min Width | Typical Device |
|---|---|---|
| `xs` | `0px` | Small phones |
| `sm` | `640px` | Large phones (landscape) |
| `md` | `768px` | Tablets |
| `lg` | `1024px` | Small desktops / landscape tablets |
| `xl` | `1280px` | Desktops |
| `2xl` | `1536px` | Large desktops |

### Responsive Rules

- **Mobile-first**: base styles target mobile, layer up with min-width
- **Typography**: scale down heading sizes by 1 step below `md` breakpoint
- **Navigation**: collapse to hamburger/bottom nav below `md`
- **Grid**: single column below `sm`, 2-col at `md`, full grid at `lg`+
- **Spacing**: reduce section spacing by ~25% below `md`
- **Touch targets**: minimum 48x48px on touch devices
- **Images**: responsive via `srcset` + `sizes`, never fixed pixel widths

---

## 9. Agent Prompt Guide

Instructions for AI agents consuming this design system.

### When generating UI code:

1. **Always reference this DESIGN.md first** — do not invent colors, spacing, or typography
2. **Use CSS custom properties** — reference `--color-*`, `--space-*`, `--shadow-*` tokens
3. **Follow the component specs** — match exact padding, radius, and state definitions
4. **Check responsive behavior** — ensure layout adapts at defined breakpoints
5. **Validate accessibility** — run contrast checks, add Maxim labels, ensure focus management
6. **Match the visual atmosphere** — generated UI should feel consistent with the mood keywords

### When reviewing designs:

1. Check all interactive elements have defined states (hover, focus, disabled, loading, error)
2. Verify color usage follows semantic roles (no raw hex in components)
3. Confirm spacing uses scale tokens only
4. Validate typography matches the defined type scale
5. Test at all breakpoints — nothing should break between defined breakpoints
6. Run accessibility checklist from `references/accessibility.md`

### When extending the system:

1. New colors must fit the HSL family of existing palette
2. New components must define all 5 states minimum
3. New spacing values must be multiples of the base unit (4px)
4. Document any exceptions with rationale in this file
