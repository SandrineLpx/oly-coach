

## Plan: Add Body Weight Log

### Overview
Add a body weight tracking feature that lets athletes log daily weight entries and view their weight history with a trend chart.

### Database
- Create a `body_weight_logs` table: `id (uuid)`, `user_id (uuid)`, `weight (numeric)`, `unit (text, kg/lb)`, `logged_at (date)`, `created_at (timestamptz)`
- RLS policies: users can only CRUD their own entries

### Types (`src/lib/types.ts`)
- Add `BodyWeightEntry` interface: `id`, `weight`, `unit`, `date`

### Store (`src/lib/store.ts`)
- Add `bodyWeightLog: BodyWeightEntry[]` state
- Add `logBodyWeight(entry)` and `getRecentWeights(days)` actions
- Persist to Zustand + async upsert to database

### New Page: `src/pages/BodyWeight.tsx`
- Header with current weight display
- Quick-log form: weight input + unit selector + date (defaults to today)
- Recharts line chart showing weight trend (last 30 days)
- Scrollable history list below the chart with date, weight, and delete option
- Empty state when no entries exist

### Routing & Navigation
- Add `/weight` route in `App.tsx`
- Add a "Weight" nav item to `BottomNav.tsx` (Scale icon) — or add it as a secondary link accessible from Dashboard/Settings to avoid overcrowding the bottom nav

### Dashboard Integration
- Add a small body weight card on Dashboard showing latest weight and trend arrow

### Demo Data
- Seed ~14 days of realistic weight entries in `loadDemoData()`

