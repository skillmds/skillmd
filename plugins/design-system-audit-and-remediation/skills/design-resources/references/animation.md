# Animation & Motion Reference

> Easing curves, duration values, micro-interaction patterns, and reduced motion accessibility.

---

## Motion Principles

### The Three Rules

1. **Purposeful** — every animation must serve a function (feedback, orientation, continuity). Never animate for decoration alone.
2. **Fast** — UI animations should feel instant. If the user notices the animation duration, it is too slow.
3. **Natural** — use easing curves that mimic physical motion. Linear animations feel robotic.

---

## Easing Curves

### Standard Curves

| Name | CSS Value | Use When |
|---|---|---|
| **Ease Out** | `cubic-bezier(0.0, 0.0, 0.2, 1.0)` | Elements entering the screen (fade in, slide in, scale up) |
| **Ease In** | `cubic-bezier(0.4, 0.0, 1.0, 1.0)` | Elements leaving the screen (fade out, slide out, scale down) |
| **Ease In-Out** | `cubic-bezier(0.4, 0.0, 0.2, 1.0)` | Elements moving on-screen (repositioning, resizing) |
| **Linear** | `linear` | Opacity-only transitions, progress bars, loading spinners |
| **Spring** | `cubic-bezier(0.34, 1.56, 0.64, 1.0)` | Playful/bouncy interactions (toggle, pop-in, badge) |

### CSS Custom Properties

```css
:root {
  --ease-out: cubic-bezier(0.0, 0.0, 0.2, 1.0);
  --ease-in: cubic-bezier(0.4, 0.0, 1.0, 1.0);
  --ease-in-out: cubic-bezier(0.4, 0.0, 0.2, 1.0);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1.0);
}
```

---

## Duration Scale

### By Interaction Type

| Category | Duration | Examples |
|---|---|---|
| **Micro** | 50-100ms | Button color change, checkbox toggle, icon swap |
| **Fast** | 100-200ms | Hover effects, tooltip show, dropdown open |
| **Normal** | 200-300ms | Modal open/close, sidebar expand, card flip |
| **Slow** | 300-500ms | Page transitions, complex layout shifts, accordion |
| **Emphasis** | 500-800ms | Celebration animations, onboarding reveals |

### Rules

- **Hover states:** 150ms maximum (users expect instant feedback)
- **Modals/dialogs:** 200ms open, 150ms close (closing should feel faster)
- **Navigation transitions:** 200-300ms (orientation aid)
- **Never exceed 1000ms** for any standard UI animation
- **Loading spinners:** infinite duration, 1000-2000ms per rotation

### Duration CSS Properties

```css
:root {
  --duration-micro: 75ms;
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
  --duration-emphasis: 600ms;
}
```

---

## Micro-Interaction Patterns

### Button Press

```css
.button {
  transition: transform var(--duration-micro) var(--ease-out),
              background-color var(--duration-fast) var(--ease-out);
}
.button:hover {
  background-color: var(--color-primary-hover);
}
.button:active {
  transform: scale(0.97);
}
```

### Checkbox Toggle

```css
.checkbox-indicator {
  transition: transform var(--duration-micro) var(--ease-spring),
              opacity var(--duration-micro) var(--ease-out);
}
.checkbox[data-state="checked"] .checkbox-indicator {
  transform: scale(1);
  opacity: 1;
}
.checkbox[data-state="unchecked"] .checkbox-indicator {
  transform: scale(0);
  opacity: 0;
}
```

### Toggle Switch

```css
.toggle-thumb {
  transition: transform var(--duration-fast) var(--ease-spring);
}
.toggle[data-state="checked"] .toggle-thumb {
  transform: translateX(20px);
}
```

### Dropdown / Select Open

```css
.dropdown-content {
  transform-origin: top center;
  transition: opacity var(--duration-fast) var(--ease-out),
              transform var(--duration-fast) var(--ease-out);
}
.dropdown-content[data-state="open"] {
  opacity: 1;
  transform: scaleY(1) translateY(0);
}
.dropdown-content[data-state="closed"] {
  opacity: 0;
  transform: scaleY(0.95) translateY(-4px);
}
```

### Tooltip Show

```css
.tooltip {
  transition: opacity var(--duration-fast) var(--ease-out),
              transform var(--duration-fast) var(--ease-out);
}
.tooltip[data-state="visible"] {
  opacity: 1;
  transform: translateY(0);
}
.tooltip[data-state="hidden"] {
  opacity: 0;
  transform: translateY(4px);
}
```

### Focus Ring

```css
.focusable:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  transition: outline-offset var(--duration-micro) var(--ease-out);
}
```

### Ripple Effect (Material-style)

```css
.ripple {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  transform: scale(0);
  animation: ripple-expand 600ms var(--ease-out) forwards;
}
@keyframes ripple-expand {
  to { transform: scale(4); opacity: 0; }
}
```

---

## Page Transition Patterns

### Fade

```css
.page-enter { opacity: 0; }
.page-enter-active {
  opacity: 1;
  transition: opacity var(--duration-normal) var(--ease-out);
}
.page-exit { opacity: 1; }
.page-exit-active {
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-in);
}
```

### Slide

```css
.page-enter {
  transform: translateX(20px);
  opacity: 0;
}
.page-enter-active {
  transform: translateX(0);
  opacity: 1;
  transition: all var(--duration-normal) var(--ease-out);
}
.page-exit {
  transform: translateX(0);
  opacity: 1;
}
.page-exit-active {
  transform: translateX(-20px);
  opacity: 0;
  transition: all var(--duration-fast) var(--ease-in);
}
```

### Shared Layout / Morph

For elements that persist across pages (e.g., a card expanding to a detail view):

1. Capture start position and dimensions
2. Capture end position and dimensions
3. Apply FLIP technique: First, Last, Invert, Play
4. Animate with `transform` only (no layout recalculation)
5. Duration: 250-350ms with ease-in-out

---

## Loading State Animations

### Spinner

```css
@keyframes spin {
  to { transform: rotate(360deg); }
}
.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 800ms linear infinite;
}
```

### Skeleton Screen

```css
@keyframes skeleton-pulse {
  0% { opacity: 1; }
  50% { opacity: 0.4; }
  100% { opacity: 1; }
}
.skeleton {
  background: var(--color-border);
  border-radius: 4px;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}
```

### Shimmer Effect

```css
@keyframes skeleton-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    var(--color-surface) 25%,
    var(--color-border) 50%,
    var(--color-surface) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}
```

### Progress Bar

```css
.progress-bar {
  height: 4px;
  background: var(--color-border);
  border-radius: 2px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: var(--color-primary);
  transition: width var(--duration-normal) var(--ease-out);
}
/* Indeterminate */
@keyframes indeterminate {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(300%); }
}
.progress-indeterminate {
  width: 33%;
  animation: indeterminate 1.5s var(--ease-in-out) infinite;
}
```

### Dot Loader

```css
@keyframes dot-bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}
.dot-loader span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-primary);
  display: inline-block;
  animation: dot-bounce 1.4s ease-in-out infinite;
}
.dot-loader span:nth-child(1) { animation-delay: 0s; }
.dot-loader span:nth-child(2) { animation-delay: 0.16s; }
.dot-loader span:nth-child(3) { animation-delay: 0.32s; }
```

---

## Stagger Patterns

For lists and grids entering the viewport:

```css
.list-item {
  opacity: 0;
  transform: translateY(8px);
  animation: fade-in-up var(--duration-normal) var(--ease-out) forwards;
}
@keyframes fade-in-up {
  to { opacity: 1; transform: translateY(0); }
}

/* Stagger each item by 50ms */
.list-item:nth-child(1) { animation-delay: 0ms; }
.list-item:nth-child(2) { animation-delay: 50ms; }
.list-item:nth-child(3) { animation-delay: 100ms; }
.list-item:nth-child(4) { animation-delay: 150ms; }
/* ... or use CSS custom property */
.list-item { animation-delay: calc(var(--index) * 50ms); }
```

### Rules

- Max stagger delay: 500ms total (even for long lists)
- Stagger increment: 30-80ms per item
- Max staggered items: 8-10 (batch the rest)
- Always use `opacity` + `transform` (GPU-composited, no layout thrashing)

---

## Reduced Motion Accessibility

### The Standard

Users can set `prefers-reduced-motion: reduce` in their OS. This MUST be respected.

### Implementation

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### What to Preserve vs. Remove

| Keep (reduced) | Remove |
|---|---|
| Opacity transitions (instant) | Sliding/moving animations |
| Color changes (instant) | Parallax effects |
| State changes (instant) | Auto-playing carousels |
| Focus indicators | Bouncing/pulsing effects |
| Loading spinners (simplified) | Complex page transitions |
| Progress bars (no animation) | Stagger animations |

### Alternative for Reduced Motion

```css
.card {
  transition: transform 200ms var(--ease-out), opacity 200ms var(--ease-out);
}
@media (prefers-reduced-motion: reduce) {
  .card {
    transition: opacity 0.01ms;
    /* Keep the state change, remove the motion */
  }
}
```

---

## Performance Rules

### Animate Only Composite Properties

| Property | Composited? | Use? |
|---|---|---|
| `transform` | YES | ALWAYS prefer |
| `opacity` | YES | ALWAYS prefer |
| `filter` | YES | Acceptable |
| `width` / `height` | NO | NEVER animate |
| `top` / `left` / `right` / `bottom` | NO | NEVER animate |
| `margin` / `padding` | NO | NEVER animate |
| `border-width` | NO | NEVER animate |
| `font-size` | NO | NEVER animate |
| `box-shadow` | NO | Avoid (use pseudo-element with opacity instead) |

### Shadow Animation Trick

Instead of animating `box-shadow` (triggers repaint):

```css
.card {
  position: relative;
}
.card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: 0 8px 24px rgba(0,0,0,0.2);
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
}
.card:hover::after {
  opacity: 1;
}
```

### will-change Usage

```css
/* Only add when animation is imminent */
.element-about-to-animate {
  will-change: transform, opacity;
}
/* Remove after animation completes */
```

Never use `will-change: transform` on more than 10 elements simultaneously — creates excessive GPU memory allocation.
