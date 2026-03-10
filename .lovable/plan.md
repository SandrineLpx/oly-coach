

## Plan: AI-Powered Flexible Program Import

### Problem
Your coach's Excel programs vary in format (different column layouts, naming conventions, intensity notations like "80-85%" vs "Challenging with good form"). A fixed parser won't work across programs.

### Solution
Build an in-app program import flow that uses AI to parse any Excel/pasted program into the existing `programs` / `program_sessions` / `program_exercises` tables.

### Architecture

```text
User uploads Excel or pastes text
        ↓
Edge function receives file/text
        ↓
AI (Gemini 2.5 Flash) extracts structured program
        ↓
Returns JSON: { program, sessions[], exercises[] }
        ↓
Frontend inserts into DB via Supabase client
        ↓
Program appears in Weekly Plan view
```

### What Gets Built

**1. Edge Function: `parse-program`**
- Accepts: raw text (user pastes from Excel) or parsed spreadsheet content
- Sends to Gemini 2.5 Flash with a structured prompt describing the target schema
- Returns: `{ name, weeks, sessions: [{ week, day, type, exercises: [{ name, sets, reps, percent, notes }] }] }`
- Handles variable formats: percentage ranges, descriptive intensities, complex set/rep schemes

**2. New Page: `src/pages/ImportProgram.tsx`**
- Textarea to paste program data (copy from Excel → paste as tab-separated text)
- Optional: file upload for `.xlsx` (parsed client-side with SheetJS)
- Preview of AI-parsed program before saving
- "Save Program" button that inserts into the 3 tables
- Accessible from Settings page

**3. Store Updates: `src/lib/store.ts`**
- Add `saveProgram(parsed)` action that inserts program + sessions + exercises
- Deactivates any existing active program first

**4. Settings Link**
- Add "Import New Program" button to Settings page next to the active program card

### How It Handles Format Variability
The AI prompt will include:
- The target schema (weeks, days, exercises with sets/reps/percentage)
- Instructions to preserve original notation in `notes` when it can't be cleanly parsed (e.g., "Challenging with good form" goes into notes)
- Examples of common Olympic lifting exercise name variations

### Dependencies
- `xlsx` package for client-side Excel parsing (optional, paste-first approach works without it)
- Lovable AI (Gemini 2.5 Flash) — no API key needed

### Routing
- New route `/import-program` added to App.tsx

