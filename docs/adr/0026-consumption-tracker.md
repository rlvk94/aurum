# ADR-0026: Consumption Tracker (Utility Meter Readings)

## Status

Proposed

## Date

2026-09-05

## Context

The product owner tracks gas, water and electricity meter readings in an Excel
sheet: once a month, on the 1st, every meter's counter is written down and the
sheet derives monthly consumption and compares it with the year before. Aurum
should replace that sheet with a standalone, family-scoped tool under
"Værktøjer", including a reminder so the reading day is not forgotten.

Constraints and observations that shaped the design:

- **Readings are cumulative.** A physical meter shows a running total; the
  natural thing to record is that number on a date. Consumption is a derived
  quantity (difference between two readings).
- **Cadence differs between families.** The owner reads on the 1st, but others
  will read mid-month, weekly or irregularly. Monthly and yearly figures must be
  comparable regardless of when the counter was read.
- **Units only, no cost.** Energy prices live in transactions and budgets;
  the tracker answers "how much did we use", not "what did it cost".
- **Meters get replaced.** A new meter starts at (near) zero, so a naive delta
  goes negative. The data model must represent "unknown consumption here".
- **Family scoping and manual entry** follow ADR-0006 and ADR-0007. No import in
  v1 (the owner enters history by hand or starts fresh).
- **Reminder infrastructure exists.** ADR-0025 gives us channels, per-user
  preferences, dedupe and a daily cron sweep at ~06:00 Europe/Copenhagen.
  Adding a Coolify cron entry is a human-only production step.

## Decision

### Cumulative readings; consumption is always derived

Tables (`src/server/db/schema/consumption.ts`):

```
consumption_meter     id, family_id, name, kind, unit, decimals, sort_order,
                      archived, created_at, updated_at
consumption_reading   id, meter_id, family_id, date, value (bigint, milli-units),
                      is_meter_reset, note, created_at, updated_at
                      UNIQUE (meter_id, date), INDEX (family_id, date)
consumption_settings  family_id PK, reminder_enabled, reminder_cadence,
                      reminder_day_of_month, reminder_weekday, timestamps
```

We store only what the meter displayed. Consumption per interval, per month and
per year is computed in a pure module (`src/server/lib/consumption.ts`) that the
client can import too.

_Rejected: storing per-period consumption._ Two sources of truth; every edit,
delete or date move would cascade into neighbouring rows; meter resets would
need special-cased writes. Deriving keeps writes trivial and history honest.

### Pro-rata calendar-month normalisation with coverage

An interval between two readings covers the half-open day range `[from, to)`:
a reading is taken at the start of its day. Its consumption is spread linearly
over the calendar months it overlaps, weighted by days. Each month reports
`coveredDays / daysInMonth`; a month is **complete** only when fully covered.

- A family reading on the 1st of every month gets exact calendar months with
  zero leakage (Jan 1 → Feb 1 is all January).
- Mid-month or weekly readers get proportional splits that still sum to the
  measured total (±1 milli-unit rounding per bucket).
- Partially covered months are shown muted/dashed with their coverage, never
  silently presented as full months.
- Year-over-year change is **like-for-like**: only months complete in both
  years are compared. Heat and electricity are strongly seasonal, so Jan–Aug
  against a full prior year would be meaningless.

### Integer milli-units in `bigint`

Values are integers scaled ×1000 (three decimals), the same "integer with a
documented scale" rule the codebase uses for øre and basis points. The column is
`bigint` (Drizzle `mode: "number"`) because a 7-digit electricity meter × 1000
exceeds `int4`. Display precision (`decimals`, 0–3) is a per-meter setting.

_Rejected: `numeric`._ Breaks the codebase's no-decimal-columns convention and
returns strings at the ORM boundary. _Rejected: `integer`._ Overflows for
7-digit meters.

### `text` + TS const arrays instead of `pgEnum`

`kind`, `unit` and reminder `cadence` are `text`. Valid sets live in
`src/lib/consumption-kinds.ts` and are enforced with zod at the tRPC boundary,
consistent with ADR-0025. Growing the sets is a code change, not a migration.
`unit` is stored rather than derived from `kind`: Danish district-heating
meters show kWh, MWh or GJ depending on the utility, and "other" needs free
text.

### One sequence invariant, enforced in the router

A non-reset reading may not be lower than the reading before it (by date).
Every write — create, update, date move, reset toggle, bulk upsert, delete —
applies the proposed change to the meter's in-memory reading list and
validates the whole sequence with `validateReadingSequence`. Deleting a reset
reading that would leave a decrease is rejected with a hint. The pure lib also
clamps a negative delta to "unknown" so a transient race can never render a
negative bar.

_Rejected: a database constraint or trigger._ The invariant depends on the
neighbouring row and on the reset flag; not expressible as a CHECK, and a
trigger would hide domain rules from the codebase.

### Meter replacement via `is_meter_reset`

The interval ending at a reset reading has unknown consumption (`null`). Its
days are reported as `unknownDays` so the affected month is never marked
complete. The next interval computes normally against the reset reading.

### Bulk entry as the primary flow

The "Aflæs målere" dialog submits one date and one value per active meter in a
single `bulkUpsertReadings` mutation (upsert on `(meter_id, date)`). All rows are
validated first and every violation is returned together so the dialog can mark
each field, rather than failing on the first.

### Reminder as a notification type on the existing daily sweep

New type `consumption_reading_reminder` (email + push, both on by default).
Family-level schedule in `consumption_settings`: monthly on a day (1–31, 31
clamps to the last day of shorter months) or weekly on an ISO weekday. The
existing `/api/cron/notification-sweep` route runs a second step,
`runConsumptionReminderSweep`, which for each enabled family checks
`isReminderDueToday` against the Europe/Copenhagen date, skips families whose
active meters already have a reading dated today, and dispatches once per due
date using the dedupe key `consumption_reading_reminder:{familyId}:{date}`.
Per-user channel toggles come from the ADR-0025 preference matrix for free.

_Rejected: a separate cron route._ Would require a human Coolify change for no
functional gain; the daily sweep already runs at the right time.
_Rejected: nagging until entered._ Product decision: fire once per due date.

### Free on both plans

`consumption: true` in both `PLAN_FEATURES` entries (ADR-0019) with no
`requireFeature` calls — the same treatment as the income planner. The key
exists so the feature can be gated later without touching call sites.

### Overdue indicator

`isReadingOverdue` uses the configured schedule when the reminder is enabled
(last reading before the most recent due date). When no reminder is configured
we do not know the family's reading day, so a lenient grace (35 days monthly,
9 days weekly) avoids flagging a mid-month reader from the 1st.

## Consequences

- **Positive:** Writes are trivial (one row per reading); all analytics are
  reproducible from raw readings; changing the normalisation later needs no
  data migration.
- **Positive:** One pure module holds every rule (intervals, buckets, year
  summary, schedule maths) and is unit-tested in isolation.
- **Positive:** No new infrastructure — reuses the notification system, the
  daily cron and the preference UI (the new type appears automatically).
- **Trade-off:** Validation of the reading sequence happens in application code;
  two members writing the same meter simultaneously could bypass it. The unique
  index keeps the upsert safe and the lib clamps negatives, so the worst case is
  an "unknown" interval that the next edit repairs.
- **Trade-off:** `notification_log` gains one row per member per due date. Cheap,
  but stale-row cleanup (already deferred in ADR-0025) becomes more relevant.
- **Trade-off:** Derived grid cells are read-only; readings are the only
  editable primitive. Users used to typing consumption into a spreadsheet cell
  must edit the underlying reading instead.
- **Deferred:** cost/price tracking, CSV/Excel import of history, per-user
  timezone (everything assumes Europe/Copenhagen), nag reminders, estimated
  readings between real ones.

### Tests

`src/server/lib/consumption.test.ts` covers interval building (ordering,
resets, negative clamp), the sequence invariant, month bucketing (1st-to-1st
exactness, partial months, three-month spans, leap February, weekly readings,
reset days, out-of-range years), year summaries (like-for-like change, null
guards), reminder due/previous/next dates (day clamping, ISO weekday 7,
disabled) and overdue logic in both modes. UI number parsing/formatting is
covered in `src/app/(protected)/consumption/_lib/format.test.ts`.

## Terms & Conditions

Reviewed per the T&C-on-feature-change rule. Meter readings are a new category
of stored household data (utility consumption, entered manually, visible to the
family). No new third-party processor is involved and the reminder reuses the
already-disclosed notification channels. §2 "Om Tjenesten / About the Service"
lists what the Service lets you record and must gain a sentence covering meter
readings. **T&C update required; a new `TERMS_VERSIONS` entry ships in the same
PR with the effective date set to the merge date.**
