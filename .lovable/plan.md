

## Plan: PR Management in Settings

### Overview
Enhance the PRs page with full CRUD capabilities: add new lifts, edit existing PRs, and delete PRs. Also add a link from Settings to manage PRs.

### Changes

**`src/lib/store.ts`**
- Add `deletePR(id: string)` action to remove a PR from state

**`src/pages/PRs.tsx`** (major rework)
- Add a "+" button in the header to add a new PR via a dialog/sheet
- Add dialog form with fields: lift name, weight, unit (from preferences), date
- Make each PR card tappable to open an edit dialog (pre-filled with current values)
- Add a delete button (trash icon) on each PR card or inside the edit dialog
- Use existing `addPR`, `updatePR`, `deletePR` store actions

**`src/pages/Settings.tsx`**
- Add a "Manage PRs" card that navigates to `/prs`
- Add sign-out button (bonus, since it's missing)

### UI Pattern
- Use a `Dialog` component for add/edit PR forms
- Form fields: lift name (text input), weight (number input), unit toggle (kg/lb), date picker or text input
- Delete confirmation via `AlertDialog`

