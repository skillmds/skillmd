# Accessibility Patterns Reference

> WCAG 2.1 AA checklist, focus management, Maxim roles, screen reader practices, and touch targets.

---

## WCAG 2.1 AA Checklist (Condensed)

### Perceivable

| Criterion | Requirement | How to Check |
|---|---|---|
| **1.1.1 Non-text Content** | All images have `alt` text. Decorative images use `alt=""` | Inspect every `<img>`, `<svg>`, `<canvas>` |
| **1.2.1 Audio/Video** | Provide captions for prerecorded audio/video | Check all media elements |
| **1.3.1 Info and Relationships** | Structure conveyed visually is also in markup (headings, lists, tables) | Validate heading hierarchy (h1 > h2 > h3, no skips) |
| **1.3.2 Meaningful Sequence** | Reading order in DOM matches visual order | Tab through page, verify logical order |
| **1.3.3 Sensory Characteristics** | Instructions don't rely solely on shape, size, position, or color | Check for "click the red button" type instructions |
| **1.3.4 Orientation** | Content works in both portrait and landscape | Test device rotation |
| **1.3.5 Input Purpose** | Form inputs have `autocomplete` attributes where applicable | Check login, address, payment forms |
| **1.4.1 Use of Color** | Color is not the only means of conveying information | Check error states, status indicators, charts |
| **1.4.2 Audio Control** | Auto-playing audio can be paused/stopped within 3 seconds | Check for auto-play media |
| **1.4.3 Contrast (Minimum)** | Text: 4.5:1 ratio. Large text (18px+ bold, 24px+): 3:1 | Use contrast checker on all text |
| **1.4.4 Resize Text** | Page usable when text zoomed to 200% | Browser zoom to 200%, check for overflow |
| **1.4.5 Images of Text** | Use real text, not images of text (logos excepted) | Check for text in images |
| **1.4.10 Reflow** | Content reflows at 320px width (no horizontal scroll) | Set viewport to 320px, verify |
| **1.4.11 Non-text Contrast** | UI components and graphics: 3:1 ratio against adjacent colors | Check borders, icons, focus rings |
| **1.4.12 Text Spacing** | Content works with: line-height 1.5x, paragraph spacing 2x, letter-spacing 0.12em, word-spacing 0.16em | Apply these overrides, check for clipping |
| **1.4.13 Content on Hover/Focus** | Hover/focus content: dismissible, hoverable, persistent | Check tooltips and popovers |

### Operable

| Criterion | Requirement | How to Check |
|---|---|---|
| **2.1.1 Keyboard** | All functionality accessible via keyboard | Tab through entire page |
| **2.1.2 No Keyboard Trap** | Focus can always be moved away from any element | Tab into and out of every interactive element |
| **2.1.4 Character Key Shortcuts** | Single-character shortcuts can be turned off or remapped | Check for keyboard shortcut conflicts |
| **2.2.1 Timing Adjustable** | Time limits can be extended (20x) or turned off | Check session timeouts, auto-advancing content |
| **2.3.1 Three Flashes** | Nothing flashes more than 3 times per second | Check animations, video content |
| **2.4.1 Bypass Blocks** | "Skip to main content" link available | Check first focusable element on page |
| **2.4.2 Page Titled** | Each page has a descriptive `<title>` | Check `document.title` on each route |
| **2.4.3 Focus Order** | Focus order is logical and intuitive | Tab through page, verify sequence |
| **2.4.4 Link Purpose** | Link text describes destination (no "click here") | Check all `<a>` text content |
| **2.4.5 Multiple Ways** | At least 2 ways to find each page (nav, search, sitemap) | Verify navigation options |
| **2.4.6 Headings and Labels** | Headings and labels describe their content | Read all headings in isolation |
| **2.4.7 Focus Visible** | Keyboard focus indicator is always visible | Tab through page, check focus rings |
| **2.5.1 Pointer Gestures** | Multi-point gestures have single-pointer alternatives | Check pinch, swipe, multi-touch |
| **2.5.2 Pointer Cancellation** | Down-event doesn't trigger action; up-event does (or abort by moving off) | Click and drag off buttons |
| **2.5.3 Label in Name** | Visible label text is included in accessible name | Compare visual label to `aria-label` |
| **2.5.4 Motion Actuation** | Motion-triggered actions have UI alternatives | Check shake, tilt, rotation features |

### Understandable

| Criterion | Requirement | How to Check |
|---|---|---|
| **3.1.1 Language of Page** | `<html lang="en">` attribute set | Inspect HTML element |
| **3.1.2 Language of Parts** | Content in other languages marked with `lang` attribute | Check multilingual content |
| **3.2.1 On Focus** | Focus alone doesn't trigger context change | Tab through all elements |
| **3.2.2 On Input** | Input change doesn't auto-submit without warning | Check all form inputs |
| **3.3.1 Error Identification** | Errors identified and described in text | Trigger form validation |
| **3.3.2 Labels or Instructions** | Form elements have visible labels | Check all form fields |
| **3.3.3 Error Suggestion** | Error messages suggest correction when possible | Trigger each validation error |
| **3.3.4 Error Prevention** | Reversible, confirmable, or reviewable for legal/financial | Check delete, purchase, submission flows |

### Robust

| Criterion | Requirement | How to Check |
|---|---|---|
| **4.1.1 Parsing** | Valid HTML (no duplicate IDs, proper nesting) | Run HTML validator |
| **4.1.2 Name, Role, Value** | All components have accessible name, role, and state | Inspect with screen reader |
| **4.1.3 Status Messages** | Status messages announced without focus change | Check toast notifications, form feedback |

---

## Focus Management Patterns

### Focus Ring Styling

```css
/* Default: remove browser outline, add custom ring */
:focus {
  outline: none;
}
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: 4px;
}

/* High contrast mode support */
@media (forced-colors: active) {
  :focus-visible {
    outline: 2px solid Highlight;
  }
}
```

### Skip Navigation Link

```html
<a href="#main-content" class="skip-link">
  Skip to main content
</a>
<!-- ... header/nav ... -->
<main id="main-content" tabindex="-1">
```

```css
.skip-link {
  position: absolute;
  top: -100%;
  left: 16px;
  padding: 8px 16px;
  background: var(--color-primary);
  color: white;
  z-index: 1000;
  border-radius: 4px;
}
.skip-link:focus {
  top: 16px;
}
```

### Modal Focus Trap

1. On open: save reference to trigger element
2. Move focus to first focusable element inside modal (or the modal itself)
3. Trap Tab/Shift+Tab within modal (wrap from last to first and vice versa)
4. On Escape: close modal
5. On close: return focus to saved trigger element

### Focus After Dynamic Content

| Action | Focus Target |
|---|---|
| Modal opens | First focusable element in modal |
| Modal closes | Element that triggered the modal |
| Toast appears | Do NOT move focus (announce via `aria-live`) |
| Item deleted from list | Next item in list, or previous if last |
| Accordion expands | Content area of expanded section |
| Tab changes | Tab panel content |
| Page navigation (SPA) | Page heading or `<main>` element |
| Inline edit completes | The edited element |
| Error on submit | First field with error |

---

## Maxim Roles and Landmarks

### Landmark Roles

| Role | HTML Equivalent | Purpose |
|---|---|---|
| `banner` | `<header>` (top-level) | Site-wide header |
| `navigation` | `<nav>` | Navigation links |
| `main` | `<main>` | Primary content (1 per page) |
| `complementary` | `<aside>` | Supporting content |
| `contentinfo` | `<footer>` (top-level) | Site-wide footer |
| `search` | `<search>` (HTML 5.3) | Search functionality |
| `form` | `<form>` (with accessible name) | Form region |
| `region` | `<section>` (with accessible name) | Generic named region |

### Common Widget Roles

| Pattern | Role | Required Maxim |
|---|---|---|
| Dropdown menu | `menu` + `menuitem` | `aria-expanded`, `aria-haspopup` |
| Tabs | `tablist` + `tab` + `tabpanel` | `aria-selected`, `aria-controls` |
| Accordion | `button` (trigger) | `aria-expanded`, `aria-controls` |
| Dialog/Modal | `dialog` | `aria-modal="true"`, `aria-labelledby` |
| Alert/Toast | `alert` or `status` | `aria-live="assertive"` or `"polite"` |
| Combobox | `combobox` + `listbox` + `option` | `aria-expanded`, `aria-activedescendant` |
| Tree view | `tree` + `treeitem` | `aria-expanded`, `aria-level` |
| Toolbar | `toolbar` | `aria-label`, arrow key navigation |
| Tooltip | `tooltip` | `aria-describedby` on trigger |
| Switch/Toggle | `switch` | `aria-checked` |
| Progressbar | `progressbar` | `aria-valuenow`, `aria-valuemin`, `aria-valuemax` |
| Slider | `slider` | `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-orientation` |

### Maxim Live Regions

| Attribute | Behavior | Use For |
|---|---|---|
| `aria-live="polite"` | Announced after current speech | Status updates, search results count |
| `aria-live="assertive"` | Interrupts current speech immediately | Errors, urgent alerts |
| `role="status"` | Implicit `aria-live="polite"` | Form feedback, loading states |
| `role="alert"` | Implicit `aria-live="assertive"` | Error messages, critical notifications |
| `aria-atomic="true"` | Announce entire region, not just changes | Counters, time displays |

### Maxim Rules

1. **First rule of Maxim:** Do not use Maxim if a native HTML element exists (`<button>` not `<div role="button">`)
2. **Do not change native semantics:** Never add `role="heading"` to a `<button>`
3. **All interactive Maxim elements must be keyboard-accessible**
4. **Do not use `role="presentation"` or `aria-hidden="true"` on focusable elements**
5. **All interactive elements must have an accessible name** (via label, `aria-label`, or `aria-labelledby`)

---

## Screen Reader Best Practices

### Accessible Names (Priority Order)

1. `aria-labelledby` (references another element's text)
2. `aria-label` (direct string label)
3. `<label for="...">` (form elements)
4. Content text (buttons, links)
5. `title` attribute (last resort, inconsistent support)
6. `alt` attribute (images only)

### Visually Hidden Text

For screen-reader-only content (not `display: none` which hides from all):

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

### Common Screen Reader Announcements

| Action | Announcement Pattern |
|---|---|
| Button click | "[Button label], button" + result via live region |
| Link | "[Link text], link" |
| Form error | "Error: [field label] — [error message]" |
| Loading start | "Loading..." (via `aria-live`) |
| Loading complete | "Content loaded" or "[N] results found" (via `aria-live`) |
| Item deleted | "[Item name] deleted" (via `aria-live`) |
| Notification | "[Notification text]" (via `role="alert"` or `role="status"`) |

### Testing with Screen Readers

| Platform | Screen Reader | Browser |
|---|---|---|
| Windows | NVDA (free) | Firefox or Chrome |
| Windows | JAWS | Chrome or Edge |
| macOS | VoiceOver (built-in) | Safari |
| iOS | VoiceOver (built-in) | Safari |
| Android | TalkBack (built-in) | Chrome |

---

## Color Contrast Requirements

### Quick Reference

| Content Type | Minimum Ratio (AA) | Enhanced Ratio (AAA) |
|---|---|---|
| Normal text (<18.66px bold, <24px) | 4.5 : 1 | 7 : 1 |
| Large text (>=18.66px bold, >=24px) | 3 : 1 | 4.5 : 1 |
| UI components (borders, icons) | 3 : 1 | N/A |
| Focus indicators | 3 : 1 | N/A |
| Disabled elements | No requirement | No requirement |
| Decorative elements | No requirement | No requirement |
| Logos / brand marks | No requirement | No requirement |

### Non-Color Indicators

Never use color alone. Pair with:

| Color Signal | Additional Indicator |
|---|---|
| Error (red border) | + error icon + error text message |
| Success (green) | + checkmark icon + success text |
| Warning (amber) | + warning triangle icon + warning text |
| Required field | + asterisk (*) + "(required)" text |
| Active/selected | + bold text or filled icon or underline |
| Link text (blue) | + underline (for inline links) |
| Chart data series | + patterns/shapes/labels (not just color) |

---

## Touch Target Sizes

### Requirements

| Standard | Minimum Size | Target |
|---|---|---|
| WCAG 2.5.5 (AAA) | 44 x 44 px | All interactive elements |
| WCAG 2.5.8 (AA, new) | 24 x 24 px | Minimum with spacing |
| Apple HIG | 44 x 44 pt | iOS touch targets |
| Material Design | 48 x 48 dp | Android touch targets |
| **Recommended** | **48 x 48 px** | **Universal safe minimum** |

### Implementation

The visual element can be smaller than 48px, but the touch/click target must meet the minimum:

```css
/* Visual: 24px icon. Touch target: 48px */
.icon-button {
  position: relative;
  width: 24px;
  height: 24px;
}
.icon-button::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 48px;
  height: 48px;
}
```

### Spacing Between Targets

- Minimum 8px gap between adjacent touch targets
- If targets are smaller than 48px, increase surrounding padding to compensate
- Inline links in body text: ensure sufficient line height (1.5+) for tap accuracy

---

## Keyboard Navigation Patterns

### Standard Keys

| Key | Action |
|---|---|
| `Tab` | Move to next focusable element |
| `Shift + Tab` | Move to previous focusable element |
| `Enter` | Activate button, link, or submit |
| `Space` | Activate button, toggle checkbox, select option |
| `Escape` | Close modal, dropdown, popover |
| `Arrow keys` | Navigate within composite widgets (tabs, menus, radio groups) |
| `Home` / `End` | First/last item in list, menu, or slider |

### Tab Order Rules

1. Follow visual layout order (left-to-right, top-to-bottom)
2. Never use `tabindex` > 0 (creates unpredictable order)
3. Use `tabindex="0"` to make non-interactive elements focusable when needed
4. Use `tabindex="-1"` for programmatic focus (not in tab order, but focusable via JS)
5. Remove hidden/invisible elements from tab order (`display: none` or `aria-hidden="true"` + `tabindex="-1"`)

---

## Semantic HTML Checklist

| Check | Correct | Incorrect |
|---|---|---|
| Clickable action | `<button>` | `<div onclick>` |
| Navigation link | `<a href="...">` | `<span onclick>` |
| Page heading | `<h1>` - `<h6>` | `<div class="heading">` |
| List of items | `<ul>` / `<ol>` + `<li>` | `<div>` with separators |
| Data table | `<table>` + `<th>` + `<td>` | `<div>` grid with `role` |
| Form field | `<input>` + `<label>` | `<div contenteditable>` |
| Main content | `<main>` | `<div id="content">` |
| Navigation | `<nav>` | `<div id="nav">` |
| Site header | `<header>` | `<div id="header">` |
| Site footer | `<footer>` | `<div id="footer">` |
| Sidebar | `<aside>` | `<div id="sidebar">` |
