# Design Critique Frameworks Reference

> Heuristic evaluation, cognitive walkthrough, review checklists, and anti-patterns to detect.

---

## Nielsen's 10 Usability Heuristics

### 1. Visibility of System Status

The system should always keep users informed about what is going on, through appropriate feedback within reasonable time.

**Check for:**

| Signal | Implementation |
|---|---|
| Loading state | Spinner, skeleton, or progress bar during async operations |
| Save confirmation | Toast or inline "Saved" feedback after user action |
| Form validation | Real-time inline validation as user types |
| Upload progress | Progress bar with percentage or file size |
| Navigation indicator | Active state on current nav item, breadcrumbs |
| Connection status | Offline banner, sync status indicator |
| Background process | Status bar or notification when background task completes |

**Violation example:** User clicks "Submit" and nothing visibly happens for 3 seconds.

### 2. Match Between System and the Real World

The system should speak the users' language, with words, phrases, and concepts familiar to the user, rather than system-oriented terms.

**Check for:**

| Issue | Fix |
|---|---|
| Technical jargon | Replace "400 Bad Request" with "Something went wrong with your submission" |
| System IDs exposed | Show human names, not UUIDs or database IDs |
| Developer-centric labels | "Payload" → "Data", "Mutation" → "Change", "Null" → "None" |
| Unfamiliar icons | Use universally recognized icons or add text labels |
| Date formats | Use locale-appropriate formats, relative time ("2 hours ago") |

**Violation example:** Error message reads "ERR_CONN_REFUSED: ECONNREFUSED 127.0.0.1:5432".

### 3. User Control and Freedom

Users often choose system functions by mistake. Provide a clearly marked "emergency exit" to leave the unwanted state.

**Check for:**

| Feature | Implementation |
|---|---|
| Undo | Support Ctrl/Cmd+Z for destructive actions |
| Cancel | Every multi-step process has a cancel/back option |
| Close | Modals, drawers, panels all have close button + Escape key |
| Back navigation | Browser back button works correctly in SPAs |
| Draft saving | Auto-save form data to prevent accidental loss |
| Confirmation dialogs | Before permanent deletion or irreversible actions |

**Violation example:** User accidentally deletes a project with no undo option.

### 4. Consistency and Standards

Users should not have to wonder whether different words, situations, or actions mean the same thing.

**Check for:**

| Aspect | Consistency Rule |
|---|---|
| Button labels | Same action = same label everywhere ("Save" not sometimes "Submit") |
| Icon meanings | Same icon = same action everywhere |
| Color meanings | Red = error everywhere, green = success everywhere |
| Interaction patterns | Dropdowns behave the same in all contexts |
| Terminology | One term per concept (not "user" and "member" interchangeably) |
| Layout patterns | Similar pages use similar layouts |
| Platform conventions | Follow OS/browser conventions (Cmd+C, right-click menus) |

**Violation example:** "Close" button is top-right in some modals, bottom-left in others.

### 5. Error Prevention

Even better than good error messages is a careful design which prevents a problem from occurring in the first place.

**Check for:**

| Prevention Type | Implementation |
|---|---|
| Constrained input | Date pickers (not free text), dropdowns for fixed options |
| Inline validation | Validate email format before submission |
| Confirmation | "Are you sure?" for destructive/irreversible actions |
| Smart defaults | Pre-fill with sensible defaults, last-used values |
| Disabled states | Disable submit until form is valid |
| Character limits | Show remaining characters, prevent exceeding |
| Type checking | Input masks for phone numbers, credit cards |

**Violation example:** User can type "abc" in a numeric quantity field.

### 6. Recognition Rather Than Recall

Minimize the user's memory load by making objects, actions, and options visible.

**Check for:**

| Feature | Implementation |
|---|---|
| Visible options | Show available actions, don't hide behind right-click only |
| Search with autocomplete | Suggest options as user types |
| Recent items | Show recently used/visited items |
| Contextual help | Tooltips, inline hints near complex fields |
| Breadcrumbs | Show path to current location |
| Placeholder examples | Show expected input format ("e.g., john@example.com") |
| Visible labels | All form fields have persistent labels (not placeholder-only) |

**Violation example:** User must memorize a 6-step process with no visible progress indicator.

### 7. Flexibility and Efficiency of Use

Accelerators — unseen by the novice user — may often speed up the interaction for the expert user.

**Check for:**

| Feature | Implementation |
|---|---|
| Keyboard shortcuts | Common actions have keyboard shortcuts |
| Bulk actions | Select multiple items and act on all at once |
| Search/filter | Quick search to bypass navigation |
| Customization | Users can rearrange, pin, or hide UI elements |
| Templates/presets | Pre-made configurations for common use cases |
| Command palette | Cmd+K / Ctrl+K for power users |
| Drag-and-drop | Direct manipulation for reordering, organizing |

**Violation example:** User must click through 5 screens to perform a daily task with no shortcut.

### 8. Aesthetic and Minimalist Design

Dialogues should not contain information which is irrelevant or rarely needed.

**Check for:**

| Issue | Fix |
|---|---|
| Information overload | Progressive disclosure — show details on demand |
| Visual clutter | Remove decorative elements that don't aid comprehension |
| Competing CTAs | One primary action per view, secondary actions de-emphasized |
| Unnecessary fields | Only ask for what's immediately needed |
| Wall of text | Break into scannable sections, use bullets, whitespace |
| Redundant elements | Remove duplicate navigation, repeated labels |

**Violation example:** Settings page shows all 50 options at once with no grouping or search.

### 9. Help Users Recognize, Diagnose, and Recover from Errors

Error messages should be expressed in plain language (no codes), precisely indicate the problem, and constructively suggest a solution.

**Check for:**

| Error Component | Requirement |
|---|---|
| Language | Plain language, no error codes shown to user |
| Specificity | Name the exact field or action that caused the error |
| Solution | Suggest specific fix ("Enter a valid email address") |
| Placement | Near the source of the error (inline, not just top-of-page) |
| Persistence | Error stays visible until resolved |
| Accessibility | Error announced to screen readers, field linked via `aria-describedby` |

**Violation example:** "An error occurred. Please try again."

### 10. Help and Documentation

Even though it is better if the system can be used without documentation, it may be necessary to provide help and documentation.

**Check for:**

| Feature | Implementation |
|---|---|
| Onboarding | First-time user tour or walkthrough |
| Tooltips | Contextual help on hover/focus for complex features |
| Search | Searchable help/docs within the product |
| FAQ | Common questions answered in-app |
| Empty states | Guide users on what to do when there's no data |
| Contact support | Accessible help channel (chat, email, link) |

**Violation example:** Complex feature with no onboarding, tooltips, or documentation link.

---

## Cognitive Walkthrough Protocol

A step-by-step evaluation simulating a first-time user completing a task.

### Setup

1. Define the **user goal** (what the user wants to accomplish)
2. Define the **action sequence** (ideal steps to complete the goal)
3. Define the **user persona** (experience level, context, motivation)

### For Each Step, Ask:

| Question | What You're Evaluating |
|---|---|
| **Will the user try to achieve this step?** | Is the goal clear? Does the user know this step is needed? |
| **Will the user see the correct action?** | Is the control visible, discoverable, and labeled clearly? |
| **Will the user associate the action with the goal?** | Does the label/icon clearly suggest what it does? |
| **Will the user see progress?** | After acting, is it clear the step succeeded and what comes next? |

### Severity Rating

| Rating | Meaning | Action |
|---|---|---|
| 0 | No problem | None |
| 1 | Cosmetic | Fix when convenient |
| 2 | Minor usability | Should fix |
| 3 | Major usability | Must fix before release |
| 4 | Usability catastrophe | Must fix immediately — blocks user |

---

## Design Review Checklist

### Visual Design

- [ ] Color palette is consistent (no off-brand colors)
- [ ] Typography follows the type scale (no arbitrary sizes)
- [ ] Spacing uses the spacing scale (no arbitrary pixel values)
- [ ] Alignment is consistent (left-aligned, grid-based)
- [ ] Visual hierarchy is clear (primary > secondary > tertiary)
- [ ] Icons are from the same icon set (consistent style/weight)
- [ ] Images/illustrations have consistent treatment

### Interaction Design

- [ ] All interactive elements have hover, focus, active, disabled states
- [ ] Loading states are defined for all async operations
- [ ] Empty states are designed for all data views
- [ ] Error states are designed for all forms and data operations
- [ ] Success/confirmation states are defined
- [ ] Transitions and animations are purposeful and fast (<300ms)
- [ ] Touch targets meet 48px minimum on mobile

### Information Architecture

- [ ] Navigation structure matches mental model (card sort validated)
- [ ] Labels are user-language, not developer-language
- [ ] Heading hierarchy is logical (h1 > h2 > h3, no skips)
- [ ] Content is scannable (bullets, bold key terms, short paragraphs)
- [ ] CTAs are clear and action-oriented ("Create project" not "Submit")

### Accessibility

- [ ] Color contrast meets WCAG AA (4.5:1 text, 3:1 UI)
- [ ] Focus states are visible on all interactive elements
- [ ] All images have alt text
- [ ] Forms have visible labels (not placeholder-only)
- [ ] Error messages are descriptive and placed near the error source
- [ ] Page has skip navigation link
- [ ] Maxim roles are used correctly (or native HTML preferred)
- [ ] Content is usable at 200% zoom
- [ ] `prefers-reduced-motion` is respected

### Responsive Design

- [ ] Layout works at all breakpoints (xs through 2xl)
- [ ] No horizontal scroll at any breakpoint
- [ ] Navigation adapts for mobile (hamburger, bottom nav)
- [ ] Touch-friendly on mobile (spacing, target sizes)
- [ ] Text remains readable on all screen sizes (14px minimum)
- [ ] Images are responsive (srcset or CSS object-fit)
- [ ] Modals/overlays work on mobile screens

### Content

- [ ] Microcopy is helpful and concise
- [ ] Error messages suggest solutions
- [ ] Button labels are action verbs ("Save", "Create", "Send")
- [ ] Placeholder text shows format examples, not label duplicates
- [ ] Success messages confirm what happened
- [ ] Empty states guide users to the next action

---

## Common UI Anti-Patterns to Avoid

### Navigation Anti-Patterns

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Mystery meat navigation** | Icons without labels, unclear destinations | Add text labels to icons |
| **Deep nesting** (4+ levels) | Users get lost, high cognitive load | Flatten IA, use search |
| **Disappearing navigation** | Nav hides on scroll with no way to recall | Sticky nav or accessible scroll-to-top |
| **Inconsistent back behavior** | Back button doesn't return to expected page | Proper history management in SPA |
| **Hamburger-only on desktop** | Hides primary navigation unnecessarily | Show full nav on desktop |

### Form Anti-Patterns

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Placeholder-only labels** | Label disappears on input focus, accessibility failure | Use persistent labels above inputs |
| **Inline validation too early** | Validates before user finishes typing | Validate on blur or submit, not on change |
| **Clear button on all fields** | Users accidentally clear completed fields | Only on search/filter inputs |
| **Disabled submit without explanation** | User doesn't know why they can't submit | Show inline validation messages |
| **Multi-column forms** | Users miss fields, read out of order | Single column for most forms |
| **Asterisks without legend** | Users guess what * means | Add "(required)" label or legend |

### Modal Anti-Patterns

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Modal on page load** | Blocks content before user engagement | Delay or use inline banners |
| **Nested modals** | Disorienting, complex focus management | Redesign as multi-step within one modal |
| **Long scrolling modal** | Content should be a page, not a modal | Use a dedicated page instead |
| **No close mechanism** | User feels trapped | Always: X button + click outside + Escape |
| **Modal for confirmation** | Overuse for simple actions | Use inline confirmation or undo |

### Data Display Anti-Patterns

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Infinite scroll without position** | User loses place, can't bookmark | Add position indicator or pagination |
| **No empty state** | Blank page confuses users | Show illustration + guidance + CTA |
| **Truncation without reveal** | Important data hidden with no way to see full text | Tooltip on hover, expand on click |
| **Auto-sorting/reordering** | Content moves unexpectedly | Sort on user action only |
| **Dense tables on mobile** | Unreadable horizontal scroll | Convert to card layout on mobile |

### Performance Anti-Patterns

| Anti-Pattern | Problem | Fix |
|---|---|---|
| **Layout shift (CLS)** | Content jumps as images/fonts load | Reserve space, use `aspect-ratio` |
| **No loading state** | User thinks app is broken | Show skeleton or spinner immediately |
| **Blocking the main thread** | UI freezes during computation | Use Web Workers, lazy loading |
| **Loading everything upfront** | Slow initial page load | Code splitting, lazy routes |
| **Animating layout properties** | Janky 60fps failure | Only animate `transform` and `opacity` |

### Dark Pattern Anti-Patterns (Ethical)

These are deceptive patterns. Never implement them.

| Dark Pattern | Description | Why It's Wrong |
|---|---|---|
| **Confirmshaming** | "No thanks, I don't want to save money" | Emotional manipulation |
| **Hidden unsubscribe** | Making opt-out extremely difficult | User control violation |
| **Bait and switch** | Promising one thing, delivering another | Trust destruction |
| **Disguised ads** | Ads that look like content or navigation | Deception |
| **Forced continuity** | Free trial auto-converts without clear notice | Financial harm |
| **Roach motel** | Easy to sign up, impossible to delete account | User control violation |
| **Trick questions** | Double negatives in opt-in/opt-out language | Cognitive manipulation |
| **Sneak into basket** | Adding items to cart without user action | Financial harm |
