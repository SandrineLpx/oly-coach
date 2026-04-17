import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Phase {
  weeks: string;
  label: string;
  summary: string;
}

interface Props {
  currentWeek: number;
  totalWeeks: number;
  phaseSummary?: Phase[] | null;
  hasOverride?: boolean;
  className?: string;
}

function parseWeeks(weeks: string): [number, number] {
  const parts = weeks.split('-').map((s) => parseInt(s.trim(), 10));
  if (parts.length === 1) return [parts[0], parts[0]];
  return [parts[0], parts[1]];
}

/**
 * Compact, mobile-first weekly header for athletes.
 * Shows: current week, current phase label, short phase summary, and a
 * subtle "Modified week" indicator when a weekly_overrides row exists.
 */
export function WeekSummary({
  currentWeek,
  totalWeeks,
  phaseSummary,
  hasOverride = false,
  className,
}: Props) {
  const currentPhase = phaseSummary?.find((p) => {
    const [start, end] = parseWeeks(p.weeks);
    return currentWeek >= start && currentWeek <= end;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-4',
        hasOverride ? 'border-warning/40 bg-warning/5' : 'border-border bg-card',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Week {currentWeek}/{totalWeeks}
          </span>
          {currentPhase && (
            <span className="text-sm font-semibold text-foreground truncate">
              {currentPhase.label}
            </span>
          )}
        </div>
        {hasOverride && (
          <span className="flex items-center gap-1 text-[11px] font-medium text-warning shrink-0">
            <Sparkles className="w-3 h-3" />
            Modified week
          </span>
        )}
      </div>
      {currentPhase?.summary && (
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
          {currentPhase.summary}
        </p>
      )}
    </motion.div>
  );
}
