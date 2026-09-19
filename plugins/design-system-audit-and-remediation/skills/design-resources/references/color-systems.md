# Color Systems Reference

> Semantic naming, HSL generation, dark mode transforms, contrast ratios, and color psychology.

---

## Semantic Color Naming Standard

### Core Roles

| Token | Purpose | Example |
|---|---|---|
| `primary` | Brand color, primary actions, links | CTA buttons, active tabs |
| `primary-hover` | Primary interactive hover state | Button hover |
| `primary-foreground` | Text on primary background | Button label text |
| `secondary` | Supporting brand color, secondary actions | Outline buttons, badges |
| `accent` | Highlight, emphasis, decorative | Feature callouts, new badges |
| `muted` | Subdued backgrounds and text | Disabled states, placeholder text |
| `destructive` | Destructive/dangerous actions | Delete buttons, error states |

### Semantic Status Colors

| Token | Hue Range | Purpose | Common Values (HSL) |
|---|---|---|---|
| `success` | 120-150 (green) | Confirmations, completed, positive | `hsl(142, 72%, 40%)` |
| `warning` | 30-50 (amber/yellow) | Cautions, pending, attention needed | `hsl(38, 95%, 50%)` |
| `error` | 0-10 (red) | Errors, failures, destructive | `hsl(0, 84%, 50%)` |
| `info` | 195-220 (blue) | Informational, neutral notices | `hsl(200, 80%, 50%)` |

### Surface Colors

| Token | Purpose |
|---|---|
| `background` | Page-level background |
| `surface` | Card/panel backgrounds (1 level above background) |
| `surface-raised` | Elevated surfaces — modals, popovers, dropdowns |
| `surface-overlay` | Backdrop behind modals (semi-transparent) |
| `border` | Default border/divider color |
| `border-strong` | Emphasized borders (input focus, active states) |
| `ring` | Focus ring color (usually primary with opacity) |

### Text Colors

| Token | Purpose | Typical Contrast |
|---|---|---|
| `foreground` | Primary text | 7:1+ (AAA) |
| `foreground-secondary` | Secondary/muted text | 4.5:1+ (AA) |
| `foreground-tertiary` | Placeholder, disabled text | 3:1+ (AA large) |
| `foreground-inverse` | Text on dark/colored backgrounds | 4.5:1+ (AA) |

---

## HSL-Based Color Generation

### Why HSL

- **Hue** (0-360): color wheel position — easy to create harmonies
- **Saturation** (0-100%): intensity — easy to create muted variants
- **Lightness** (0-100%): brightness — easy to create shades/tints

### Generating a Palette from One Hue

Given a primary hue (e.g., 220 = blue):

| Variant | Formula | Example |
|---|---|---|
| Lightest (bg tint) | `hsl(H, S*0.3, 97%)` | `hsl(220, 27%, 97%)` |
| Light | `hsl(H, S*0.6, 90%)` | `hsl(220, 54%, 90%)` |
| Default | `hsl(H, S, L)` | `hsl(220, 90%, 56%)` |
| Hover | `hsl(H, S, L-8%)` | `hsl(220, 90%, 48%)` |
| Active | `hsl(H, S, L-12%)` | `hsl(220, 90%, 44%)` |
| Dark | `hsl(H, S*0.8, 30%)` | `hsl(220, 72%, 30%)` |
| Darkest (text) | `hsl(H, S*0.5, 15%)` | `hsl(220, 45%, 15%)` |

### Color Harmonies

| Harmony | Hue Relationship | Character |
|---|---|---|
| Complementary | H + 180 | High contrast, energetic |
| Analogous | H +/- 30 | Harmonious, calm |
| Triadic | H + 120, H + 240 | Vibrant, balanced |
| Split-complementary | H + 150, H + 210 | Contrast with less tension |
| Tetradic | H + 90, H + 180, H + 270 | Rich, needs careful balance |

### Neutral Generation from Brand Hue

Inject a small amount of the brand hue into neutrals for cohesion:

```
neutral-50:  hsl(brand-hue, 10%, 98%)
neutral-100: hsl(brand-hue, 10%, 96%)
neutral-200: hsl(brand-hue, 8%,  90%)
neutral-300: hsl(brand-hue, 8%,  82%)
neutral-400: hsl(brand-hue, 6%,  64%)
neutral-500: hsl(brand-hue, 5%,  46%)
neutral-600: hsl(brand-hue, 6%,  32%)
neutral-700: hsl(brand-hue, 8%,  23%)
neutral-800: hsl(brand-hue, 10%, 15%)
neutral-900: hsl(brand-hue, 12%, 10%)
neutral-950: hsl(brand-hue, 14%, 6%)
```

---

## Dark Mode Color Transformation Rules

### General Principles

1. **Do not invert** — dark mode is not `filter: invert()`. Redesign the palette.
2. **Reduce saturation** — saturated colors on dark backgrounds cause eye strain. Reduce S by 10-20%.
3. **Increase lightness** — primary colors need +8-12% lightness to maintain perceived contrast.
4. **Flip the surface stack** — darkest color becomes background, lighter shades for elevated surfaces.
5. **Preserve semantic meaning** — success stays green, error stays red. Only adjust L and S.

### Transformation Table

| Token | Light Mode | Dark Mode Transform |
|---|---|---|
| `background` | `hsl(H, 10%, 100%)` | `hsl(H, 20%, 8-12%)` |
| `surface` | `hsl(H, 10%, 98%)` | `hsl(H, 15%, 14-18%)` |
| `surface-raised` | `hsl(H, 5%, 100%)` | `hsl(H, 15%, 18-22%)` |
| `border` | `hsl(H, 10%, 88%)` | `hsl(H, 10%, 20-25%)` |
| `foreground` | `hsl(H, 15%, 10%)` | `hsl(H, 10%, 90-95%)` |
| `foreground-secondary` | `hsl(H, 8%, 45%)` | `hsl(H, 8%, 55-65%)` |
| `primary` | `hsl(H, S, 50-56%)` | `hsl(H, S-10%, 60-68%)` |
| `success` | `hsl(142, 72%, 40%)` | `hsl(142, 60%, 50%)` |
| `warning` | `hsl(38, 95%, 50%)` | `hsl(38, 85%, 60%)` |
| `error` | `hsl(0, 84%, 50%)` | `hsl(0, 74%, 60%)` |

### Dark Mode Surface Elevation

Each elevation level gets slightly lighter (opposite of light mode):

| Level | Light Mode Lightness | Dark Mode Lightness |
|---|---|---|
| Background (base) | 100% | 8-10% |
| Surface (level 1) | 98% | 12-14% |
| Raised (level 2) | 100% + shadow | 16-18% |
| Overlay (level 3) | white + shadow | 20-22% |
| Popover (level 4) | white + heavy shadow | 24-26% |

### CSS Implementation Pattern

```css
:root {
  --color-bg: hsl(220, 20%, 100%);
  --color-surface: hsl(220, 20%, 98%);
  --color-text: hsl(220, 20%, 12%);
  --color-primary: hsl(220, 90%, 56%);
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: hsl(220, 20%, 10%);
    --color-surface: hsl(220, 18%, 14%);
    --color-text: hsl(220, 15%, 92%);
    --color-primary: hsl(220, 80%, 64%);
  }
}
```

---

## Accessibility Contrast Ratios (WCAG)

### Requirements

| Level | Normal Text (<18.66px bold, <24px regular) | Large Text (>=18.66px bold, >=24px regular) | Non-Text (icons, borders, focus) |
|---|---|---|---|
| **AA** (minimum) | 4.5 : 1 | 3 : 1 | 3 : 1 |
| **AAA** (enhanced) | 7 : 1 | 4.5 : 1 | N/A |

### Common Failing Combinations

| Foreground | Background | Ratio | Passes AA? |
|---|---|---|---|
| `hsl(0,0%,60%)` gray | white | 2.8:1 | NO |
| `hsl(0,0%,46%)` gray | white | 4.6:1 | YES (barely) |
| `hsl(0,0%,40%)` gray | white | 5.7:1 | YES |
| `hsl(220,90%,56%)` blue | white | 3.9:1 | NO (for small text) |
| `hsl(220,90%,45%)` blue | white | 5.5:1 | YES |
| Yellow on white | any yellow | < 2:1 | NEVER |
| Light green on white | `hsl(120,50%,60%)` | ~2.5:1 | NO |

### Safe Minimum Lightness Values (on white background)

For text to pass AA (4.5:1) on white:

| Saturation | Maximum Lightness |
|---|---|
| 0% (gray) | 46% |
| 50% | 42-46% (varies by hue) |
| 80% | 38-44% (varies by hue) |
| 100% | 35-42% (varies by hue) |

**Hue sensitivity:** Yellows and greens need significantly lower lightness than blues and purples to meet contrast requirements on white.

### Contrast Checking Formula (relative luminance)

```
L = 0.2126 * R_linear + 0.7152 * G_linear + 0.0722 * B_linear

contrast_ratio = (L_lighter + 0.05) / (L_darker + 0.05)
```

Use tools: WebAIM Contrast Checker, Chrome DevTools color picker, Figma A11y plugins.

---

## Color Psychology by Industry

### Industry Color Associations

| Industry | Primary Hue Range | Psychology | Examples |
|---|---|---|---|
| **Finance/Banking** | 210-230 (blue) | Trust, stability, security | Chase, PayPal, Stripe |
| **Healthcare** | 170-200 (teal/cyan) | Calm, clean, professional | Oscar, Zocdoc |
| **Technology** | 220-260 (blue-purple) | Innovation, intelligence | Figma, Discord, Twitch |
| **E-commerce** | 15-35 (orange) or 0-10 (red) | Urgency, energy, action | Amazon, Shopify |
| **SaaS/Productivity** | 250-270 (purple) | Premium, creative, modern | Notion, Linear, Asana |
| **Education** | 120-160 (green) | Growth, knowledge, freshness | Duolingo, Khan Academy |
| **Food/Beverage** | 0-30 (red-orange) | Appetite, warmth, energy | DoorDash, Grubhub |
| **Sustainability** | 90-150 (green) | Nature, eco, responsibility | Ecosia, Patagonia |
| **Entertainment** | 0-360 (any bold hue) | Energy, excitement, fun | Netflix (red), Spotify (green) |
| **Luxury** | 0, 0%, 0-20% (black/gold) | Exclusivity, sophistication | Chanel, Rolex |

### Emotional Color Mapping

| Emotion/Trait | Hue | Saturation | Lightness |
|---|---|---|---|
| Trust | 200-230 | Medium (50-70%) | Medium (45-55%) |
| Energy | 0-30 | High (80-100%) | Medium (50-60%) |
| Calm | 170-200 | Low-Medium (30-50%) | Medium-High (55-70%) |
| Premium | 250-280 | Medium (40-60%) | Medium-Low (35-50%) |
| Playful | 300-340 | High (70-90%) | Medium-High (55-65%) |
| Professional | 210-230 | Low-Medium (20-50%) | Medium-Low (35-50%) |
| Eco/Natural | 90-150 | Medium (40-70%) | Medium (45-55%) |
| Urgency | 0-15 | High (80-100%) | Medium (45-55%) |

---

## Color Token Architecture (Design System Integration)

### Three-Tier Token Model

```
PRIMITIVE TOKENS (raw values)
  blue-500: hsl(220, 90%, 56%)
  gray-100: hsl(220, 10%, 96%)
       │
       ▼
SEMANTIC TOKENS (purpose-mapped)
  color-primary: {blue-500}
  color-surface: {gray-100}
       │
       ▼
COMPONENT TOKENS (component-specific)
  button-primary-bg: {color-primary}
  card-bg: {color-surface}
```

### Rules

1. Components reference only semantic or component tokens — never primitives
2. Dark mode swaps happen at the semantic layer only
3. Primitive tokens are the same in light and dark modes
4. New components should reuse existing semantic tokens before creating new ones
