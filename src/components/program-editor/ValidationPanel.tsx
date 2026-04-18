import { useMemo, useState } from 'react';
import { ChevronDown, AlertTriangle, AlertCircle, Info, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Level = 'error' | 'warn' | 'info';

interface ParsedExercise {
  name: string;
  sets?: number | null;
  reps?: string | null;
  percent_of_max?: number | null;
  weight?: number | null;
  notes?: string | null;
}

interface ParsedSession {
  week_number: number;
  day_of_week: number;
  session_type: string;
  name?: string;
  exercises: ParsedExercise[];
}

interface Phase {
  weeks: string;
  label: string;
  summary: string;
}

export interface ValidationIssue {
  level: Level;
  message: string;
  weekHint?: number;
}

const PRIMARY_LIFT_PATTERNS: Array<{ key: string; re: RegExp }> = [
  { key: 'snatch', re: /\bsnatch\b/i },
  { key: 'clean', re: /\bclean\b/i },
  { key: 'jerk', re: /\bjerk\b/i },
  { key: 'squat', re: /\bsquat\b/i },
];

export function validate(
  sessions: ParsedSession[],
  phases: Phase[],
  weeks: number,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Empty weeks
  for (let w = 1; w <= weeks; w++) {
    const weekSessions = sessions.filter(s => s.week_number === w);
    if (weekSessions.length === 0) {
      issues.push({ level: 'error', message: `Week ${w} has no sessions`, weekHint: w });
    }
  }

  // Empty non-REST sessions + missing intensity
  for (const s of sessions) {
    if (s.session_type !== 'REST' && (!s.exercises || s.exercises.length === 0)) {
      issues.push({
        level: 'error',
        message: `Wk ${s.week_number} · ${s.name || 'Session'} has no exercises`,
        weekHint: s.week_number,
      });
    }
    for (const ex of s.exercises ?? []) {
      const noLoad = (ex.percent_of_max == null || ex.percent_of_max === 0) &&
                     (ex.weight == null || ex.weight === 0);
      if (s.session_type !== 'REST' && noLoad) {
        issues.push({
          level: 'warn',
          message: `Wk ${s.week_number} · ${ex.name}: missing %1RM or weight`,
          weekHint: s.week_number,
        });
      }
    }
  }

  // Phases
  if (!phases || phases.length === 0) {
    issues.push({ level: 'warn', message: 'No phase summary defined' });
  } else {
    phases.forEach((p, i) => {
      if (!p.summary || !p.summary.trim()) {
        issues.push({ level: 'warn', message: `Phase ${i + 1} (${p.label || 'unnamed'}) has no summary` });
      }
    });
  }

  // Lift coverage gap
  const week1 = sessions.filter(s => s.week_number === 1);
  for (const { key, re } of PRIMARY_LIFT_PATTERNS) {
    const inWeek1 = week1.some(s => s.exercises?.some(ex => re.test(ex.name)));
    if (!inWeek1) continue;
    for (let w = 2; w <= weeks; w++) {
      const weekHas = sessions
        .filter(s => s.week_number === w)
        .some(s => s.exercises?.some(ex => re.test(ex.name)));
      if (!weekHas) {
        issues.push({
          level: 'warn',
          message: `${key.charAt(0).toUpperCase() + key.slice(1)} appears in week 1 but not week ${w}`,
          weekHint: w,
        });
      }
    }
  }

  // Sessions/week variance
  const counts: Record<number, number> = {};
  for (let w = 1; w <= weeks; w++) {
    counts[w] = sessions.filter(s => s.week_number === w).length;
  }
  const distinct = new Set(Object.values(counts).filter(c => c > 0));
  if (distinct.size > 1) {
    const summary = Object.entries(counts).map(([w, c]) => `wk${w}=${c}`).join(', ');
    issues.push({ level: 'info', message: `Sessions/week varies (${summary})` });
  }

  return issues;
}

interface Props {
  sessions: ParsedSession[];
  phases: Phase[];
  weeks: number;
}

export default function ValidationPanel({ sessions, phases, weeks }: Props) {
  const [open, setOpen] = useState(false);
  const issues = useMemo(() => validate(sessions, phases, weeks), [sessions, phases, weeks]);

  const errors = issues.filter(i => i.level === 'error').length;
  const warns = issues.filter(i => i.level === 'warn').length;
  const infos = issues.filter(i => i.level === 'info').length;

  const allClear = issues.length === 0;

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          {allClear ? (
            <CheckCircle2 className="w-4 h-4 text-success" />
          ) : errors > 0 ? (
            <AlertCircle className="w-4 h-4 text-destructive" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-warning" />
          )}
          <span className="text-sm font-semibold">Pre-publish checks</span>
          {allClear ? (
            <Badge variant="outline" className="text-[10px] border-success/40 text-success">All clear</Badge>
          ) : (
            <div className="flex gap-1.5">
              {errors > 0 && (
                <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">
                  {errors} error{errors !== 1 ? 's' : ''}
                </Badge>
              )}
              {warns > 0 && (
                <Badge variant="outline" className="text-[10px] border-warning/40 text-warning">
                  {warns} warning{warns !== 1 ? 's' : ''}
                </Badge>
              )}
              {infos > 0 && (
                <Badge variant="outline" className="text-[10px]">{infos} info</Badge>
              )}
            </div>
          )}
        </div>
        <ChevronDown className={cn('w-4 h-4 transition-transform text-muted-foreground', open && 'rotate-180')} />
      </button>
      {open && !allClear && (
        <ul className="border-t border-border divide-y divide-border">
          {issues.map((iss, i) => (
            <li key={i} className="flex items-start gap-2 px-4 py-2 text-xs">
              {iss.level === 'error' && <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />}
              {iss.level === 'warn' && <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />}
              {iss.level === 'info' && <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />}
              <span className="text-foreground/90">{iss.message}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
