import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CalendarIcon, CheckCircle, Sparkles, Trophy, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SessionBadge } from '@/components/SessionBadge';
import { useAppStore } from '@/lib/store';
import { Sleep, LoggedSession, SessionType, Exercise } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';

const sleepOptions: { value: Sleep; label: string }[] = [
  { value: 'good', label: 'Good' },
  { value: 'ok', label: 'OK' },
  { value: 'bad', label: 'Poor' },
];

const sessionTypes: SessionType[] = ['T', 'S', 'H', 'T2'];

interface ExerciseLog {
  name: string;
  sets?: string;
  reps?: string;
  percentOfMax?: number;
  weight?: number;
  notes?: string;
  isPR?: boolean;
}

export default function LogSession() {
  const navigate = useNavigate();
  const { getTodaySession, logSession, markSessionComplete, prs, addPR, preferences, recordPRHistory } = useAppStore();

  const todaySession = getTodaySession();

  const [sessionType, setSessionType] = useState<SessionType>(todaySession?.type || 'S');
  const [sessionDate, setSessionDate] = useState<Date>(new Date());
  const [rpe, setRpe] = useState([7]);
  const [sleep, setSleep] = useState<Sleep>('good');
  const [soreness, setSoreness] = useState([3]);
  const [notes, setNotes] = useState('');
  const [asPlanned, setAsPlanned] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [detectedPRs, setDetectedPRs] = useState<string[]>([]);
  const [showExercises, setShowExercises] = useState(true);

  // Initialize exercise logs from today's planned session or empty
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>(() => {
    if (todaySession?.exercises?.length) {
      return todaySession.exercises.map(ex => ({
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        percentOfMax: ex.percentOfMax,
        weight: ex.weight,
        notes: ex.notes,
        isPR: false,
      }));
    }
    return [];
  });

  const addExercise = () => {
    setExerciseLogs(prev => [...prev, { name: '', weight: undefined, sets: '', reps: '', isPR: false }]);
  };

  const updateExercise = (index: number, field: keyof ExerciseLog, value: any) => {
    setExerciseLogs(prev => prev.map((ex, i) => {
      if (i !== index) return ex;
      const updated = { ...ex, [field]: value };

      // Auto-detect PR when weight changes
      if (field === 'weight' && updated.name && value) {
        const existingPR = prs.find(
          p => p.liftName.toLowerCase() === updated.name.toLowerCase()
        );
        updated.isPR = !existingPR || value > existingPR.weight;
      }

      return updated;
    }));
  };

  const removeExercise = (index: number) => {
    setExerciseLogs(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    // Detect and record PRs
    const newPRNames: string[] = [];
    const dateStr = format(sessionDate, 'yyyy-MM-dd');

    for (const ex of exerciseLogs) {
      if (!ex.name || !ex.weight) continue;
      const existingPR = prs.find(
        p => p.liftName.toLowerCase() === ex.name.toLowerCase()
      );

      if (!existingPR || ex.weight > existingPR.weight) {
        newPRNames.push(ex.name);

        // Update/add the PR
        addPR({
          id: Math.random().toString(36).substring(2, 11),
          liftName: ex.name,
          weight: ex.weight,
          unit: preferences.units,
          date: dateStr,
        });

        // Record in PR history
        recordPRHistory({
          lift_name: ex.name,
          weight: ex.weight,
          unit: preferences.units,
          achieved_at: dateStr,
        });
      }
    }

    const exercises: Exercise[] = exerciseLogs.map(ex => ({
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      percentOfMax: ex.percentOfMax,
      weight: ex.weight,
      notes: ex.notes,
      isPR: ex.isPR,
    }));

    const log: LoggedSession = {
      id: Math.random().toString(36).substring(2, 11),
      date: dateStr,
      sessionType,
      plannedSessionId: todaySession?.id,
      exercises,
      asPlanned,
      rpe: rpe[0],
      sleep,
      soreness: soreness[0],
      notes,
      newPRs: newPRNames,
    };

    logSession(log);
    if (todaySession) {
      markSessionComplete(todaySession.id);
    }

    setDetectedPRs(newPRNames);
    setShowSuccess(true);

    if (newPRNames.length > 0) {
      toast.success(`🏆 New PR${newPRNames.length > 1 ? 's' : ''}!`, {
        description: newPRNames.join(', '),
        duration: 5000,
      });
    } else {
      toast.success('Session logged!', { description: 'Great work today!' });
    }

    setTimeout(() => navigate('/'), 3000);
  };

  if (showSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="min-h-screen flex items-center justify-center px-4"
      >
        <div className="text-center">
          {detectedPRs.length > 0 ? (
            <>
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', delay: 0.2 }}
                className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6"
              >
                <Trophy className="w-12 h-12 text-primary" />
              </motion.div>
              <h1 className="text-2xl font-bold mb-2">🎉 New PR{detectedPRs.length > 1 ? 's' : ''}!</h1>
              <div className="space-y-1 mb-4">
                {detectedPRs.map(name => (
                  <motion.p
                    key={name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    className="text-primary font-semibold"
                  >
                    {name}
                  </motion.p>
                ))}
              </div>
              <p className="text-muted-foreground">Session logged — keep crushing it!</p>
            </>
          ) : (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
                className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-6"
              >
                <CheckCircle className="w-10 h-10 text-success" />
              </motion.div>
              <h1 className="text-2xl font-bold mb-2">Session Logged!</h1>
              <p className="text-muted-foreground">Great work today</p>
            </>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 pb-24">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Log Session</h1>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("justify-start text-left font-normal gap-2")}>
              <CalendarIcon className="h-4 w-4" />
              {format(sessionDate, 'EEEE, MMMM d')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={sessionDate}
              onSelect={(d) => d && setSessionDate(d)}
              disabled={(date) => date > new Date()}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </motion.div>

      <div className="space-y-6">
        <div className="bg-card rounded-xl p-5 border border-border">
          <h3 className="font-semibold mb-4">Session Type</h3>
          <div className="grid grid-cols-4 gap-2">
            {sessionTypes.map(type => (
              <button key={type} onClick={() => setSessionType(type)}
                className={cn("p-3 rounded-xl border-2 transition-all flex flex-col items-center",
                  sessionType === type ? "border-primary bg-primary/10" : "border-border")}>
                <SessionBadge type={type} size="sm" />
              </button>
            ))}
          </div>
        </div>

        {/* Exercises with weight inputs */}
        <div className="bg-card rounded-xl p-5 border border-border">
          <button
            onClick={() => setShowExercises(!showExercises)}
            className="w-full flex items-center justify-between mb-2"
          >
            <h3 className="font-semibold">Exercises ({exerciseLogs.length})</h3>
            <ChevronDown className={cn("w-5 h-5 text-muted-foreground transition-transform", showExercises && "rotate-180")} />
          </button>

          <AnimatePresence>
            {showExercises && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-3 overflow-hidden"
              >
                {exerciseLogs.map((ex, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "p-3 rounded-lg border transition-colors",
                      ex.isPR ? "border-primary bg-primary/5" : "border-border"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Input
                        value={ex.name}
                        onChange={e => updateExercise(i, 'name', e.target.value)}
                        placeholder="Exercise name"
                        className="flex-1 h-8 text-sm"
                      />
                      <button
                        onClick={() => removeExercise(i)}
                        className="text-muted-foreground hover:text-destructive text-xs px-2"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase">Weight ({preferences.units})</label>
                        <Input
                          type="number"
                          step="0.5"
                          value={ex.weight ?? ''}
                          onChange={e => updateExercise(i, 'weight', e.target.value ? parseFloat(e.target.value) : undefined)}
                          placeholder="0"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase">Sets</label>
                        <Input
                          value={ex.sets ?? ''}
                          onChange={e => updateExercise(i, 'sets', e.target.value)}
                          placeholder="5"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase">Reps</label>
                        <Input
                          value={ex.reps ?? ''}
                          onChange={e => updateExercise(i, 'reps', e.target.value)}
                          placeholder="3"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    {ex.isPR && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-1.5 mt-2 text-xs text-primary font-semibold"
                      >
                        <Trophy className="w-3.5 h-3.5" />
                        New PR!
                      </motion.div>
                    )}
                  </motion.div>
                ))}

                <button
                  onClick={addExercise}
                  className="w-full py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
                >
                  + Add Exercise
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="bg-card rounded-xl p-5 border border-border">
          <h3 className="font-semibold mb-4">RPE (Rate of Perceived Exertion)</h3>
          <Slider value={rpe} onValueChange={setRpe} min={1} max={10} step={1} />
          <p className="text-center mt-2 text-2xl font-bold text-primary">{rpe[0]}</p>
        </div>

        <div className="bg-card rounded-xl p-5 border border-border">
          <h3 className="font-semibold mb-4">Sleep Last Night</h3>
          <div className="grid grid-cols-3 gap-2">
            {sleepOptions.map(option => (
              <button key={option.value} onClick={() => setSleep(option.value)}
                className={cn("p-3 rounded-xl border-2 transition-all text-sm font-medium",
                  sleep === option.value ? "border-primary bg-primary/10" : "border-border")}>
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-xl p-5 border border-border">
          <h3 className="font-semibold mb-4">Post-Session Soreness</h3>
          <Slider value={soreness} onValueChange={setSoreness} min={0} max={10} step={1} />
          <p className="text-center mt-2 text-2xl font-bold">{soreness[0]}</p>
        </div>

        <div className="bg-card rounded-xl p-5 border border-border">
          <h3 className="font-semibold mb-4">Notes</h3>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="How did the session feel?" className="min-h-[100px]" />
        </div>

        <Button onClick={handleSubmit} variant="gold" size="xl" className="w-full">
          <Sparkles className="w-5 h-5" /> Log Session
        </Button>
      </div>
    </div>
  );
}
