import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface Phase {
  weeks: string;
  label: string;
  summary: string;
}

interface Props {
  name: string;
  description?: string | null;
  phaseSummary?: Phase[] | null;
  currentWeek?: number | null;
}

/** Parses "1-4" or "3" -> [start, end] */
function parseWeeks(weeks: string): [number, number] {
  const parts = weeks.split('-').map(s => parseInt(s.trim(), 10));
  if (parts.length === 1) return [parts[0], parts[0]];
  return [parts[0], parts[1]];
}

export default function ProgramOverview({ name, description, phaseSummary, currentWeek }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{name}</h2>
        {description && (
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{description}</p>
        )}
      </div>

      {phaseSummary && phaseSummary.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phases</h3>
          {phaseSummary.map((phase, i) => {
            const [start, end] = parseWeeks(phase.weeks);
            const isCurrent =
              currentWeek != null && currentWeek >= start && currentWeek <= end;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card
                  className={`p-4 transition-colors ${
                    isCurrent ? 'border-primary bg-primary/5 shadow-gold' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <h4 className="font-semibold text-base">{phase.label}</h4>
                    {isCurrent && (
                      <span className="flex items-center gap-1 text-xs font-medium text-primary shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Current
                      </span>
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
