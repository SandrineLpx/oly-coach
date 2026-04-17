import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Dumbbell, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SessionBadge } from '@/components/SessionBadge';
import { ProgramSession, SessionType } from '@/lib/types';
import { cn } from '@/lib/utils';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
  rescued_exercises: Array<{
    name: string;
    sets: number;
    reps: string;
    absorb_into_session_id: string;
  }>;
}

export interface WeekOverride {
  session_assignments: ScheduleSlot[] | null;
  dropped_sessions: DroppedSession[] | null;
}

interface Props {
  sessions: ProgramSession[];
  onStartSession: () => void;
  // Coach-only flexible-week features (optional for backward-compat)
  isCoach?: boolean;
  override?: WeekOverride | null;
  onOpenFlexible?: () => void;
}

export function ProgramWeekView({
  sessions,
  onStartSession,
  isCoach = false,
  override = null,
  onOpenFlexible,
}: Props) {
  const todayDow = new Date().getDay();
  const hasOverride = !!override?.session_assignments?.length;

  // Build the effective ordered list of sessions to display.
  // - When override exists: use override schedule order (by day), look up session details by id, exclude dropped.
  // - Otherwise: base program sessions ordered by day_of_week.
  const orderedSessions = useMemo(() => {
    if (!hasOverride) {
      return [...sessions].sort((a, b) => a.day_of_week - b.day_of_week)
        .map((s) => ({ session: s, displayDay: s.day_of_week }));
    }
    const byId = new Map(sessions.map((s) => [s.id, s]));
    return (override!.session_assignments || [])
      .slice()
      .sort((a, b) => a.day - b.day)
      .map((slot) => {
        const s = byId.get(slot.session_id);
        return s ? { session: s, displayDay: slot.day } : null;
      })
      .filter(Boolean) as Array<{ session: ProgramSession; displayDay: number }>;
  }, [sessions, override, hasOverride]);

  if (sessions.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 text-center">
        <Dumbbell className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">No sessions planned for this week.</p>
        {isCoach && onOpenFlexible && (
          <Button size="sm" variant="outline" onClick={onOpenFlexible} className="mt-4">
            <Sparkles className="w-4 h-4" /> Flexible week
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {(isCoach || hasOverride) && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {hasOverride && (
              <Badge variant="outline" className="bg-warning/15 text-warning border-warning/40 text-[10px]">
                MODIFIED
              </Badge>
            )}
            {hasOverride && override?.dropped_sessions && override.dropped_sessions.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {override.dropped_sessions.length} dropped
              </span>
            )}
          </div>
          {isCoach && onOpenFlexible && (
            <Button size="sm" variant="outline" onClick={onOpenFlexible}>
              <Sparkles className="w-3.5 h-3.5" /> Flexible week
            </Button>
          )}
        </div>
      )}

      {orderedSessions.map(({ session, displayDay }) => {
        const isToday = displayDay === todayDow;
        const type = session.session_type as SessionType;
        const exercises = session.program_exercises?.sort((a, b) => a.order_index - b.order_index) || [];

        return (
          <motion.div
            key={session.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'bg-card rounded-xl border border-border p-4',
              isToday && 'border-primary/30 bg-primary/5',
            )}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <SessionBadge type={type} size="md" showLabel />
                {session.name && <span className="text-sm font-medium">{session.name}</span>}
                {isToday && (
                  <span className="px-2 py-0.5 bg-primary/10 rounded text-xs font-bold text-primary">Today</span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">{DAY_NAMES[displayDay]}</span>
            </div>

            {session.notes && <p className="text-sm text-muted-foreground mb-3">{session.notes}</p>}

            {exercises.length > 0 && (
              <div className="space-y-1">
                {exercises.map((ex) => (
                  <div key={ex.id} className="flex items-center justify-between text-sm">
                    <span>{ex.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {ex.sets && ex.reps && `${ex.sets}x${ex.reps}`}
                      {ex.percent_of_max && ` @ ${ex.percent_of_max}%`}
                      {ex.weight && !ex.percent_of_max && ` ${ex.weight}kg`}
                      {ex.notes && ` · ${ex.notes}`}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {isToday && (
              <Button onClick={onStartSession} variant="gold" size="sm" className="w-full mt-4">
                Start Today's Session
              </Button>
            )}
          </motion.div>
        );
      })}

      {hasOverride && override?.dropped_sessions && override.dropped_sessions.length > 0 && (
        <div className="bg-muted/30 border border-dashed border-border rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            Dropped this week
          </p>
          <div className="space-y-1.5">
            {override.dropped_sessions.map((d) => (
              <div key={d.session_id} className="text-xs">
                <span className="font-medium text-muted-foreground">{d.focus_label}</span>
                {d.rescued_exercises.length > 0 && (
                  <span className="text-muted-foreground/70">
                    {' '}
                    — rescued: {d.rescued_exercises.map((r) => r.name).join(', ')}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
