import { motion } from 'framer-motion';
import { Dumbbell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SessionBadge } from '@/components/SessionBadge';
import { ProgramSession, SessionType } from '@/lib/types';
import { cn } from '@/lib/utils';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
  sessions: ProgramSession[];
  onStartSession: () => void;
}

export function ProgramWeekView({ sessions, onStartSession }: Props) {
  const todayDow = new Date().getDay();

  if (sessions.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 text-center">
        <Dumbbell className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">No sessions planned for this week.</p>
      </div>
    );
  }

  const sorted = [...sessions].sort((a, b) => a.day_of_week - b.day_of_week);

  return (
    <div className="space-y-3">
      {sorted.map((session) => {
        const isToday = session.day_of_week === todayDow;
        const type = session.session_type as SessionType;
        const exercises = session.program_exercises?.sort((a, b) => a.order_index - b.order_index) || [];

        return (
          <motion.div
            key={session.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'bg-card rounded-xl border border-border p-4',
              isToday && 'border-primary/30 bg-primary/5'
            )}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <SessionBadge type={type} size="md" showLabel />
                {session.name && (
                  <span className="text-sm font-medium">{session.name}</span>
                )}
                {isToday && (
                  <span className="px-2 py-0.5 bg-primary/10 rounded text-xs font-bold text-primary">Today</span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">{DAY_NAMES[session.day_of_week]}</span>
            </div>

            {session.notes && (
              <p className="text-sm text-muted-foreground mb-3">{session.notes}</p>
            )}

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
    </div>
  );
}
