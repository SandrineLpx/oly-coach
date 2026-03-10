

## Plan: Add Date Picker to Log Session

### Problem
The Log Session page always uses today's date. There's no way to log past sessions.

### Changes

**`src/pages/LogSession.tsx`**
- Add a date state initialized to today: `const [sessionDate, setSessionDate] = useState(new Date())`
- Add a date selector UI (tappable date display that opens a `Popover` with the existing `Calendar` component from `src/components/ui/calendar.tsx`)
- Use the selected date in `handleSubmit` instead of `new Date()`
- Restrict future dates (max date = today)

This is a small, self-contained change — just adding a date field to the existing form.

