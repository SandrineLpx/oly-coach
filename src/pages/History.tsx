import { motion } from 'framer-motion';
import { ClipboardList, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { SessionBadge } from '@/components/SessionBadge';
import { useAppStore } from '@/lib/store';
import { format, parseISO } from 'date-fns';

export default function History() {
  const { trainingLog } = useAppStore();
  const navigate = useNavigate();
  const sortedLogs = [...trainingLog].reverse();

  return (
    <div className="min-h-screen px-4 py-6 pb-24">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-2">Training History</h1>
          <p className="text-muted-foreground">{trainingLog.length} sessions logged</p>
        </div>
        <Button size="sm" variant="gold" onClick={() => navigate('/log')}>
          <Plus className="w-4 h-4" />
          Log Session
        </Button>
      </motion.div>

      {trainingLog.length === 0 ? (
        <div className="text-center py-12">
          <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No sessions logged yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedLogs.map((log, i) => (
            <motion.div key={log.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center gap-3 mb-2">
                <SessionBadge type={log.sessionType} size="sm" />
                <div className="flex-1">
                  <p className="font-medium">{format(parseISO(log.date), 'EEEE, MMM d')}</p>
                  <p className="text-xs text-muted-foreground">RPE {log.rpe} • {log.exercises.length} exercises</p>
                </div>
                {log.newPRs.length > 0 && (
                  <span className="px-2 py-1 bg-primary/10 rounded text-xs font-bold text-primary">PR!</span>
                )}
              </div>
              {log.notes && <p className="text-sm text-muted-foreground">{log.notes}</p>}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
