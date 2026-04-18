

## Plan: Coach editing UX (#1 inline editing, #5 validation, #8 athlete preview)

Three additions to `ProgramOverviewEditor.tsx` — applied entirely client-side, no schema changes. State already lives in `parsed.sessions`, so we'll lift it into local `sessions` state and persist edits through the existing `saveProgram` flow.

### 1. Inline exercise & session editing

Add an editable per-week sessions panel (new section "Weekly content") below "Session priority":

- Week tabs (reuse the pattern from `ImportProgram.tsx`).
- For each session in selected week:
  - Header row: editable session name, day-of-week dropdown (Mon–Sun), delete-session button, session-type dropdown (T/S/H/T2/REST).
  - Exercise rows with drag handle (use existing `@dnd-kit` if present, otherwise simple ↑/↓ buttons to keep scope tight):
    - Inputs: name, sets (number), reps (text — supports "5×3"), %1RM (number), notes.
    - Delete row button.
  - "+ Add exercise" button at bottom.
- "+ Add session" button at end of week.

State: lift `parsed.sessions` into `const [sessions, setSessions] = useState(parsed.sessions)`. Build all payloads from `sessions` instead of `parsed.sessions`. Edits use immutable updates keyed by a stable `_uid` (assigned on mount via `crypto.randomUUID()`).

Mobile-first: stack inputs vertically on `<sm`, two-column on `sm+`. All inputs `h-9` for touch.

### 2. Pre-publish validation panel

New section above the bottom action bar: `<ValidationPanel sessions={sessions} phases={phases} weeks={parsed.weeks} />`.

Checks (each emits `{level: 'error'|'warn'|'info', message, weekHint?}`):
- **error** — Week N has zero sessions.
- **error** — Session has zero exercises (and isn't REST).
- **warn** — Exercise missing both `percent_of_max` and `weight`.
- **warn** — Phase summary missing for any phase, or empty `phases`.
- **warn** — Lift coverage gap: a primary lift (Snatch/Clean/Jerk/Squat patterns matched by name regex) appears in week 1 but is absent from a later week.
- **info** — Sessions/week count varies across weeks (e.g. wk1=4, wk3=2).

Render as a collapsible card with a count badge ("3 warnings · 1 error"). "Assign to athlete" stays enabled but shows a confirm dialog if any **error** exists ("Publish anyway?"). Save draft is unaffected.

### 3. "View as athlete" toggle

Top-right toggle on the editor header: `[Coach edit | Athlete preview]` segmented control.

When in **Athlete preview**:
- Hide the three editor cards (identity / phases / priority / weekly content / validation) and the action bar.
- Render `<ProgramOverview program={previewProgram} currentWeek={1} weekOverride={null} isAthlete />` and `<ProgramWeekView ... isCoach={false} />` using a synthetic in-memory program built from current state — no DB write.
- Strip `priority`, `droppable`, `focus_label` from the synthetic sessions so they match what an athlete actually receives over the wire.
- "Back to editing" button restores the editor with state intact.

Implementation note: both `ProgramOverview` and `ProgramWeekView` already accept program-shaped props; we'll feed a constructed object that mirrors the `programs` + `program_sessions` + `program_exercises` join shape, with stable synthetic ids.

### Files touched

- **edit** `src/components/ProgramOverviewEditor.tsx` — lift sessions into state, add weekly editor section, validation panel, athlete preview toggle.
- **new** `src/components/program-editor/WeeklyContentEditor.tsx` — week tabs + session/exercise CRUD UI.
- **new** `src/components/program-editor/ValidationPanel.tsx` — pure function `validate(sessions, phases, weeks)` + collapsible UI.
- **new** `src/components/program-editor/AthletePreview.tsx` — builds synthetic program object and renders `ProgramOverview` + `ProgramWeekView`.

No DB migrations, no edge function changes, no changes to `ProgramWeekView`/`ProgramOverview`/`FlexibleWeekPlanner`/logging/PR logic.

### Out of scope (deferred)

- Drag-and-drop reordering (using ↑/↓ buttons instead — simpler, mobile-friendly). Can upgrade to `@dnd-kit` later.
- Per-exercise parser confidence highlights (#2) — needs edge function change, separate task.
- Lift progression view (#3) — separate task.

