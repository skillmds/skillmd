# Typography Reference

> Practical type values, scales, and patterns for design agents.

---

## Font Pairing Guidelines

### Proven Pairings by Category

**Sans + Sans (modern, clean):**
- Inter (headings) + Inter (body) — single-family, weight differentiation
- Satoshi (headings) + Inter (body) — geometric + humanist balance
- Manrope (headings) + Source Sans 3 (body) — geometric + neutral
- Plus Jakarta Sans (headings) + DM Sans (body) — soft geometric pair

**Serif + Sans (editorial, premium):**
- Playfair Display (headings) + Source Sans 3 (body) — high contrast editorial
- Fraunces (headings) + Inter (body) — soft serif + clean sans
- Lora (headings) + Open Sans (body) — classic readability pair
- Literata (headings) + Nunito Sans (body) — book-quality digital

**Monospace + Sans (developer tools, technical):**
- JetBrains Mono (code) + Inter (UI) — industry standard for dev tools
- Fira Code (code) + Fira Sans (UI) — same family, ligature support
- IBM Plex Mono (code) + IBM Plex Sans (UI) — corporate consistency

### Pairing Rules

1. **Contrast principle** — pair fonts with different structures (geometric + humanist, serif + sans)
2. **Shared x-height** — paired fonts should have similar x-heights for visual harmony
3. **Weight range** — ensure both fonts offer at least 400, 500, 600, 700 weights
4. **Maximum 2 families** — use weight/style variations within families for hierarchy
5. **One display font maximum** — decorative/display fonts only for hero or display text

---

## Type Scale Systems

### Scale Ratios

| Name | Ratio | Character | Best For |
|---|---|---|---|
| Minor Second | 1.067 | Very tight | Dense data UIs, tables |
| Major Second | 1.125 | Tight | Admin panels, dashboards |
| Minor Third | 1.200 | Moderate | General-purpose apps |
| **Major Third** | **1.250** | **Balanced** | **Recommended default** |
| Perfect Fourth | 1.333 | Generous | Marketing sites, editorial |
| Augmented Fourth | 1.414 | Dramatic | Landing pages, portfolios |
| Perfect Fifth | 1.500 | Very dramatic | Posters, hero-heavy layouts |
| Golden Ratio | 1.618 | Maximum drama | Art-directed single pages |

### Computing a Scale

Formula: `size = base * ratio^step`

**Major Third (1.250) from 16px base:**

| Step | Calculation | Result | Rem |
|---|---|---|---|
| -2 | 16 / 1.250^2 | 10.24px | 0.64rem |
| -1 | 16 / 1.250 | 12.80px | 0.80rem |
| 0 (base) | 16 | 16.00px | 1.00rem |
| +1 | 16 * 1.250 | 20.00px | 1.25rem |
| +2 | 16 * 1.250^2 | 25.00px | 1.563rem |
| +3 | 16 * 1.250^3 | 31.25px | 1.953rem |
| +4 | 16 * 1.250^4 | 39.06px | 2.441rem |
| +5 | 16 * 1.250^5 | 48.83px | 3.052rem |
| +6 | 16 * 1.250^6 | 61.04px | 3.815rem |

### CSS Custom Property Pattern

```css
:root {
  --font-size-xs: 0.64rem;    /* 10.24px */
  --font-size-sm: 0.80rem;    /* 12.80px */
  --font-size-base: 1rem;     /* 16.00px */
  --font-size-md: 1.25rem;    /* 20.00px */
  --font-size-lg: 1.563rem;   /* 25.00px */
  --font-size-xl: 1.953rem;   /* 31.25px */
  --font-size-2xl: 2.441rem;  /* 39.06px */
  --font-size-3xl: 3.052rem;  /* 48.83px */
  --font-size-4xl: 3.815rem;  /* 61.04px */
}
```

---

## Line Height Rules

### By Content Type

| Content Type | Line Height | Rationale |
|---|---|---|
| Display / Hero text (>32px) | 1.1 - 1.2 | Large text needs tight leading |
| Headings (20-32px) | 1.2 - 1.3 | Moderate leading for scan-ability |
| Body text (14-18px) | 1.5 - 1.6 | Optimal readability range |
| Small text / captions (<14px) | 1.4 - 1.5 | Slightly tighter for compact UI |
| Code / monospace | 1.5 - 1.7 | Generous for scan-ability |
| UI labels / buttons | 1.0 - 1.2 | Tight — single line, centered |

### Rule of Thumb

- As font size increases, line height ratio decreases
- `line-height = 1.5` is the universal safe default for body text
- Never use unitless values below 1.0 (causes clipping)

---

## Letter Spacing Rules

| Size Range | Letter Spacing | Reason |
|---|---|---|
| Display (>40px) | -0.02em to -0.03em | Large text looks loose without negative tracking |
| Headings (24-40px) | -0.01em to -0.02em | Moderate tightening |
| Body (14-18px) | 0 to 0.005em | Default tracking, minimal adjustment |
| Small text (<14px) | 0.005em to 0.01em | Small text needs slight opening |
| All-caps / overlines | 0.05em to 0.1em | Uppercase always needs wide tracking |
| Monospace | 0 | Never adjust monospace tracking |

---

## Spacing Between Typography Elements

### Vertical Rhythm

| Relationship | Spacing |
|---|---|
| Heading → body text | `0.5em` of the heading size |
| Body paragraph → paragraph | `1em` of body size (1 line) |
| Section heading → next section heading | `2em` minimum |
| List item → list item | `0.25em` to `0.5em` |
| Caption → related element | `0.25em` to `0.5em` |
| Heading → subheading | `0.25em` |

---

## Responsive Typography Patterns

### Fluid Typography (CSS clamp)

```css
/* Fluid heading: 24px at 320px viewport → 48px at 1280px viewport */
h1 {
  font-size: clamp(1.5rem, 1rem + 2.5vw, 3rem);
}

/* Fluid body: 14px at 320px → 18px at 1280px */
body {
  font-size: clamp(0.875rem, 0.8rem + 0.4vw, 1.125rem);
}
```

### Step-Down Pattern

| Breakpoint | Base Size | Scale Adjustment |
|---|---|---|
| `xl` (1280px+) | 16px | Full scale |
| `lg` (1024px) | 16px | Full scale |
| `md` (768px) | 16px | Headings -1 step |
| `sm` (640px) | 15px | Headings -1 step |
| `xs` (<640px) | 15px | Headings -2 steps, no display size |

### Rules

1. Body text stays 14-18px across all breakpoints (never smaller than 14px on mobile)
2. Headings scale down but maintain hierarchy
3. Display text may be eliminated entirely on small screens
4. Line length must stay 45-75 characters — adjust container, not font size

---

## Web Font Loading Best Practices

### Loading Strategy Priority

1. **System fonts first** — fastest, zero layout shift
2. **`font-display: swap`** — show fallback immediately, swap when loaded
3. **`font-display: optional`** — use web font only if cached, no layout shift
4. **Preload critical fonts** — `<link rel="preload" as="font" crossorigin>`

### Subsetting

- Latin subset covers most Western languages: `unicode-range: U+0000-00FF`
- Subset to 20-40KB per weight file (vs 100KB+ full character set)
- WOFF2 format only (30% smaller than WOFF, 75% smaller than TTF)

### Performance Budget

| Metric | Target |
|---|---|
| Total web font payload | < 100KB |
| Font files loaded | <= 4 files (2 families x 2 weights) |
| Layout shift from fonts | CLS < 0.05 |
| Font load time | < 1 second on 3G |

### Font Loading CSS Pattern

```css
/* Preload in HTML head */
/* <link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin> */

@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-var.woff2') format('woff2');
  font-weight: 100 900;
  font-display: swap;
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6,
                 U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F;
}
```

### Variable Fonts

Prefer variable fonts when available — one file replaces multiple weight files:

| Font | Variable File Size | Equivalent Static Files |
|---|---|---|
| Inter Variable | ~100KB | 9 weights x ~25KB = 225KB |
| Fira Code Variable | ~130KB | 5 weights x ~45KB = 225KB |
| Source Sans 3 Variable | ~80KB | 6 weights x ~22KB = 132KB |

---

## Measure (Line Length) Reference

| Characters per line | Quality | Use Case |
|---|---|---|
| 20-40 | Narrow | Sidebars, captions, mobile cards |
| 45-55 | Comfortable | Mobile body text |
| **55-65** | **Optimal** | **Desktop body text** |
| 65-75 | Acceptable | Wide content areas |
| 75-90 | Fatiguing | Avoid for sustained reading |
| 90+ | Unreadable | Never — forces eye-tracking errors |

To enforce: set `max-width` on text containers, not font size. At 16px body size, `max-width: 65ch` produces ~65 characters per line.
