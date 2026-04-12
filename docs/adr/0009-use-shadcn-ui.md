# ADR-0009: Use shadcn/ui as Component Library

## Status

Accepted

## Date

2026-04-12

## Context

Aurum needs a UI component library that provides accessible, well-designed primitives (buttons, cards, tables, dropdowns, etc.) without imposing rigid styling. The app has a custom design system from a Lovable prototype that defines specific colors, typography, and visual language.

Traditional component libraries (Material UI, Chakra, Ant Design) come with their own opinionated design language, making it difficult to apply a custom visual identity without fighting the library's defaults. We need components that are unstyled or minimally styled, built on accessible primitives, and easy to customize with Tailwind CSS.

## Decision

Use [shadcn/ui](https://ui.shadcn.com/) as the component library. Unlike npm-installed libraries, shadcn/ui components are copied directly into the project (`src/app/_components/`) and are fully owned by the codebase.

### Setup

- `components.json` configures shadcn for the T3 project with `~/app/_*` path aliases and Tailwind v4
- `src/app/_lib/utils.ts` provides the `cn()` utility (clsx + tailwind-merge)
- Components live in `src/app/_components/` (underscore prefix prevents Next.js route generation) and can be modified freely
- Base dependencies: `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`

### Installed components

sidebar, dropdown-menu, card, button, badge, table, tabs, separator, sheet, tooltip, input, skeleton

Additional components should be added as needed via `npx shadcn@latest add <component>`.

## Consequences

- **Positive:** Full ownership of component code — no version lock-in or upstream breaking changes.
- **Positive:** Components are built on Radix UI primitives, providing strong accessibility (keyboard navigation, ARIA attributes, focus management) out of the box.
- **Positive:** Tailwind-native styling integrates cleanly with the Aurum design system's CSS variables and theme tokens.
- **Positive:** Components are tree-shaken naturally since only installed components are included.
- **Trade-off:** Components must be maintained by the team — upstream improvements require manually re-adding components.
- **Trade-off:** Adds Radix UI as an indirect dependency for interactive components (dropdown, dialog, tooltip, etc.).
