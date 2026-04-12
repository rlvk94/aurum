# ADR-0006: Family-Scoped Multi-Tenancy

## Status

Accepted

## Date

2026-04-12

## Context

Aurum is a multi-user application where financial data is shared within a household. We need a data isolation model that:

- Allows multiple users to collaborate on shared financial data
- Prevents data leakage between unrelated families
- Supports a user belonging to more than one family (e.g. a shared household budget and a side-business workspace)
- Keeps the permission model simple for MVP

The two main approaches are: per-user data ownership (each user sees only their own data) or workspace/tenant-based scoping (data belongs to a shared workspace). Given that the core use case is shared household finances, per-user ownership would require complex sharing mechanics. A workspace model is more natural.

## Decision

Use a **family-scoped multi-tenancy model** where the Family entity is the primary data boundary.

### Structure

- A **Family** is the shared financial workspace. All core financial entities (accounts, transactions, categories, budgets, debts, assets, income plans) belong to a family.
- A **FamilyMember** join table connects users to families with a role (`owner` or `member`).
- An **Invitation** system allows existing members to invite others by email.
- The app maintains an **active family context** — all data access is scoped to the currently selected family.

### Scoping rules

- Every financial record has a `family_id` foreign key.
- All tRPC procedures that access financial data must verify the user's membership in the active family.
- The active family context is determined client-side (e.g. stored in a cookie or session) and validated server-side on every request.
- Users can switch between families they belong to.

### Roles (MVP)

- **Owner:** Full family control — can update family settings, invite/remove members.
- **Member:** Can view and edit all family financial data.

No more granular permissions are needed for MVP.

## Consequences

- **Positive:** Natural fit for shared household finances — all family members see the same accounts, transactions, and budgets.
- **Positive:** Simple mental model — "everything belongs to the family" is easy for users and developers to reason about.
- **Positive:** Clean data isolation — a `WHERE family_id = ?` clause on every query provides hard boundaries.
- **Trade-off:** No per-user financial data within a family. A user can't have "private" transactions hidden from other family members. Acceptable for MVP.
- **Trade-off:** Family switching adds UI complexity (context selector, active family state management).
- **Follow-up:** Need middleware or a tRPC context helper that resolves and validates the active family on every request. Schema must add `family_id` to all financial entity tables.
