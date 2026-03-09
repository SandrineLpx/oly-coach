import { motion } from 'framer-motion';
import { Trophy, Plus } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { format, parseISO } from 'date-fns';

export default function PRs() {
  const { prs, preferences } = useAppStore();
  const sortedPRs = [...prs].sort((a, b) => b.weight - a.weight);

  return (
    <div className="min-h-screen px-4 py-6 pb-24">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Personal Records</h1>
        <p className="text-muted-foreground">{prs.length} lifts tracked</p>
      </motion.div>

      {prs.length === 0 ? (
        <div className="text-center py-12">
          <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No PRs logged yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedPRs.map((pr, i) => (
            <motion.div key={pr.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card rounded-xl p-4 border border-border flex items-center justify-between">
              <div>
                <p className="font-semibold">{pr.liftName}</p>
                <p className="text-xs text-muted-foreground">{format(parseISO(pr.date), 'MMM d, yyyy')}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">{pr.weight}</p>
                <p className="text-xs text-muted-foreground">{pr.unit}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
