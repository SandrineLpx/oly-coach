import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ProgramOverview from '@/components/ProgramOverview';
import { ProgramWeekView } from '@/components/ProgramWeekView';
import type { ProgramSession } from '@/lib/types';
import type { EditorSession } from './WeeklyContentEditor';

interface Phase {
  weeks: string;
  label: string;
  summary: string;
}

interface Props {
  name: string;
  description?: string;
  phases: Phase[];
  sessions: EditorSession[];
  weeks: number;
}

/**
 * Renders ProgramOverview + ProgramWeekView using a synthetic in-memory program
 * built from current editor state. Strips coach-only metadata (priority,
 * droppable, focus_label) to match exactly what an athlete receives.
 */
export default function AthletePreview({ name, description, phases, sessions, weeks }: Props) {
  const [previewWeek, setPreviewWeek] = useState(1);

  const weekSessions: ProgramSession[] = useMemo(() => {
    return sessions
      .filter(s => s.week_number === previewWeek)
      .map((s, idx) => ({
        id: `preview-session-${s._uid}`,
        program_id: 'preview',
        week_number: s.week_number,
        day_of_week: s.day_of_week,
        session_type: s.session_type,
        name: s.name ?? null,
        notes: s.notes ?? null,
        order_index: idx,
        program_exercises: s.exercises.map((ex, i) => ({
          id: `preview-ex-${ex._uid}`,
          session_id: `preview-session-${s._uid}`,
          name: ex.name,
          sets: ex.sets ?? null,
          reps: ex.reps ?? null,
          weight: ex.weight ?? null,
          percent_of_max: ex.percent_of_max ?? null,
          notes: ex.notes ?? null,
          order_index: i,
        })),
      }));
  }, [sessions, previewWeek]);

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
        Athlete preview · this is exactly what your athlete sees. No coach metadata is included.
      </div>

      <ProgramOverview
        name={name}
        description={description ?? null}
        phaseSummary={phases}
        currentWeek={previewWeek}
        totalWeeks={weeks}
      />

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPreviewWeek(w => Math.max(1, w - 1))}
          disabled={previewWeek === 1}
        >
          <ChevronLeft className="w-4 h-4" /> Prev week
        </Button>
        <span className="text-sm font-medium">Week {previewWeek} of {weeks}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPreviewWeek(w => Math.min(weeks, w + 1))}
          disabled={previewWeek === weeks}
        >
          Next week <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <ProgramWeekView
        sessions={weekSessions}
        onStartSession={() => {}}
        isCoach={false}
      />
    </div>
  );
}
