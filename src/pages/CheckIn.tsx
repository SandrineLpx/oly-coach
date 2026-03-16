import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, Bed, Gauge, Zap, AlertTriangle, 
  ChevronDown, CheckCircle, PlayCircle, Dumbbell, BookOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { SessionBadge } from '@/components/SessionBadge';
import { ReadinessIndicator } from '@/components/ReadinessIndicator';
import { useAppStore } from '@/lib/store';
import {
  calculateReadiness,
  adjustSessionType,
  generateStopRules,
  generateTimeGuidance,
  generateSessionExercises,
  getDaysSinceHeavySession,
  resolveExerciseWeights,
  shouldAddT2,
} from '@/lib/training-logic';
import { Sleep, ReadinessCheck, SessionType, ProgramSession } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

const sleepOptions: { value: Sleep; label: string; icon: string }[] = [
  { value: 'good', label: 'Good', icon: '😴' },
  { value: 'ok', label: 'OK', icon: '😐' },
  { value: 'bad', label: 'Poor', icon: '😵' },
];

const SESSION_TYPE_LABELS: Record<string, string> = {
  T: 'Technique',
  S: 'Strength',
  H: 'Heavy',
  T2: 'Tech-Strength',
  REST: 'Rest',
};

export default function CheckIn() {
  const navigate = useNavigate();
  const {
    getTodaySession,
    setReadiness,
    todayReadiness,
    getRecentLog,
    activeProgram,
    fetchActiveProgram,
    getCurrentProgramWeek,
    prs,
    preferences,
    profile,
    trainingLog,
    currentPlan,
  } = useAppStore();
  
  const [step, setStep] = useState<'check' | 'plan' | 'rest-choice'>('check');
  const [sleep, setSleep] = useState<Sleep>('good');
  const [soreness, setSoreness] = useState([3]);
  const [energy, setEnergy] = useState([4]);
  const [showDetails, setShowDetails] = useState(false);
  const [overrideSession, setOverrideSession] = useState<{
    type: SessionType;
    exercises: any[];
    rationale: string;
    stopRules: string[];
    ifShortOnTime: string;
    ifExtraTime: string;
    name?: string;
  } | null>(null);

  const todaySession = getTodaySession();
  const recentLogs = getRecentLog(2);

  useEffect(() => { fetchActiveProgram(); }, []);

  useEffect(() => {
    if (todayReadiness) {
      if (!todaySession || todaySession.type === 'REST') {
        setStep('rest-choice');
      } else {
        setStep('plan');
      }
    }
  }, [todayReadiness, todaySession]);

  // Get program sessions for current week (for "pick from program" option)
  const currentWeek = getCurrentProgramWeek();
  const programSessions: ProgramSession[] = activeProgram?.program_sessions?.filter(
    s => s.week_number === currentWeek
  ) || [];

  const handlePickProgramSession = (ps: ProgramSession) => {
    const exercises = (ps.program_exercises || []).map(ex => ({
      name: ex.name,
      sets: ex.sets?.toString() || undefined,
      reps: ex.reps || undefined,
      percentOfMax: ex.percent_of_max || undefined,
      notes: ex.notes || undefined,
    }));

    setOverrideSession({
      type: (ps.session_type as SessionType) || 'T',
      exercises,
      rationale: ps.notes || `${ps.name || SESSION_TYPE_LABELS[ps.session_type] || 'Training'} session from your program.`,
      stopRules: generateStopRules((ps.session_type as SessionType) || 'T', 'good'),
      ifShortOnTime: generateTimeGuidance((ps.session_type as SessionType) || 'T').short,
      ifExtraTime: generateTimeGuidance((ps.session_type as SessionType) || 'T').extra,
      name: ps.name || undefined,
    });
    setStep('plan');
  };

  const handlePickCustomSession = (type: SessionType) => {
    let exercises = generateSessionExercises(type);
    exercises = resolveExerciseWeights(exercises, prs, 'good', preferences.units);
    const timeGuidance = generateTimeGuidance(type, exercises);
    setOverrideSession({
      type,
      exercises,
      rationale: 'Custom session on a rest day — listen to your body.',
      stopRules: generateStopRules(type, 'good'),
      ifShortOnTime: timeGuidance.short,
      ifExtraTime: timeGuidance.extra,
    });
    setStep('plan');
  };

  // Pull-forward: offer to pull the next planned session to today
  const nextPlannedSession = currentPlan?.sessions.find(s =>
    s.type !== 'REST' && s.status !== 'completed' && s.status !== 'skipped' && s.status !== 'moved'
    && new Date(s.date) > new Date()
  );

  const daysSinceHeavy = getDaysSinceHeavySession(trainingLog);

  // No plan at all
  if (!todaySession && !overrideSession && step !== 'rest-choice') {
    return (
      <div className="min-h-screen px-4 py-6 pb-24 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">No session planned for today</p>
          <div className="flex flex-col gap-2">
            <Button onClick={() => navigate('/plan')} variant="outline">
              Create Weekly Plan
            </Button>
            <Button onClick={() => setStep('rest-choice')} variant="gold">
              <Dumbbell className="w-4 h-4" /> Train Anyway
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // REST day — show choice screen instead of blocking
  if ((todaySession?.type === 'REST' || !todaySession) && step !== 'plan' && step !== 'check') {
    return (
      <div className="min-h-screen px-4 py-6 pb-24">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6 text-center">
          <div className="w-16 h-16 rounded-xl bg-muted/20 flex items-center justify-center mb-4 mx-auto">
            <Bed className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Rest Day</h1>
          <p className="text-muted-foreground mb-6">Recovery is when you grow stronger — but if you want to train, go for it.</p>
        </motion.div>

        <div className="space-y-3">
          {/* Pick from program */}
          {programSessions.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <div className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">From Your Program (Wk {currentWeek})</h3>
                </div>
                <div className="space-y-2">
                  {programSessions.map(ps => (
                    <button
                      key={ps.id}
                      onClick={() => handlePickProgramSession(ps)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 transition-colors text-left"
                    >
                      <SessionBadge type={(ps.session_type as SessionType) || 'T'} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {ps.name || `${SESSION_TYPE_LABELS[ps.session_type] || ps.session_type} Session`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(ps.program_exercises?.length || 0)} exercises
                        </p>
                      </div>
                      <ChevronDown className="w-4 h-4 text-muted-foreground -rotate-90" />
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Pull forward next session */}
          {nextPlannedSession && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <button
                onClick={() => {
                  handlePickCustomSession(nextPlannedSession.type);
                  // Mark original as moved
                  useAppStore.getState().moveSession(nextPlannedSession.id, format(new Date(), 'yyyy-MM-dd'));
                }}
                className="w-full bg-card rounded-xl border border-primary/30 p-4 text-left hover:border-primary/60 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <ArrowRight className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-sm">Pull Forward Next Session</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Move {format(parseISO(nextPlannedSession.date), 'EEEE')}'s {SESSION_TYPE_LABELS[nextPlannedSession.type]} session to today
                </p>
              </button>
            </motion.div>
          )}

          {/* Custom session */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <Dumbbell className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Custom Session</h3>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {(['T', 'S', 'H', 'T2'] as SessionType[]).map(type => (
                  <button
                    key={type}
                    onClick={() => handlePickCustomSession(type)}
                    className="p-3 rounded-xl border border-border hover:border-primary/50 transition-colors flex flex-col items-center gap-1"
                  >
                    <SessionBadge type={type} size="sm" />
                    <span className="text-[10px] text-muted-foreground">{SESSION_TYPE_LABELS[type]}</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Or just go home */}
          <Button onClick={() => navigate('/')} variant="outline" className="w-full">
            Skip — Enjoy Rest Day
          </Button>
        </div>
      </div>
    );
  }

  const handleCheckIn = () => {
    const check: ReadinessCheck = {
      sleep,
      legSoreness: soreness[0],
      energy: energy[0],
      timestamp: new Date().toISOString(),
    };
    
    setReadiness(check);
    if (todaySession?.type === 'REST' || !todaySession) {
      setStep('rest-choice');
    } else {
      setStep('plan');
    }
  };

  const readiness = todayReadiness ? calculateReadiness(todayReadiness) : null;
  
  const recentCardio = recentLogs.some(log => 
    log.notes.toLowerCase().includes('cardio') ||
    log.notes.toLowerCase().includes('run') ||
    log.notes.toLowerCase().includes('bike')
  );

  // Use override session if set (rest day training), otherwise today's planned session
  const baseSession = overrideSession || todaySession!;
  let finalSession = baseSession;
  let adjustmentReason: string | null = null;

  if (readiness && !overrideSession) {
    const adjustment = adjustSessionType(
      baseSession.type,
      readiness,
      recentCardio,
      daysSinceHeavy,
      profile?.competitionDate,
      (baseSession as any).date || format(new Date(), 'yyyy-MM-dd'),
    );

    if (adjustment.newType !== baseSession.type) {
      let newExercises = generateSessionExercises(adjustment.newType);
      newExercises = resolveExerciseWeights(newExercises, prs, readiness.level, preferences.units);
      const timeGuidance = generateTimeGuidance(adjustment.newType, newExercises);

      finalSession = {
        ...baseSession,
        type: adjustment.newType,
        exercises: newExercises,
        stopRules: generateStopRules(adjustment.newType, readiness.level),
        ifShortOnTime: timeGuidance.short,
        ifExtraTime: timeGuidance.extra,
      };
      adjustmentReason = adjustment.reason;
    }
  }

  return (
    <div className="min-h-screen px-4 py-6 pb-24">
      <AnimatePresence mode="wait">
        {step === 'check' ? (
          <motion.div
            key="check"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold mb-2">Pre-Workout Check</h1>
              <p className="text-muted-foreground">How are you feeling today?</p>
            </div>

            {/* Sleep */}
            <div className="bg-card rounded-xl p-5 border border-border">
              <div className="flex items-center gap-2 mb-4">
                <Bed className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Sleep Quality</h3>
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                {sleepOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setSleep(option.value)}
                    className={cn(
                      "p-4 rounded-xl border-2 transition-all text-center",
                      sleep === option.value 
                        ? "border-primary bg-primary/10" 
                        : "border-border bg-background hover:border-border/60"
                    )}
                  >
                    <div className="text-2xl mb-1">{option.icon}</div>
                    <div className="text-sm font-medium">{option.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Soreness */}
            <div className="bg-card rounded-xl p-5 border border-border">
              <div className="flex items-center gap-2 mb-4">
                <Gauge className="w-5 h-5 text-accent" />
                <h3 className="font-semibold">Leg Soreness</h3>
              </div>
              
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground w-8">0</span>
                <Slider
                  value={soreness}
                  onValueChange={setSoreness}
                  min={0}
                  max={10}
                  step={1}
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground w-8">10</span>
              </div>
              
              <div className="text-center mt-3">
                <span className="text-2xl font-bold text-accent">{soreness[0]}</span>
                <p className="text-xs text-muted-foreground mt-1">
                  {soreness[0] === 0 && "Fresh"}
                  {soreness[0] >= 1 && soreness[0] <= 3 && "Minimal"}
                  {soreness[0] >= 4 && soreness[0] <= 6 && "Moderate"}
                  {soreness[0] >= 7 && soreness[0] <= 8 && "High"}
                  {soreness[0] >= 9 && "Very High"}
                </p>
              </div>
            </div>

            {/* Energy */}
            <div className="bg-card rounded-xl p-5 border border-border">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-warning" />
                <h3 className="font-semibold">Energy Level</h3>
              </div>
              
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground w-8">1</span>
                <Slider
                  value={energy}
                  onValueChange={setEnergy}
                  min={1}
                  max={5}
                  step={1}
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground w-8">5</span>
              </div>
              
              <div className="text-center mt-3">
                <span className="text-2xl font-bold text-warning">{energy[0]}</span>
                <p className="text-xs text-muted-foreground mt-1">
                  {energy[0] === 1 && "Exhausted"}
                  {energy[0] === 2 && "Low"}
                  {energy[0] === 3 && "Average"}
                  {energy[0] === 4 && "Good"}
                  {energy[0] === 5 && "Excellent"}
                </p>
              </div>
            </div>

            <Button 
              onClick={handleCheckIn}
              variant="gold"
              size="xl"
              className="w-full mt-8"
            >
              Check Readiness
              <ArrowRight className="w-5 h-5" />
            </Button>
          </motion.div>
        ) : step === 'plan' ? (
          <motion.div
            key="plan"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="space-y-6"
          >
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold mb-2">Today's Plan</h1>
              <p className="text-muted-foreground">
                {format(new Date(), 'EEEE, MMMM d')}
              </p>
            </div>

            {/* Readiness Score */}
            {readiness && (
              <div className="bg-card-gradient rounded-xl p-5 border border-border text-center">
                <ReadinessIndicator 
                  score={readiness.score} 
                  level={readiness.level}
                  size="lg"
                  className="mx-auto mb-4"
                />
                <p className="text-lg font-semibold mb-2">Readiness: {readiness.level}</p>
                <p className="text-sm text-muted-foreground">{readiness.reasoning}</p>
              </div>
            )}

            {/* Session Adjustment Warning */}
            {adjustmentReason && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-warning/10 border border-warning/30 rounded-xl p-4"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-warning mb-1">Session Adjusted</p>
                    <p className="text-xs text-muted-foreground">{adjustmentReason}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Today's Session */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="p-5 border-b border-border">
                <div className="flex items-center gap-3 mb-2">
                  <SessionBadge type={finalSession.type} size="lg" />
                  <div>
                    <p className="font-bold text-xl">
                      {(overrideSession?.name) || (
                        <>
                          {finalSession.type === 'T' && 'Technique Session'}
                          {finalSession.type === 'S' && 'Strength Session'}
                          {finalSession.type === 'H' && 'Heavy Session'}
                          {finalSession.type === 'T2' && 'Tech-Strength Session'}
                        </>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {finalSession.exercises.length} exercises planned
                    </p>
                  </div>
                </div>
                
                <p className="text-sm text-muted-foreground">
                  {finalSession.rationale}
                </p>
              </div>

              {/* Exercise List Toggle */}
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="w-full p-4 flex items-center justify-between hover:bg-muted/20 transition-colors"
              >
                <span className="text-sm font-medium">View Exercise List</span>
                <ChevronDown className={cn("w-5 h-5 transition-transform", showDetails && "rotate-180")} />
              </button>

              <AnimatePresence>
                {showDetails && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-border"
                  >
                    <div className="p-4 space-y-3">
                      {finalSession.exercises.map((exercise, i) => (
                        <div key={i} className={cn(
                          "flex items-center justify-between text-sm",
                          exercise.isCarryOver && "border-l-2 border-primary/50 pl-2"
                        )}>
                          <div>
                            <span className="font-medium">{exercise.name}</span>
                            {exercise.isCarryOver && (
                              <span className="text-[10px] text-primary ml-1">carry-over</span>
                            )}
                          </div>
                          <div className="text-right">
                            {exercise.sets && exercise.reps && (
                              <div className="text-muted-foreground">{exercise.sets}x{exercise.reps}</div>
                            )}
                            {exercise.weightRange ? (
                              <div className="text-xs text-primary/80">{exercise.weightRange}</div>
                            ) : exercise.percentOfMax ? (
                              <div className="text-xs text-muted-foreground">@ {exercise.percentOfMax}%</div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Stop Rules & Time Guidance */}
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-destructive mb-2">Stop if:</h4>
                <ul className="space-y-1">
                  {finalSession.stopRules.map((rule, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                      <span className="text-destructive">•</span>
                      {rule}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-muted/20 rounded-xl p-4">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <h5 className="font-semibold text-muted-foreground mb-1">Short on time?</h5>
                    <p className="text-muted-foreground">{finalSession.ifShortOnTime}</p>
                  </div>
                  <div>
                    <h5 className="font-semibold text-muted-foreground mb-1">Extra time?</h5>
                    <p className="text-muted-foreground">{finalSession.ifExtraTime}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button
                onClick={() => navigate('/log')}
                variant="gold"
                size="xl"
                className="w-full"
              >
                <PlayCircle className="w-5 h-5" />
                Start Training
              </Button>
              
              <div className="flex gap-3">
                <Button
                  onClick={() => { setOverrideSession(null); setStep('check'); }}
                  variant="outline"
                  className="flex-1"
                >
                  Redo Check-in
                </Button>
                <Button
                  onClick={() => navigate('/')}
                  variant="outline"
                  className="flex-1"
                >
                  Back Home
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}