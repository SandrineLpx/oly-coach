import { useEffect, useMemo, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Sparkles, AlertTriangle, RotateCcw, Save, X, ArrowRightLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun

interface SessionRow {
  id: string;
  day_of_week: number;
  session_type: string;
  name: string | null;
  focus_label: string | null;
  priority: string | null;
  droppable: boolean | null;
  program_exercises?: Array<{
    name: string;
    sets: number | null;
    reps: string | null;
    percent_of_max: number | null;
    order_index: number;
  }>;
}

interface RescuedExercise {
  name: string;
  sets: number;
  reps: string;
  absorb_into_session_id: string;
}

interface ScheduleSlot {
  day: number;
  session_id: string;
  focus_label: string;
  notes: string;
}

interface DroppedSession {
  session_id: string;
  focus_label: string;
  reason: string;
  rescued_exercises: RescuedExercise[];
}

interface OverrideRow {
  id: string;
  available_days: string[] | null;
  session_assignments: any;
  dropped_sessions: any;
}

interface AthleteOption {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programId: string;
  weekNumber: number;
  sessions: SessionRow[];
  initialAthleteId: string;
  onSaved?: () => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  primary: 'bg-primary/15 text-primary border-primary/30',
  secondary: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  supplemental: 'bg-muted text-muted-foreground border-border',
};

export function FlexibleWeekPlanner({
  open,
  onOpenChange,
  programId,
  weekNumber,
  sessions,
  initialAthleteId,
  onSaved,
}: Props) {
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [athleteId, setAthleteId] = useState(initialAthleteId);
  const [availableDays, setAvailableDays] = useState<number[]>([]);
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([]);
  const [dropped, setDropped] = useState<DroppedSession[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingOverrideId, setExistingOverrideId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Load athlete list (assigned to this program)
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: assigns } = await supabase
        .from('program_assignments')
        .select('athlete_id')
        .eq('program_id', programId)
        .eq('is_active', true);
      const ids = (assigns || []).map((a) => a.athlete_id);
      if (ids.length === 0) {
        setAthletes([]);
        return;
      }
      const { data: profs } = await supabase
        .from('athlete_profiles')
        .select('user_id, name')
        .in('user_id', ids);
      setAthletes((profs || []).map((p) => ({ id: p.user_id, name: p.name })));
    })();
  }, [open, programId]);

  // Load existing override for this athlete + week
  useEffect(() => {
    if (!open || !athleteId) return;
    (async () => {
      const { data } = await supabase
        .from('weekly_overrides')
        .select('id, available_days, session_assignments, dropped_sessions')
        .eq('program_id', programId)
        .eq('athlete_id', athleteId)
        .eq('week_number', weekNumber)
        .maybeSingle();

      if (data) {
        setExistingOverrideId(data.id);
        const days = (data.available_days || []).map((d) => parseInt(d, 10)).filter((n) => !isNaN(n));
        setAvailableDays(days.length > 0 ? days : sessions.map((s) => s.day_of_week));
        setSchedule((data.session_assignments as ScheduleSlot[]) || []);
        setDropped((data.dropped_sessions as DroppedSession[]) || []);
      } else {
        setExistingOverrideId(null);
        // Default: every day a session is currently scheduled on
        const defaultDays = Array.from(new Set(sessions.map((s) => s.day_of_week))).sort();
        setAvailableDays(defaultDays);
        setSchedule(
          sessions.map((s) => ({
            day: s.day_of_week,
            session_id: s.id,
            focus_label: s.focus_label || s.name || s.session_type,
            notes: '',
          })),
        );
        setDropped([]);
      }
      setHasChanges(false);
    })();
  }, [open, athleteId, programId, weekNumber, sessions]);

  const sessionCount = sessions.length;
  const needsDrop = availableDays.length < sessionCount;

  const sessionById = useMemo(() => {
    const m = new Map<string, SessionRow>();
    sessions.forEach((s) => m.set(s.id, s));
    return m;
  }, [sessions]);

  const toggleDay = (day: number) => {
    setHasChanges(true);
    setAvailableDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  };

  const requestAiSuggestion = async () => {
    setLoadingAi(true);
    try {
      const payload = {
        sessions: sessions.map((s) => ({
          id: s.id,
          day_of_week: s.day_of_week,
          session_type: s.session_type,
          focus_label: s.focus_label,
          name: s.name,
          priority: s.priority,
          droppable: s.droppable,
          exercises: (s.program_exercises || [])
            .sort((a, b) => a.order_index - b.order_index)
            .map((e) => ({
              name: e.name,
              sets: e.sets,
              reps: e.reps,
              percent_of_max: e.percent_of_max,
            })),
        })),
        available_days: availableDays,
      };

      const { data, error } = await supabase.functions.invoke('suggest-week-schedule', {
        body: payload,
      });

      if (error) {
        const msg = error.message || 'AI suggestion failed';
        if (msg.includes('429')) toast.error('Too many requests. Try again in a moment.');
        else if (msg.includes('402')) toast.error('AI credits exhausted. Add funds in Settings.');
        else toast.error(msg);
        return;
      }
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setSchedule(data.schedule || []);
      setDropped(data.dropped || []);
      setHasChanges(true);
      toast.success('AI suggestion ready');
    } catch (e) {
      console.error(e);
      toast.error((e as Error).message);
    } finally {
      setLoadingAi(false);
    }
  };

  // Auto-trigger AI when days drop below session count and no schedule yet computed for this state
  useEffect(() => {
    if (!open || !needsDrop || loadingAi) return;
    // Only auto-trigger if dropped is empty AND user just toggled days (hasChanges)
    if (hasChanges && dropped.length === 0 && availableDays.length > 0) {
      requestAiSuggestion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableDays]);

  const overrideDroppedSession = (currentDroppedId: string, replaceWithSessionId: string) => {
    // Coach manually picks a different session to drop instead.
    setHasChanges(true);
    const replaceWith = sessions.find((s) => s.id === replaceWithSessionId);
    const currentDropped = dropped.find((d) => d.session_id === currentDroppedId);
    if (!replaceWith || !currentDropped) return;

    // Swap: re-add currentDropped to schedule (on the day replaceWith was on),
    // remove replaceWith from schedule, add it to dropped.
    const replaceSlot = schedule.find((s) => s.session_id === replaceWithSessionId);
    if (!replaceSlot) return;

    setSchedule((prev) =>
      prev.map((s) =>
        s.session_id === replaceWithSessionId
          ? {
              ...s,
              session_id: currentDroppedId,
              focus_label: currentDropped.focus_label,
            }
          : s,
      ),
    );

    setDropped((prev) => [
      ...prev.filter((d) => d.session_id !== currentDroppedId),
      {
        session_id: replaceWithSessionId,
        focus_label: replaceWith.focus_label || replaceWith.name || replaceWith.session_type,
        reason: 'Manually chosen by coach',
        rescued_exercises: [],
      },
    ]);
  };

  const reassignSlotDay = (sessionId: string, newDay: number) => {
    setHasChanges(true);
    setSchedule((prev) => prev.map((s) => (s.session_id === sessionId ? { ...s, day: newDay } : s)));
  };

  const handleSave = async () => {
    if (!athleteId) {
      toast.error('Pick an athlete first');
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('weekly_overrides')
        .upsert(
          {
            program_id: programId,
            athlete_id: athleteId,
            week_number: weekNumber,
            available_days: availableDays.map(String),
            session_assignments: schedule as any,
            dropped_sessions: dropped as any,
            created_by: user?.id ?? null,
          },
          { onConflict: 'program_id,athlete_id,week_number' },
        );
      if (error) throw error;
      toast.success(`Week ${weekNumber} saved for ${athletes.find((a) => a.id === athleteId)?.name ?? 'athlete'}`);
      setHasChanges(false);
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!existingOverrideId) {
      toast.info('No override to reset.');
      return;
    }
    if (!confirm('Revert this week to the base program? This cannot be undone.')) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('weekly_overrides')
        .delete()
        .eq('id', existingOverrideId);
      if (error) throw error;
      toast.success('Reverted to base program');
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92vh] overflow-y-auto px-4 sm:max-w-2xl sm:mx-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Flexible week — Week {weekNumber}
          </SheetTitle>
          <SheetDescription>
            Reshape this week for an athlete: pick available days, drop sessions, rescue key lifts.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-4 pb-32">
          {/* Athlete picker */}
          {athletes.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Athlete
              </label>
              <Select value={athleteId} onValueChange={setAthleteId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {athletes.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Section 1: Day availability */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Available days</h3>
              <span className="text-xs text-muted-foreground">
                {Math.min(availableDays.length, sessionCount)} of {sessionCount} sessions
              </span>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {DAY_ORDER.map((day) => {
                const active = availableDays.includes(day);
                return (
                  <button
                    key={day}
                    onClick={() => toggleDay(day)}
                    className={cn(
                      'aspect-square rounded-lg border-2 text-xs font-medium transition-all',
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card text-muted-foreground',
                    )}
                  >
                    {DAY_NAMES[day]}
                  </button>
                );
              })}
            </div>
            {needsDrop && (
              <div className="mt-3 flex items-start gap-2 bg-warning/10 border border-warning/30 rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <p className="text-xs text-foreground">
                  {sessionCount - availableDays.length} fewer days than sessions — at least one session
                  must be dropped or merged.
                </p>
              </div>
            )}
          </section>

          {/* Section 2: AI suggestion / drops */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">AI suggestion</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={requestAiSuggestion}
                disabled={loadingAi || availableDays.length === 0}
              >
                {loadingAi ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {dropped.length > 0 || schedule.length > 0 ? 'Regenerate' : 'Suggest'}
              </Button>
            </div>

            {dropped.length === 0 && !loadingAi && (
              <p className="text-xs text-muted-foreground">
                {needsDrop
                  ? 'Auto-suggesting based on your day selection…'
                  : 'No drops needed. Schedule looks good.'}
              </p>
            )}

            {loadingAi && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                <Loader2 className="w-4 h-4 animate-spin" />
                Asking the coach…
              </div>
            )}

            <div className="space-y-2">
              {dropped.map((d) => {
                const otherDroppable = sessions.filter(
                  (s) => s.id !== d.session_id && s.priority !== 'primary',
                );
                return (
                  <div
                    key={d.session_id}
                    className="bg-warning/10 border border-warning/30 rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-warning/20 border-warning/40 text-warning text-[10px]">
                            DROPPED
                          </Badge>
                          <span className="text-sm font-semibold">{d.focus_label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{d.reason}</p>
                      </div>
                      {otherDroppable.length > 0 && (
                        <Select
                          onValueChange={(v) => overrideDroppedSession(d.session_id, v)}
                        >
                          <SelectTrigger className="w-auto h-7 text-xs gap-1 px-2">
                            <ArrowRightLeft className="w-3 h-3" />
                            <span>Override</span>
                          </SelectTrigger>
                          <SelectContent>
                            {otherDroppable.map((s) => (
                              <SelectItem key={s.id} value={s.id} className="text-xs">
                                Drop {s.focus_label || s.name || s.session_type} instead
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    {d.rescued_exercises.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          Rescued into other sessions
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {d.rescued_exercises.map((rx, i) => {
                            const target = sessionById.get(rx.absorb_into_session_id);
                            return (
                              <span
                                key={i}
                                className="text-[11px] bg-background border border-border rounded px-2 py-1"
                              >
                                <span className="font-medium">{rx.name}</span>{' '}
                                <span className="text-muted-foreground">
                                  {rx.sets}×{rx.reps} → {target?.focus_label || target?.name || '?'}
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Section 3: Day assignment */}
          <section>
            <h3 className="text-sm font-semibold mb-2">Schedule</h3>
            <div className="space-y-2">
              {schedule.length === 0 ? (
                <p className="text-xs text-muted-foreground">No sessions scheduled yet.</p>
              ) : (
                [...schedule]
                  .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day))
                  .map((slot) => {
                    const s = sessionById.get(slot.session_id);
                    const priority = s?.priority || 'primary';
                    return (
                      <div
                        key={slot.session_id}
                        className="bg-card border border-border rounded-lg p-3 flex items-center gap-3"
                      >
                        <Select
                          value={String(slot.day)}
                          onValueChange={(v) => reassignSlotDay(slot.session_id, parseInt(v, 10))}
                        >
                          <SelectTrigger className="w-20 h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {availableDays.map((d) => (
                              <SelectItem key={d} value={String(d)} className="text-xs">
                                {DAY_NAMES[d]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={cn('text-[10px] uppercase', PRIORITY_COLORS[priority])}
                            >
                              {priority}
                            </Badge>
                            <span className="text-sm font-medium truncate">{slot.focus_label}</span>
                          </div>
                          {slot.notes && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{slot.notes}</p>
                          )}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </section>

          {!hasChanges && existingOverrideId && (
            <p className="text-xs text-center text-muted-foreground italic">
              Showing saved override — no unsaved changes
            </p>
          )}
        </div>

        {/* Bottom action bar */}
        <div className="fixed bottom-0 left-0 right-0 sm:left-auto sm:right-auto sm:max-w-2xl sm:mx-auto bg-background border-t border-border p-3 flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="flex-shrink-0"
          >
            <X className="w-4 h-4" /> Cancel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={saving || !existingOverrideId}
            className="flex-shrink-0"
          >
            <RotateCcw className="w-4 h-4" /> Reset
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="flex-1"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save this week
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
