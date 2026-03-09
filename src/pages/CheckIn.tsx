import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, Bed, Gauge, Zap, AlertTriangle, 
  ChevronDown, CheckCircle, PlayCircle 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { SessionBadge } from '@/components/SessionBadge';
import { ReadinessIndicator } from '@/components/ReadinessIndicator';
import { useAppStore } from '@/lib/store';
import { 
  calculateReadiness, 
  shouldDowngradeSession, 
  generateStopRules,
  generateTimeGuidance
} from '@/lib/training-logic';
import { Sleep, ReadinessCheck } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const sleepOptions: { value: Sleep; label: string; icon: string }[] = [
  { value: 'good', label: 'Good', icon: '😴' },
  { value: 'ok', label: 'OK', icon: '😐' },
  { value: 'bad', label: 'Poor', icon: '😵' },
];

export default function CheckIn() {
  const navigate = useNavigate();
  const { 
    getTodaySession, 
    setReadiness,
    todayReadiness,
    getRecentLog 
  } = useAppStore();
  
  const [step, setStep] = useState<'check' | 'plan'>('check');
  const [sleep, setSleep] = useState<Sleep>('good');
  const [soreness, setSoreness] = useState([3]);
  const [energy, setEnergy] = useState([4]);
  const [showDetails, setShowDetails] = useState(false);

  const todaySession = getTodaySession();
  const recentLogs = getRecentLog(2);

  useEffect(() => {
    if (todayReadiness) {
      setStep('plan');
    }
  }, [todayReadiness]);

  if (!todaySession) {
    return (
      <div className="min-h-screen px-4 py-6 pb-24 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">No session planned for today</p>
          <Button onClick={() => navigate('/plan')} variant="outline">
            Create Weekly Plan
          </Button>
        </div>
      </div>
    );
  }

  if (todaySession.type === 'REST') {
    return (
      <div className="min-h-screen px-4 py-6 pb-24 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 rounded-xl bg-muted/20 flex items-center justify-center mb-4 mx-auto">
            <Bed className="w-10 h-10 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Rest Day</h1>
          <p className="text-muted-foreground mb-6">Recovery is when you grow stronger</p>
          <Button onClick={() => navigate('/')} variant="outline">
            Back to Home
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
    setStep('plan');
  };

  const readiness = todayReadiness ? calculateReadiness(todayReadiness) : null;
  
  const recentCardio = recentLogs.some(log => 
    log.notes.toLowerCase().includes('cardio') ||
    log.notes.toLowerCase().includes('run') ||
    log.notes.toLowerCase().includes('bike')
  );

  let finalSession = todaySession;
  let adjustmentReason: string | null = null;

  if (readiness) {
    const adjustment = shouldDowngradeSession(
      todaySession.type, 
      readiness, 
      recentCardio, 
      7
    );
    
    if (adjustment.newType !== todaySession.type) {
      finalSession = { 
        ...todaySession, 
        type: adjustment.newType,
        stopRules: generateStopRules(adjustment.newType, readiness.level),
      };
      adjustmentReason = adjustment.reason;
      
      const timeGuidance = generateTimeGuidance(adjustment.newType);
      finalSession.ifShortOnTime = timeGuidance.short;
      finalSession.ifExtraTime = timeGuidance.extra;
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
        ) : (
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
                      {finalSession.type === 'T' && 'Technique Session'}
                      {finalSession.type === 'S' && 'Strength Session'}
                      {finalSession.type === 'H' && 'Heavy Session'}
                      {finalSession.type === 'T2' && 'Tech-Strength Session'}
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
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="font-medium">{exercise.name}</span>
                          <div className="text-right">
                            {exercise.sets && exercise.reps && (
                              <div className="text-muted-foreground">{exercise.sets}x{exercise.reps}</div>
                            )}
                            {exercise.percentOfMax && (
                              <div className="text-xs text-muted-foreground">@ {exercise.percentOfMax}%</div>
                            )}
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
                  onClick={() => setStep('check')}
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
        )}
      </AnimatePresence>
    </div>
  );
}