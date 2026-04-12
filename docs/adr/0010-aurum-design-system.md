# ADR-0010: Aurum Design System from Lovable Prototype

## Status

Proposed

## Date

2026-04-12

## Context

Aurum's UX should feel premium, calm, modern, trustworthy, and analytical. A design system was created via a Lovable prototype to establish the visual language before implementation. This design system needs to be the source of truth for all UI decisions in the codebase.

## Decision

Adopt the **Lovable prototype export** as the Aurum design system, implemented via CSS custom properties and Tailwind v4 theme tokens in `src/styles/globals.css`.

### Typography

- **Display font:** DM Serif Display — used for h1, h2, h3 headings. Loaded via `next/font/google`.
- **Body font:** DM Sans — used for all body text, labels, and UI elements. Loaded via `next/font/google`.
- Tailwind classes: `font-sans` (DM Sans), `font-display` (DM Serif Display).

### Color Palette

Base colors use a warm gold/amber primary with a dark blue-gray foreground:

| Token | Purpose | Value |
|-------|---------|-------|
| `primary` | Gold accent — buttons, links, active states | `hsl(38 60% 50%)` |
| `secondary` | Light gray — secondary backgrounds | `hsl(220 14% 96%)` |
| `accent` | Warm light gold — hover/highlight backgrounds | `hsl(38 40% 92%)` |
| `muted` | Warm gray — disabled states, subtle backgrounds | `hsl(40 15% 94%)` |
| `destructive` | Red — delete, error states | `hsl(0 60% 55%)` |

### Semantic Finance Colors

These are domain-specific and should be used consistently for financial data:

| Token | Purpose | Example usage |
|-------|---------|---------------|
| `income` / `income-muted` | Green — income amounts, positive changes | Transaction amounts, income badges |
| `expense` / `expense-muted` | Red — expense amounts, negative changes | Transaction amounts, overspending |
| `debt` / `debt-muted` | Orange — debt balances, liabilities | Debt cards, net worth liabilities |
| `savings` / `savings-muted` | Blue — savings, positive financial goals | Savings progress, account highlights |
| `warning` / `warning-muted` | Amber — budget warnings, approaching limits | Budget progress bars nearing limit |

### Sidebar

Dark sidebar (`hsl(220 20% 12%)`) with gold primary accent, matching the prototype's navigation style.

### Shadows

- `shadow-card` — subtle shadow for card surfaces
- `shadow-elevated` — stronger shadow for floating elements (dropdowns, modals)

### Design Principles

- Clarity over density
- Simple navigation with obvious hierarchy
- Low-friction input for financial data
- Clean, spacious layouts
- Consistent use of finance semantic colors
- Do not introduce new UI patterns when equivalent design-system components exist

## Consequences

- **Positive:** Consistent visual language across all screens from day one.
- **Positive:** Finance-specific semantic colors prevent ad-hoc color choices for income/expense/debt/savings states.
- **Positive:** CSS custom properties make the system easy to adjust globally if the design evolves.
- **Positive:** Tailwind v4 `@theme inline` tokens make all design system values available as utility classes (e.g. `bg-income-muted`, `text-expense`, `shadow-card`).
- **Trade-off:** No dark mode in MVP — only light theme is defined. Can be added later by extending the `:root` variables with a `.dark` variant.
- **Follow-up:** All new UI work should reference the design system tokens rather than hardcoding colors. The Lovable prototype should be consulted for layout and component patterns when building new screens.
