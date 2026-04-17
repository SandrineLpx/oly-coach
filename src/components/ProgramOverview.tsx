import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ChevronDown, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Phase {
  weeks: string;
  label: string;
  summary: string;
}

interface RescuedExercise {
  name: string;
  sets: number;
  reps: string;
  absorb_into_session_id: string;
}

interface DroppedSession {
  session_id: string;
  focus_label: string;
  reason: string;
  rescued_exercises: RescuedExercise[];
}

interface Props {
  name: string;
  description?: string | null;
  phaseSummary?: Phase[] | null;
  currentWeek?: number | null;
  totalWeeks?: number | null;
  /** Athlete-facing: dropped sessions for the current week (from weekly_overrides) */
  droppedThisWeek?: DroppedSession[] | null;
}

/** Parses "1-4" or "3" -> [start, end] */
function parseWeeks(weeks: string): [number, number] {
  const parts = weeks.split('-').map((s) => parseInt(s.trim(), 10));
  if (parts.length === 1) return [parts[0], parts[0]];
  return [parts[0], parts[1]];
}

export default function ProgramOverview({
  name,
  description,
  phaseSummary,
  currentWeek,
  totalWeeks,
  droppedThisWeek,
}: Props) {
  const [expandedDrop, setExpandedDrop] = useState<string | null>(null);

  const hasDrops = !!droppedThisWeek && droppedThisWeek.length > 0;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{name}</h2>
        {description && (
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{description}</p>
        )}
      </div>

      {/* Weekly drop notification banner — athlete-facing, plain language */}
      {hasDrops && (
        <div className="space-y-2">
          {droppedThisWeek!.map((drop) => {
            const isOpen = expandedDrop === drop.session_id;
            return (
              <motion.div
                key={drop.session_id}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-warning/40 bg-warning/10 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpandedDrop(isOpen ? null : drop.session_id)}
                  className="w-full text-left px-4 py-3 flex items-start gap-3"
                >
                  <Sparkles className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug">
                      <span className="font-medium text-foreground">Your coach adjusted this week</span>{' '}
                      <span className="text-muted-foreground">
                        — {drop.focus_label} has been removed.
                      </span>
                    </p>
                  </div>
                  <ChevronDown
                    className={cn(
                      'w-4 h-4 text-muted-foreground shrink-0 mt-0.5 transition-transform',
                      isOpen && 'rotate-180',
                    )}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-0 space-y-3 border-t border-warning/20">
                        {drop.reason && (
                          <p className="text-xs text-muted-foreground leading-relaxed pt-3">
                            {drop.reason}
                          </p>
                        )}
                        {drop.rescued_exercises && drop.rescued_exercises.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-2">
                              These exercises were moved into your other sessions:
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {drop.rescued_exercises.map((rx, i) => (
                                <span
                                  key={i}
                                  className="text-[11px] px-2 py-1 rounded-full bg-background/60 border border-warning/30 text-foreground"
                                >
                                  {rx.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {phaseSummary && phaseSummary.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Phases
            </h3>
            {currentWeek != null && totalWeeks != null && (
              <span className="text-[11px] text-muted-foreground">
                Week {currentWeek} of {totalWeeks}
              </span>
            )}
          </div>

          {/* Phase progress bar */}
          {currentWeek != null && totalWeeks != null && (
            <div className="flex gap-1 h-1.5" role="progressbar" aria-valuenow={currentWeek} aria-valuemax={totalWeeks}>
              {phaseSummary.map((phase, i) => {
                const [start, end] = parseWeeks(phase.weeks);
                const span = Math.max(1, end - start + 1);
                const isCompleted = currentWeek > end;
                const isCurrent = currentWeek >= start && currentWeek <= end;
                // Within-phase fill for the current phase
                const fillPct = isCurrent ? ((currentWeek - start + 1) / span) * 100 : 0;
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-full overflow-hidden bg-muted"
                    style={{ flexGrow: span }}
                  >
                    {isCompleted && <div className="h-full w-full bg-primary/40" />}
                    {isCurrent && (
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${fillPct}%` }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {phaseSummary.map((phase, i) => {
            const [start, end] = parseWeeks(phase.weeks);
            const isCurrent = currentWeek != null && currentWeek >= start && currentWeek <= end;
            const isCompleted = currentWeek != null && currentWeek > end;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card
                  className={cn(
                    'p-4 transition-colors',
                    isCurrent && 'border-primary bg-primary/5 shadow-gold',
                    isCompleted && !isCurrent && 'opacity-60',
                  )}
                >
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <h4 className="font-semibold text-base">{phase.label}</h4>
                    {isCurrent && currentWeek != null && (
                      <span className="flex items-center gap-1 text-xs font-medium text-primary shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Week {currentWeek - start + 1} of {end - start + 1}
                      </span>
                    )}
                    {isCompleted && !isCurrent && (
                      <span className="text-[11px] text-muted-foreground shrink-0">Completed</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{phase.summary}</p>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
