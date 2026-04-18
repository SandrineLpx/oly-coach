import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Save, Send, Loader2, Layers, ListChecks, FileText, Eye, Pencil, ClipboardList } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import AssignAthleteDialog from './AssignAthleteDialog';
import WeeklyContentEditor, { type EditorSession, type EditorExercise } from './program-editor/WeeklyContentEditor';
import ValidationPanel, { validate } from './program-editor/ValidationPanel';
import AthletePreview from './program-editor/AthletePreview';

type Priority = 'primary' | 'secondary' | 'supplemental';

interface ParsedSession {
  week_number: number;
  day_of_week: number;
  session_type: string;
  name?: string;
  notes?: string;
  priority?: Priority;
  droppable?: boolean;
  focus_label?: string | null;
  exercises: any[];
}

interface ParsedProgram {
  name: string;
  description?: string;
  phase_summary?: Array<{ weeks: string; label: string; summary: string }>;
  weeks: number;
  sessions: ParsedSession[];
}

interface SessionTemplate {
  focus_label: string;
  priority: Priority;
  droppable: boolean;
}

interface Props {
  parsed: ParsedProgram;
  startDate: string;
  /** Original (pre-renumber) week numbers actually imported. null = whole program. */
  importedOriginalWeeks?: number[] | null;
  onSaved?: (programId: string, published: boolean) => void;
}

/**
 * Parses a phase week-range string ("1-6", "7", "7,8", "Weeks 1-4") into the
 * set of original-program week numbers it covers. Returns null if unparseable.
 */
function parsePhaseWeeks(weeksStr: string): number[] | null {
  if (!weeksStr) return null;
  const cleaned = weeksStr.replace(/weeks?/gi, '').trim();
  const out = new Set<number>();
  for (const part of cleaned.split(',')) {
    const range = part.trim().match(/^(\d+)\s*[-–—]\s*(\d+)$/);
    if (range) {
      const a = parseInt(range[1], 10);
      const b = parseInt(range[2], 10);
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) out.add(i);
      continue;
    }
    const single = part.trim().match(/^\d+$/);
    if (single) out.add(parseInt(single[0], 10));
  }
  return out.size ? Array.from(out).sort((a, b) => a - b) : null;
}

const PRIORITY_VARIANTS: Record<Priority, string> = {
  primary: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  supplemental: 'bg-muted text-muted-foreground',
};

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export default function ProgramOverviewEditor({ parsed, startDate, importedOriginalWeeks, onSaved }: Props) {
  const { saveProgram } = useAppStore();

  const [name, setName] = useState(parsed.name);
  const [description, setDescription] = useState(parsed.description ?? '');
  const [phases, setPhases] = useState(parsed.phase_summary ?? []);
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [confirmErrorsOpen, setConfirmErrorsOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [view, setView] = useState<'edit' | 'preview'>('edit');

  // Lift sessions into editable state with stable _uids
  const [sessions, setSessions] = useState<EditorSession[]>(() =>
    parsed.sessions.map(s => ({
      _uid: uid(),
      week_number: s.week_number,
      day_of_week: s.day_of_week,
      session_type: s.session_type,
      name: s.name,
      notes: s.notes,
      priority: (s.priority as Priority) ?? 'primary',
      droppable: s.droppable ?? false,
      focus_label: s.focus_label ?? null,
      exercises: (s.exercises ?? []).map((ex: any) => ({
        _uid: uid(),
        name: ex.name ?? '',
        sets: ex.sets ?? null,
        reps: ex.reps ?? null,
        percent_of_max: ex.percent_of_max ?? null,
        weight: ex.weight ?? null,
        notes: ex.notes ?? null,
      } as EditorExercise)),
    })),
  );

  // Build unique session templates by focus_label (or name) — driven by current sessions
  const templates = useMemo<SessionTemplate[]>(() => {
    const map = new Map<string, SessionTemplate>();
    for (const s of sessions) {
      const key = (s.focus_label || s.name || `Day ${s.day_of_week}`).trim();
      if (!map.has(key)) {
        map.set(key, {
          focus_label: key,
          priority: (s.priority as Priority) ?? 'primary',
          droppable: s.droppable ?? false,
        });
      }
    }
    return Array.from(map.values());
  }, [sessions]);

  const sessionsPerWeek = useMemo(() => {
    const week1 = sessions.filter(s => s.week_number === 1);
    return week1.length || Math.round(sessions.length / Math.max(parsed.weeks, 1));
  }, [sessions, parsed.weeks]);

  const updatePhase = (i: number, patch: Partial<{ label: string; summary: string }>) => {
    setPhases(prev => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  };

  const updateTemplate = (idx: number, patch: Partial<SessionTemplate>) => {
    const tpl = templates[idx];
    if (!tpl) return;
    setSessions(prev =>
      prev.map(s => {
        const key = (s.focus_label || s.name || `Day ${s.day_of_week}`).trim();
        if (key !== tpl.focus_label) return s;
        const next = { ...s, ...patch };
        if (patch.priority) {
          next.droppable = patch.priority === 'supplemental';
        }
        return next;
      }),
    );
  };

  const buildPayload = (): ParsedProgram => ({
    ...parsed,
    name: name.trim() || parsed.name,
    description: description.trim() || undefined,
    phase_summary: phases,
    sessions: sessions.map(s => ({
      week_number: s.week_number,
      day_of_week: s.day_of_week,
      session_type: s.session_type,
      name: s.name,
      notes: s.notes,
      priority: s.priority,
      droppable: s.droppable,
      focus_label: s.focus_label ?? undefined,
      exercises: s.exercises.map(({ _uid, ...rest }) => rest),
    })),
  });

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      const id = await saveProgram(buildPayload(), startDate, { published: false });
      toast.success('Draft saved');
      onSaved?.(id, false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to save draft');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleAssignClick = () => {
    const issues = validate(sessions, phases, parsed.weeks);
    if (issues.some(i => i.level === 'error')) {
      setConfirmErrorsOpen(true);
      return;
    }
    setPublishOpen(true);
  };

  const handleAssign = async (athleteId: string, assignmentStartDate: string) => {
    setPublishing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const id = await saveProgram(buildPayload(), startDate, { published: true });

      const { error: assignErr } = await supabase.from('program_assignments').insert({
        program_id: id,
        athlete_id: athleteId,
        assigned_by: user.id,
        start_date: assignmentStartDate,
      });
      if (assignErr) throw assignErr;

      toast.success('Program published & assigned');
      onSaved?.(id, true);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to assign');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      {/* View toggle */}
      <div className="flex gap-1 p-1 rounded-lg bg-muted">
        <button
          type="button"
          onClick={() => setView('edit')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
            view === 'edit' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
          }`}
        >
          <Pencil className="w-3.5 h-3.5" /> Coach edit
        </button>
        <button
          type="button"
          onClick={() => setView('preview')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
            view === 'preview' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
          }`}
        >
          <Eye className="w-3.5 h-3.5" /> Athlete preview
        </button>
      </div>

      {view === 'preview' ? (
        <AthletePreview
          name={name.trim() || parsed.name}
          description={description.trim() || undefined}
          phases={phases}
          sessions={sessions}
          weeks={parsed.weeks}
        />
      ) : (
        <>
          {/* Section 1: Program identity */}
          <Card className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <FileText className="w-3.5 h-3.5" /> Program identity
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prog-name">Program name</Label>
              <Input id="prog-name" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prog-desc">Description</Label>
              <Textarea
                id="prog-desc"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="3-5 sentence overview shown to the athlete…"
                className="min-h-[120px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-muted/50 rounded-lg px-3 py-2">
                <div className="text-xs text-muted-foreground">Total weeks</div>
                <div className="font-semibold">{parsed.weeks}</div>
              </div>
              <div className="bg-muted/50 rounded-lg px-3 py-2">
                <div className="text-xs text-muted-foreground">Sessions / week</div>
                <div className="font-semibold">{sessionsPerWeek}</div>
              </div>
            </div>
          </Card>

          {/* Section 2: Phase breakdown */}
          {phases.length > 0 && (
            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Layers className="w-3.5 h-3.5" /> Phase breakdown
              </div>
              {importedOriginalWeeks && importedOriginalWeeks.length > 0 && (
                <p className="text-xs text-muted-foreground -mt-1">
                  Dimmed phases fall outside the imported weeks ({importedOriginalWeeks[0]}–
                  {importedOriginalWeeks[importedOriginalWeeks.length - 1]}).
                </p>
              )}
              {phases.map((phase, i) => {
                const phaseWeeks = parsePhaseWeeks(phase.weeks);
                const importedSet = importedOriginalWeeks ? new Set(importedOriginalWeeks) : null;
                const inRange =
                  !importedSet || !phaseWeeks
                    ? true
                    : phaseWeeks.some(w => importedSet.has(w));
                return (
                  <div
                    key={i}
                    className={`rounded-lg border border-border p-3 space-y-2 transition-opacity ${
                      inRange ? '' : 'opacity-40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">Wk {phase.weeks}</Badge>
                      {!inRange && (
                        <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                          Out of range
                        </Badge>
                      )}
                      <Input
                        value={phase.label}
                        onChange={e => updatePhase(i, { label: e.target.value })}
                        className="h-8 font-semibold"
                      />
                    </div>
                    <Textarea
                      value={phase.summary}
                      onChange={e => updatePhase(i, { summary: e.target.value })}
                      className="min-h-[70px] text-sm"
                    />
                  </div>
                );
              })}
            </Card>
          )}

          {/* Section 3: Session priority review */}
          {templates.length > 0 && (
            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <ListChecks className="w-3.5 h-3.5" /> Session priority
              </div>
              <p className="text-xs text-muted-foreground -mt-1">
                Changes apply to every week of this program.
              </p>
              {templates.map((tpl, i) => (
                <div key={tpl.focus_label} className="rounded-lg border border-border p-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm flex-1 min-w-0 truncate">{tpl.focus_label}</span>
                    <Badge className={PRIORITY_VARIANTS[tpl.priority]}>{tpl.priority}</Badge>
                  </div>

                  <div className="flex gap-1.5">
                    {(['primary', 'secondary', 'supplemental'] as Priority[]).map(p => (
                      <button
                        key={p}
                        onClick={() => updateTemplate(i, { priority: p })}
                        className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                          tpl.priority === p
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:border-primary/40'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <Label htmlFor={`drop-${i}`} className="text-xs text-muted-foreground">
                      Droppable
                    </Label>
                    <Switch
                      id={`drop-${i}`}
                      checked={tpl.droppable}
                      onCheckedChange={v => updateTemplate(i, { droppable: v })}
                    />
                  </div>
                </div>
              ))}
            </Card>
          )}

          {/* Section 4: Weekly content editor */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <ClipboardList className="w-3.5 h-3.5" /> Weekly content
            </div>
            <p className="text-xs text-muted-foreground -mt-1">
              Edit sessions and exercises for each week.
            </p>
            <WeeklyContentEditor
              sessions={sessions}
              weeks={parsed.weeks}
              onChange={setSessions}
            />
          </Card>

          {/* Section 5: Validation */}
          <ValidationPanel sessions={sessions} phases={phases} weeks={parsed.weeks} />

          {/* Bottom actions */}
          <div className="flex gap-2 sticky bottom-4">
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={savingDraft || publishing}
              className="flex-1"
            >
              {savingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save draft
            </Button>
            <Button
              onClick={handleAssignClick}
              disabled={savingDraft || publishing}
              className="flex-1"
            >
              {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Assign to athlete
            </Button>
          </div>
        </>
      )}

      <AssignAthleteDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        onConfirm={handleAssign}
      />

      <AlertDialog open={confirmErrorsOpen} onOpenChange={setConfirmErrorsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish with errors?</AlertDialogTitle>
            <AlertDialogDescription>
              The pre-publish checks found errors in this program (e.g. empty weeks or sessions
              with no exercises). You can publish anyway, but the athlete may see incomplete weeks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back & fix</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmErrorsOpen(false);
                setPublishOpen(true);
              }}
            >
              Publish anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
