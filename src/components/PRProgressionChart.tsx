import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, ChevronDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAppStore } from '@/lib/store';

interface PRHistoryEntry {
  id: string;
  lift_name: string;
  weight: number;
  unit: string;
  achieved_at: string;
}

export default function PRProgressionChart() {
  const { prs } = useAppStore();
  const [history, setHistory] = useState<PRHistoryEntry[]>([]);
  const [selectedLift, setSelectedLift] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Get unique lift names from both PRs and history
  const liftNames = useMemo(() => {
    const names = new Set<string>();
    prs.forEach(pr => names.add(pr.liftName));
    history.forEach(h => names.add(h.lift_name));
    return Array.from(names).sort();
  }, [prs, history]);

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    if (!selectedLift && liftNames.length > 0) {
      setSelectedLift(liftNames[0]);
    }
  }, [liftNames, selectedLift]);

  const fetchHistory = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from('pr_history')
      .select('*')
      .eq('user_id', user.id)
      .order('achieved_at', { ascending: true });

    setHistory(data || []);
    setLoading(false);
  };

  // Build chart data for the selected lift
  const chartData = useMemo(() => {
    if (!selectedLift) return [];

    const entries = history
      .filter(h => h.lift_name.toLowerCase() === selectedLift.toLowerCase())
      .map(h => ({
        date: h.achieved_at,
        weight: h.weight,
        label: format(parseISO(h.achieved_at), 'MMM d, yyyy'),
      }));

    // Also include current PR if not already in history
    const currentPR = prs.find(p => p.liftName.toLowerCase() === selectedLift.toLowerCase());
    if (currentPR) {
      const alreadyInHistory = entries.some(
        e => e.date === currentPR.date && e.weight === currentPR.weight
      );
      if (!alreadyInHistory) {
        entries.push({
          date: currentPR.date,
          weight: currentPR.weight,
          label: format(parseISO(currentPR.date), 'MMM d, yyyy'),
        });
      }
    }

    return entries.sort((a, b) => a.date.localeCompare(b.date));
  }, [selectedLift, history, prs]);

  // Calculate progression stats
  const stats = useMemo(() => {
    if (chartData.length < 2) return null;
    const first = chartData[0].weight;
    const last = chartData[chartData.length - 1].weight;
    const gain = last - first;
    const unit = history.find(h => h.lift_name.toLowerCase() === selectedLift?.toLowerCase())?.unit
      || prs.find(p => p.liftName.toLowerCase() === selectedLift?.toLowerCase())?.unit
      || 'kg';
    return { gain, unit, entries: chartData.length };
  }, [chartData, history, prs, selectedLift]);

  if (loading) {
    return (
      <div className="bg-card rounded-xl p-4 border border-border animate-pulse">
        <div className="h-6 bg-muted rounded w-40 mb-4" />
        <div className="h-48 bg-muted rounded" />
      </div>
    );
  }

  if (liftNames.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl p-4 border border-border"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">PR Progression</h3>
        </div>

        {/* Lift selector */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium border border-border hover:border-primary/50 transition-colors"
          >
            {selectedLift}
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[160px]">
                {liftNames.map(name => (
                  <button
                    key={name}
                    onClick={() => { setSelectedLift(name); setDropdownOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${
                      name === selectedLift ? 'text-primary font-medium' : 'text-foreground'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {chartData.length < 2 ? (
        <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
          <p>Need at least 2 data points to show progression</p>
        </div>
      ) : (
        <>
          {stats && (
            <div className="flex gap-4 mb-3 text-xs">
              <span className={`font-medium ${stats.gain > 0 ? 'text-green-400' : stats.gain < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {stats.gain > 0 ? '+' : ''}{stats.gain}{stats.unit} total
              </span>
              <span className="text-muted-foreground">{stats.entries} records</span>
            </div>
          )}
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 16%)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: 'hsl(220, 10%, 50%)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'hsl(220, 14%, 16%)' }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'hsl(220, 10%, 50%)' }}
                  tickLine={false}
                  axisLine={false}
                  domain={['dataMin - 5', 'dataMax + 5']}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(220, 18%, 12%)',
                    border: '1px solid hsl(220, 14%, 20%)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: 'hsl(0, 0%, 94%)',
                  }}
                  formatter={(value: number) => [`${value}${stats?.unit || 'kg'}`, 'Weight']}
                />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="hsl(42, 90%, 54%)"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(42, 90%, 54%)', r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: 'hsl(42, 90%, 54%)', stroke: 'hsl(220, 18%, 12%)', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </motion.div>
  );
}
