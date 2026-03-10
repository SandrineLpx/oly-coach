

## Plan: Backend-Driven 8-Week Program System

### Overview
Create database tables to store multi-week training programs with sessions and exercises. You'll be able to insert your coach's program directly into the database, and the app will display it week-by-week instead of auto-generating plans.

### Database Schema (3 new tables)

**`programs`** — top-level program container
- `id`, `user_id`, `name` (e.g. "8-Week Oly Cycle"), `description`, `start_date`, `weeks` (number), `is_active` (boolean), `created_at`

**`program_sessions`** — each training session within the program
- `id`, `program_id` (FK), `week_number` (1-8), `day_of_week` (0-6), `session_type` (T/S/H/T2/REST), `name` (optional label), `notes`, `order_index`

**`program_exercises`** — exercises within each session
- `id`, `session_id` (FK), `name`, `sets`, `reps`, `weight`, `percent_of_max`, `notes`, `order_index`

All tables have RLS policies scoped to `user_id` (on `programs`) or joined through the parent.

### How You'd Load a Program

After the tables are created, you insert data directly via the backend:

```text
1. INSERT into programs (name, start_date, weeks, user_id, is_active)
2. INSERT into program_sessions (program_id, week_number, day_of_week, session_type, ...)
3. INSERT into program_exercises (session_id, name, sets, reps, weight, ...)
```

You can paste your Excel data as SQL INSERT statements or use the backend data editor. I'll provide a template SQL script after creating the tables.

### Frontend Changes

**`src/pages/WeeklyPlan.tsx`**
- Check if user has an active program in the database
- If yes, display the current week's sessions from the program (based on `start_date` + `week_number`)
- Keep the existing auto-generate as a fallback when no program exists
- Show week navigation (Week 1 of 8, Week 2 of 8, etc.)

**`src/lib/store.ts`**
- Add state for `activeProgram` fetched from the database
- Add `fetchActiveProgram()` action that queries the 3 tables

**`src/pages/Settings.tsx`**
- Add a "Current Program" card showing the active program name and progress

### Flow

```text
Coach Excel → You convert to SQL INSERTs → Insert via backend → App shows program
```

### What This Enables
- Full 8-week (or any length) structured programs
- Week-by-week progression with prescribed exercises, sets, reps, percentages
- Multiple programs (only one active at a time)
- Easy to swap programs by toggling `is_active`

