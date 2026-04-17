---
name: Power-user gating
description: Hardcoded allowlist hides Strava sync, weather, location, cardio prefs, and "Activity" surfaces from non-power users
type: feature
---
The app is Olympic-weightlifting first. All cross-training surfaces are gated behind `usePowerUser()` from `src/lib/powerUser.ts`, which checks the auth user id against a hardcoded `ALLOWLIST` (currently just Sandrine: `b2d4f167-0a0d-4530-85ed-60cfae605958`).

Gated surfaces (hidden completely when `!isPowerUser`):
- Onboarding `IntegrationsStep` (Strava + cardio preference) — step removed from the array, ScheduleStep finishes onboarding directly.
- Onboarding `ScheduleStep` location/geolocation card.
- Dashboard weather widget + the `fetchWeeklyForecast` network call.
- WeeklyPlan REST-day cardio rendering (filter + render branch).

How to grant power-user access: add the user's `auth.users.id` to the `ALLOWLIST` Set in `src/lib/powerUser.ts`. There is intentionally no UI toggle — keeps the OL-first experience clean for everyone else.
