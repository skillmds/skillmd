# Component Patterns Reference

> Atomic Design hierarchy, component states, form patterns, navigation, and data display.

---

## Atomic Design Hierarchy

### Level Definitions

| Level | Name | Description | Examples |
|---|---|---|---|
| 1 | **Atoms** | Smallest indivisible UI elements | Button, Input, Label, Icon, Badge, Avatar, Checkbox |
| 2 | **Molecules** | Simple groups of atoms functioning as a unit | Search bar (input + button), Form field (label + input + helper), Menu item (icon + text) |
| 3 | **Organisms** | Complex components composed of molecules/atoms | Navigation bar, Hero section, Card with actions, Data table, Form section |
| 4 | **Templates** | Page-level layout structures (no real content) | Dashboard layout, Settings page layout, Article page layout |
| 5 | **Pages** | Templates filled with real content | Actual dashboard, actual settings page |

### Rules

1. Atoms have no dependencies on other components
2. Molecules combine 2-5 atoms maximum
3. Organisms can contain molecules, atoms, and other organisms
4. Templates define content placement, not content itself
5. Each level should be independently testable

---

## Universal Component States

Every interactive component must define these states:

### Required States

| State | Visual Treatment | Trigger |
|---|---|---|
| **Default** | Base appearance | No interaction |
| **Hover** | Subtle background/color shift, cursor pointer | Mouse enters element |
| **Active / Pressed** | Darkened, slight scale-down (0.98) | Mouse down / touch start |
| **Focus** | Visible focus ring (2px offset, primary color) | Keyboard tab navigation |
| **Disabled** | 40-50% opacity, cursor not-allowed | `disabled` attribute |
| **Loading** | Spinner or skeleton, pointer-events none | Async operation in progress |
| **Error** | Error border color, error message below | Validation failure |

### Conditional States

| State | When Applicable | Visual Treatment |
|---|---|---|
| **Selected / Active** | Tabs, toggles, radio, checkbox | Filled/highlighted variant |
| **Empty** | Lists, tables, search results | Empty state illustration + CTA |
| **Read-only** | Inputs, forms | Borderless, no hover, looks like text |
| **Dragging** | Drag-and-drop contexts | Elevated shadow, slight rotation |
| **Skeleton** | Initial page load | Animated gray blocks matching layout |

### State Transition Timing

| Transition | Duration | Easing |
|---|---|---|
| Default → Hover | 150ms | ease-out |
| Hover → Active | 50ms | ease-in |
| Active → Default | 200ms | ease-out |
| Default → Focus | 0ms (instant) | none |
| Any → Disabled | 150ms | ease-out |
| Default → Loading | 200ms | ease-out |

---

## Form Patterns

### Text Input

```
┌─ Label ─────────────────────────┐
│ ┌─────────────────────────────┐ │
│ │ Placeholder text            │ │
│ └─────────────────────────────┘ │
│ Helper text or error message    │
└─────────────────────────────────┘
```

| Property | Specification |
|---|---|
| Label position | Above input (never floating inside for accessibility) |
| Label | Required. Always visible. `for` attribute linked to input `id` |
| Placeholder | Optional hint, never a replacement for label |
| Helper text | Below input, `--color-text-secondary` |
| Error text | Below input, replaces helper, `--color-error`, icon prefix |
| Required indicator | Asterisk (*) after label text |
| Character count | Right-aligned below input for textareas with max length |

### Select / Dropdown

| Property | Specification |
|---|---|
| Trigger | Same height/style as text input |
| Indicator | Chevron-down icon, right-aligned |
| Dropdown | Opens below trigger, same width minimum |
| Max visible items | 6-8 items before scroll |
| Search | Include search input for lists > 10 items |
| Multi-select | Use checkboxes inside dropdown, pill tags in trigger |
| Empty state | "No options found" with optional create action |

### Checkbox

| Property | Specification |
|---|---|
| Size | 16x16px (minimum), 20x20px (comfortable) |
| Touch target | 44x44px minimum (padded around visual element) |
| Label | Right of checkbox, clickable |
| States | Unchecked, checked (filled + checkmark), indeterminate (dash) |
| Group | Vertical stack, 8-12px spacing between items |
| Indeterminate | For "select all" when partially selected |

### Radio Button

| Property | Specification |
|---|---|
| Size | 16x16px circle (minimum) |
| Touch target | 44x44px minimum |
| Label | Right of radio, clickable |
| States | Unselected (empty circle), selected (filled inner circle) |
| Group | Vertical stack preferred, horizontal only for 2-3 options |
| Required | At least one must be pre-selected, or add explicit "None" option |

### Toggle / Switch

| Property | Specification |
|---|---|
| Track size | 36x20px (compact), 44x24px (comfortable) |
| Thumb size | 16px circle (compact), 20px circle (comfortable) |
| Label | Left of toggle (describes what is being toggled) |
| States | Off (gray track), on (primary-colored track) |
| Use when | Immediate effect (no submit button needed) |
| Do not use | When a form requires explicit submission |

### Textarea

| Property | Specification |
|---|---|
| Min height | 80px (3 rows minimum) |
| Resize | `vertical` only (never horizontal) |
| Auto-grow | Expand with content up to max-height, then scroll |
| Max height | 300-400px before scrolling |
| Character count | Required when max length exists |

---

## Navigation Patterns

### Sidebar Navigation

```
┌──────────┬─────────────────────────┐
│ Logo     │                         │
│──────────│                         │
│ Nav 1  ● │      Main Content       │
│ Nav 2    │                         │
│ Nav 3    │                         │
│ ──────── │                         │
│ Section  │                         │
│ Nav 4    │                         │
│ Nav 5    │                         │
│          │                         │
│──────────│                         │
│ User ▼   │                         │
└──────────┴─────────────────────────┘
```

| Property | Specification |
|---|---|
| Width | 240-280px (expanded), 64px (collapsed icon-only) |
| Position | Fixed left, full viewport height |
| Active indicator | Background highlight + left border accent OR filled icon |
| Sections | Group related items with subtle divider or section label |
| Collapse | Hamburger toggle or auto-collapse below `lg` breakpoint |
| Footer | User profile/avatar + settings/logout at bottom |

### Top Bar Navigation

```
┌─────────────────────────────────────┐
│ Logo   Nav1  Nav2  Nav3    [Search] │
└─────────────────────────────────────┘
```

| Property | Specification |
|---|---|
| Height | 56-64px |
| Position | Sticky top (`position: sticky; top: 0`) |
| Items | 5-7 maximum in top bar, overflow to "More" dropdown |
| Active | Underline accent (3px bottom border, primary color) |
| Mobile | Collapse to hamburger menu below `md` breakpoint |

### Breadcrumbs

```
Home > Products > Category > Current Page
```

| Property | Specification |
|---|---|
| Separator | `>` or `/` or chevron icon |
| Current page | Not a link, bold or regular weight |
| Truncation | Show first, last 2, ellipsis for deep nesting: `Home > ... > Parent > Current` |
| Max visible | 4-5 items before truncation |

### Tabs

| Property | Specification |
|---|---|
| Active indicator | Bottom border (3px), primary color |
| Spacing | 24-32px between tab labels |
| Overflow | Horizontal scroll with fade/arrow indicators |
| Content | Lazy-load tab content (do not render hidden tabs) |
| Mobile | Convert to dropdown or scrollable horizontal tabs |
| Keyboard | Arrow keys to switch, Enter/Space to activate |

---

## Data Display Patterns

### Table

| Property | Specification |
|---|---|
| Header | Sticky, uppercase or bold, `--color-text-secondary` |
| Row height | 48-56px (comfortable), 36-40px (compact) |
| Row hover | Subtle background highlight |
| Row selection | Checkbox in first column, highlight selected row |
| Sorting | Click header to sort, arrow indicator for direction |
| Pagination | Bottom of table: "Showing 1-20 of 150" + prev/next |
| Empty state | Centered illustration + "No data" message + CTA |
| Loading | Skeleton rows (3-5 rows) matching column widths |
| Responsive | Horizontal scroll on mobile, or collapse to card layout |

### Card

```
┌─────────────────────┐
│ [Image/Thumbnail]   │
│                     │
│ Title               │
│ Description text    │
│                     │
│ Meta info   [Action]│
└─────────────────────┘
```

| Property | Specification |
|---|---|
| Border radius | 8-16px |
| Padding | 16-24px |
| Shadow | `--shadow-sm` default, `--shadow-md` on hover |
| Image | Top of card, aspect ratio maintained (16:9 or 4:3) |
| Content | Title (h3-h4), description (body-sm, 2-3 lines max), meta |
| Actions | Bottom-right, or full-width bottom bar |
| Click target | Entire card clickable if single destination |

### List

| Property | Specification |
|---|---|
| Item height | 48-64px |
| Left content | Avatar/icon (40px), or checkbox for selection |
| Primary text | Item name/title, single line, truncate with ellipsis |
| Secondary text | Description or meta, `--color-text-secondary`, single line |
| Right content | Action button, badge, timestamp, or chevron |
| Divider | 1px border between items, or 8px gap |
| Grouped | Section headers for alphabetical/categorical groups |

### Grid

| Property | Specification |
|---|---|
| Columns | Auto-fill with `minmax(250px, 1fr)` for responsive |
| Gap | 16-24px |
| Item | Cards or media tiles |
| Loading | Skeleton grid matching expected count |
| Responsive | 1 col (mobile), 2 col (tablet), 3-4 col (desktop) |
| Masonry | Use CSS `columns` or Masonry layout for varied-height items |

---

## Overlay Patterns

### Modal / Dialog

| Property | Specification |
|---|---|
| Max width | 480px (small), 640px (medium), 800px (large) |
| Backdrop | `rgba(0, 0, 0, 0.5)`, click to dismiss (for non-critical) |
| Position | Centered vertically and horizontally |
| Header | Title + close (X) button |
| Footer | Action buttons right-aligned: [Cancel] [Primary Action] |
| Focus trap | Tab cycles within modal only |
| Escape | Closes modal (for non-critical) |
| Animation | Fade in + scale from 0.95 to 1.0, 200ms |
| Scroll | Body scroll locked, modal content scrolls if needed |

### Toast / Notification

| Property | Specification |
|---|---|
| Position | Top-right or bottom-right, stacked with 8px gap |
| Width | 320-400px |
| Duration | 5 seconds default, persistent for errors |
| Dismiss | X button or swipe |
| Types | Success (green), error (red), warning (amber), info (blue) |
| Icon | Left-aligned, matching type color |
| Max visible | 3 stacked, older ones dismissed |

### Tooltip

| Property | Specification |
|---|---|
| Trigger | Hover (desktop), long-press (mobile) |
| Delay | 300ms show delay, 150ms hide delay |
| Position | Above element preferred, auto-flip if clipped |
| Max width | 200-280px |
| Arrow | 6px triangle pointing to trigger |
| Content | Text only, no interactive elements |
| A11y | `role="tooltip"`, `aria-describedby` on trigger |

### Popover

| Property | Specification |
|---|---|
| Trigger | Click (not hover) |
| Position | Below trigger preferred, auto-flip if clipped |
| Max width | 320px |
| Content | Can contain interactive elements (links, buttons, forms) |
| Dismiss | Click outside, Escape key |
| A11y | `role="dialog"`, focus trapped within |

---

## Empty States

Every data view needs an empty state design:

| Component | Empty State Content |
|---|---|
| Table | Illustration + "No [items] found" + CTA to create |
| List | Same as table |
| Search | "No results for [query]" + suggestions or clear button |
| Dashboard widget | "No data yet" + setup/configure CTA |
| Inbox/Feed | "You're all caught up" + illustration |
| Error/404 | Illustration + explanation + link to home/retry |

### Empty State Structure

```
┌─────────────────────────────────┐
│                                 │
│        [Illustration]           │
│                                 │
│    Title (what's empty)         │
│    Description (why / what to   │
│    do about it)                 │
│                                 │
│        [Primary CTA]            │
│                                 │
└─────────────────────────────────┘
```

Keep illustrations lightweight (SVG, max 200x200px). Description should guide the user's next action.
