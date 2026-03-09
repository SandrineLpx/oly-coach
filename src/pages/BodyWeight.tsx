import { useState } from 'react';
import { motion } from 'framer-motion';
import { Scale, Plus, Trash2, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/lib/store';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export default function BodyWeight() {
  const { bodyWeightLog, logBodyWeight, deleteBodyWeight, getRecentWeights, preferences } = useAppStore();
  const [weight, setWeight] = useState('');
  const unit = preferences.units;

  const recentWeights = getRecentWeights(30);
  const latestEntry = recentWeights[recentWeights.length - 1];
  const previousEntry = recentWeights.length >= 2 ? recentWeights[recentWeights.length - 2] : null;
  const trend = latestEntry && previousEntry ? latestEntry.weight - previousEntry.weight : 0;

  const chartData = recentWeights.map(e => ({
    date: format(parseISO(e.date), 'MMM d'),
    weight: e.weight,
  }));

  const handleLog = () => {
    const w = parseFloat(weight);
    if (isNaN(w) || w <= 0) return;
    logBodyWeight({
      weight: w,
      unit,
      date: format(new Date(), 'yyyy-MM-dd'),
    });
    setWeight('');
  };

  const allEntries = [...bodyWeightLog].sort((a, b) => b.date.localeCompare(a.date));

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };
  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <div className="min-h-screen px-4 py-6 pb-24">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold">Body Weight</h1>
        </div>
        <p className="text-muted-foreground text-sm mt-1">Track your daily weight</p>
      </motion.div>

      <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
        {/* Current weight + trend */}
        {latestEntry && (
          <motion.div variants={item} className="bg-card rounded-2xl p-5 border border-border">
            <p className="text-sm text-muted-foreground mb-1">Latest</p>
            <div className="flex items-end gap-3">
              <span className="text-4xl font-bold text-primary">{latestEntry.weight}</span>
              <span className="text-lg text-muted-foreground mb-1">{latestEntry.unit}</span>
              {trend !== 0 && (
                <div className={cn(
                  "flex items-center gap-1 text-sm font-medium mb-1",
                  trend > 0 ? "text-destructive" : trend < 0 ? "text-success" : "text-muted-foreground"
                )}>
                  {trend > 0 ? <TrendingUp className="w-4 h-4" /> : trend < 0 ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                  {trend > 0 ? '+' : ''}{trend.toFixed(1)} {latestEntry.unit}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{format(parseISO(latestEntry.date), 'EEEE, MMM d')}</p>
          </motion.div>
        )}

        {/* Quick log */}
        <motion.div variants={item} className="bg-card rounded-2xl p-4 border border-border">
          <p className="text-sm font-semibold mb-3">Log Today</p>
          <div className="flex gap-2">
            <Input
              type="number"
              step="0.1"
              placeholder={`Weight (${unit})`}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLog()}
              className="flex-1"
            />
            <Button onClick={handleLog} disabled={!weight}>
              <Plus className="w-4 h-4 mr-1" />
              Log
            </Button>
          </div>
        </motion.div>

        {/* Chart */}
        {chartData.length >= 2 && (
          <motion.div variants={item} className="bg-card rounded-2xl p-4 border border-border">
            <p className="text-sm font-semibold mb-3">30-Day Trend</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={['dataMin - 1', 'dataMax + 1']}
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {/* History */}
        <motion.div variants={item}>
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">History</p>
          {allEntries.length === 0 ? (
            <div className="bg-card rounded-2xl p-8 border border-border text-center">
              <Scale className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No entries yet</p>
              <p className="text-sm text-muted-foreground mt-1">Log your first weight above</p>
            </div>
          ) : (
            <div className="space-y-2">
              {allEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-card rounded-xl p-3 border border-border flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold">
                      {entry.weight} <span className="text-sm text-muted-foreground">{entry.unit}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(entry.date), 'EEE, MMM d yyyy')}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => deleteBodyWeight(entry.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
