# Memory: index.md
Updated: just now

# Project Memory

## Core
Train Smart: Readiness-based Olympic weightlifting. Adapts to recovery & PRs.
Tech: Zustand (local state) + Supabase (backend, RLS, Auth).
Design: Dark theme, premium coach-like mobile-first UI. NO generic fitness aesthetics.
Auth: Supabase auth. Strictly branded "Train Smart" across all views.
Olympic-weightlifting FIRST. Strava/weather/cardio/location are power-user only — gated via `usePowerUser()` (hardcoded allowlist in `src/lib/powerUser.ts`). Never re-add these to the default UX.

## Memories
- [Power-User Gating](mem://features/power-user-gating) — Hardcoded allowlist hides Strava, weather, cardio, location from standard users
- [Training Adjustments](mem://logic/training-adjustments) — Dynamic session scaling based on sleep, energy, and leg soreness
- [Programming Hierarchy](mem://logic/programming-hierarchy) — Priority order of lifts and session type definitions
- [Body Weight Tracking](mem://features/body-weight-tracking) — Tracking, trends, and history of daily body weight
- [Navigation Structure](mem://ui/navigation-structure) — Bottom nav tabs (Dashboard, Train, Weight, PRs) and settings location
- [Readiness Check-in](mem://features/readiness-check-in) — Pre-workout check-in metrics and impacts on programming
- [PR Tracking](mem://features/pr-tracking) — Management, automated detection, and progression visualization for PRs
- [Session Logging](mem://features/session-logging) — Workout data capture with sets, reps, and real-time PR detection
- [Weekly Planning](mem://features/weekly-planning) — Auto-generation of personalized schedules based on selected days
- [Structured Programming](mem://features/structured-programming) — Multi-week database-driven training programs and cycle tracking
- [Program Import](mem://features/program-import) — Importing multi-week programs using Supabase Edge Functions and Gemini
- [Rest Day Training](mem://features/rest-day-training) — Overriding rest days to train from a program or auto-generate
- [Demo Data](mem://technical/demo-data) — Seeding realistic demo data on application initialization
