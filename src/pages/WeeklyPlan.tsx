import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Plus, Calendar, RefreshCw, CheckCircle, Clock, ChevronLeft, ChevronRight, SkipForward, AlertTriangle, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SessionBadge } from '@/components/SessionBadge';
import { useAppStore } from '@/lib/store';
import { format, parseISO, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { ProgramWeekView, type WeekOverride } from '@/components/ProgramWeekView';
import { FlexibleWeekPlanner } from '@/components/FlexibleWeekPlanner';
import ProgramOverview from '@/components/ProgramOverview';
import { WeekSummary } from '@/components/WeekSummary';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { usePowerUser } from '@/lib/powerUser';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function WeeklyPlan() {
  const navigate = useNavigate();
  const {
    profile,
    currentPlan,
    generateWeeklyPlan,
    markSessionComplete,
    skipSession,
    activeProgram,
    fetchActiveProgram,
    getCurrentProgramWeek,
  } = useAppStore();
  
  const [selectedDays, setSelectedDays] = useState<number[]>(profile?.preferredDays || [1, 3, 5]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewWeek, setViewWeek] = useState<number | null>(null);

  const { isCoach } = useUserRole();
  const isPowerUser = usePowerUser();
  const { user } = useAuth();
  const [override, setOverride] = useState<WeekOverride | null>(null);
  const [flexibleOpen, setFlexibleOpen] = useState(false);

  useEffect(() => {
    fetchActiveProgram();
  }, []);

  useEffect(() => {
    if (activeProgram && viewWeek === null) {
      setViewWeek(getCurrentProgramWeek());
    }
  }, [activeProgram]);

  const loadOverride = useCallback(async () => {
    if (!activeProgram || !user || viewWeek === null) {
      setOverride(null);
      return;
    }
    const { data } = await supabase
      .from('weekly_overrides')
      .select('session_assignments, dropped_sessions')
      .eq('program_id', activeProgram.id)
      .eq('athlete_id', user.id)
      .eq('week_number', viewWeek)
      .maybeSingle();
    setOverride(
      data
        ? {
            session_assignments: (data.session_assignments as unknown as WeekOverride['session_assignments']) ?? null,
            dropped_sessions: (data.dropped_sessions as unknown as WeekOverride['dropped_sessions']) ?? null,
          }
        : null,
    );
  }, [activeProgram, user, viewWeek]);

  useEffect(() => { loadOverride(); }, [loadOverride]);

  const toggleDay = (day: number) => {
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day].sort()
    );
  };

  const handleGeneratePlan = async () => {
    setIsGenerating(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    generateWeeklyPlan(selectedDays);
    setIsGenerating(false);
  };

  // If there's an active program from the database, show it
  if (activeProgram && viewWeek !== null) {
    const ap: any = activeProgram;
    const phaseSummary = (ap.phase_summary as any[] | null) ?? null;
    const droppedThisWeek = override?.dropped_sessions ?? null;
    const isAthleteView = !isCoach;

    return (
      <div className="min-h-screen px-4 py-6 pb-24 space-y-4">

        {/* Compact mobile-first weekly summary */}
        <WeekSummary
          currentWeek={viewWeek}
          totalWeeks={activeProgram.weeks}
          phaseSummary={phaseSummary}
          hasOverride={!!override?.session_assignments?.length}
        />

        {/* Athlete-facing program overview: phases, progress, drop banner */}
        {isAthleteView && (
          <ProgramOverview
            name={activeProgram.name}
            description={activeProgram.description}
            phaseSummary={phaseSummary}
            currentWeek={viewWeek}
            totalWeeks={activeProgram.weeks}
            droppedThisWeek={droppedThisWeek}
          />
        )}

        {/* Coach-only header (kept for existing coach flow) */}
        {!isAthleteView && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-2xl font-bold mb-1">{activeProgram.name}</h1>
            <p className="text-muted-foreground text-sm">
              {activeProgram.description || `${activeProgram.weeks}-week program`}
            </p>
          </motion.div>
        )}

        {/* Week Navigator */}
        <div className="flex items-center justify-between bg-card rounded-xl border border-border p-3">
          <button
            onClick={() => setViewWeek(Math.max(1, viewWeek - 1))}
            disabled={viewWeek <= 1}
            className="p-1 text-muted-foreground disabled:opacity-30"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <span className="font-semibold">Week {viewWeek}</span>
            <span className="text-muted-foreground text-sm"> of {activeProgram.weeks}</span>
            {viewWeek === getCurrentProgramWeek() && (
              <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Current</span>
            )}
          </div>
          <button
            onClick={() => setViewWeek(Math.min(activeProgram.weeks, viewWeek + 1))}
            disabled={viewWeek >= activeProgram.weeks}
            className="p-1 text-muted-foreground disabled:opacity-30"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <ProgramWeekView
          sessions={activeProgram.program_sessions?.filter((s) => s.week_number === viewWeek) || []}
          onStartSession={() => navigate('/checkin')}
          isCoach={isCoach}
          override={override}
          onOpenFlexible={() => setFlexibleOpen(true)}
        />


        {flexibleOpen && user && (
          <FlexibleWeekPlanner
            open={flexibleOpen}
            onOpenChange={setFlexibleOpen}
            programId={activeProgram.id}
            weekNumber={viewWeek}
            sessions={(activeProgram.program_sessions?.filter((s) => s.week_number === viewWeek) || []) as any}
            initialAthleteId={user.id}
            onSaved={loadOverride}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 pb-24">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold mb-2">Weekly Plan</h1>
        <p className="text-muted-foreground">
          {currentPlan 
            ? `Week of ${format(parseISO(currentPlan.weekStartDate), 'MMM d')}`
            : 'Plan your training week'
          }
        </p>
      </motion.div>

      {!currentPlan ? (
        /* Plan Creation */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="bg-card rounded-xl p-5 border border-border">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Select Your Training Days
            </h2>
            
            <div className="grid grid-cols-7 gap-2 mb-6">
              {DAYS.map((day, index) => {
                const dayNum = index === 6 ? 0 : index + 1;
                return (
                  <button
                    key={day}
                    onClick={() => toggleDay(dayNum)}
                    className={cn(
                      'aspect-square rounded-xl flex flex-col items-center justify-center transition-all border-2 text-sm',
                      selectedDays.includes(dayNum)
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'bg-card border-border text-muted-foreground hover:border-border/60'
                    )}
                  >
                    <span className="font-medium">{day}</span>
                    {selectedDays.includes(dayNum) && (
                      <CheckCircle className="w-4 h-4 mt-1" />
                    )}
                  </button>
                );
              })}
            </div>
            
            <div className="bg-muted/50 rounded-lg p-3 mb-4">
              <p className="text-sm">
                <span className="font-semibold">{selectedDays.length} days</span> selected
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedDays.length === 3 
                  ? 'Perfect frequency for Olympic lifting'
                  : selectedDays.length < 3
                  ? 'Consider 3+ days for optimal progress'
                  : 'High volume - monitor recovery closely'}
              </p>
            </div>
            
            <Button 
              onClick={handleGeneratePlan}
              disabled={selectedDays.length === 0 || isGenerating}
              variant="gold"
              size="lg"
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Generating Plan...
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Generate This Week
                </>
              )}
            </Button>
          </div>
        </motion.div>
      ) : (
        /* Current Plan Display */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">This Week's Schedule</h2>
                <button 
                  onClick={handleGeneratePlan}
                  className="text-xs text-primary font-medium"
                  disabled={isGenerating}
                >
                  Regenerate
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-7">
              {currentPlan.sessions.map((session) => {
                const isSessionToday = isToday(parseISO(session.date));
                return (
                  <div 
                    key={session.id}
                    className={cn(
                      "flex flex-col items-center py-4 border-r border-border last:border-r-0",
                      isSessionToday && "bg-primary/5"
                    )}
                  >
                    <span className={cn(
                      "text-[10px] font-medium mb-2",
                      isSessionToday ? "text-primary" : "text-muted-foreground"
                    )}>
                      {format(parseISO(session.date), 'EEE')}
                    </span>
                    <span className={cn(
                      "text-xs mb-2",
                      isSessionToday ? "text-primary" : "text-muted-foreground"
                    )}>
                      {format(parseISO(session.date), 'd')}
                    </span>
                    <SessionBadge type={session.type} size="sm" />
                    {(session.completed || session.status === 'completed') && (
                      <CheckCircle className="w-4 h-4 text-success mt-2" />
                    )}
                    {session.status === 'skipped' && (
                      <SkipForward className="w-4 h-4 text-muted-foreground mt-2" />
                    )}
                    {session.status === 'moved' && (
                      <span className="text-[8px] text-muted-foreground mt-1">moved</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Protection Rule Banner */}
          {currentPlan.protectionRule && (
            <div className="bg-warning/10 border border-warning/30 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">{currentPlan.protectionRule}</p>
            </div>
          )}

          <div className="space-y-3">
            {currentPlan.sessions
              .filter(s => s.type !== 'REST' || (isPowerUser && s.cardioSuggestion))
              .map((session) => {
                const isSessionToday = isToday(parseISO(session.date));
                const isSkipped = session.status === 'skipped';
                const isMoved = session.status === 'moved';
                const isCompleted = session.completed || session.status === 'completed';
                const isInactive = isSkipped || isMoved;

                // REST days with cardio suggestions (power users only)
                if (isPowerUser && session.type === 'REST' && session.cardioSuggestion) {
                  return (
                    <motion.div
                      key={session.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-card rounded-xl border border-border p-4"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Activity className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {format(parseISO(session.date), 'EEE, MMM d')} — Rest Day
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{session.cardioSuggestion}</p>
                    </motion.div>
                  );
                }

                return (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "bg-card rounded-xl border border-border p-4",
                      isSessionToday && !isInactive && "border-primary/30 bg-primary/5",
                      isInactive && "opacity-50"
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <SessionBadge type={session.type} size="md" showLabel />
                        {isSessionToday && !isInactive && (
                          <div className="px-2 py-1 bg-primary/10 rounded text-xs font-bold text-primary">
                            Today
                          </div>
                        )}
                        {isSkipped && (
                          <span className="text-xs text-muted-foreground italic">Skipped</span>
                        )}
                        {isMoved && (
                          <span className="text-xs text-muted-foreground italic">Moved</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(parseISO(session.date), 'EEE, MMM d')}
                      </span>
                    </div>

                    <p className="text-sm text-muted-foreground mb-3">
                      {session.rationale}
                    </p>

                    {/* Carry-over indicator */}
                    {session.carryOverExercises && session.carryOverExercises.length > 0 && (
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-2 mb-3">
                        <p className="text-xs text-primary font-medium">
                          + {session.carryOverExercises.length} exercise{session.carryOverExercises.length > 1 ? 's' : ''} carried from skipped session
                        </p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Exercises ({session.exercises.length})
                      </h4>
                      <div className="space-y-1">
                        {session.exercises.slice(0, 3).map((exercise, i) => (
                          <div key={i} className={cn(
                            "flex items-center justify-between text-sm",
                            exercise.isCarryOver && "border-l-2 border-primary/50 pl-2"
                          )}>
                            <span>{exercise.name}</span>
                            <span className="text-muted-foreground text-xs text-right">
                              {exercise.sets && exercise.reps && `${exercise.sets}x${exercise.reps}`}
                              {exercise.weightRange ? (
                                <span className="block text-primary/80">{exercise.weightRange}</span>
                              ) : exercise.percentOfMax ? (
                                <span> @ {exercise.percentOfMax}%</span>
                              ) : null}
                            </span>
                          </div>
                        ))}
                        {session.exercises.length > 3 && (
                          <p className="text-xs text-muted-foreground">
                            +{session.exercises.length - 3} more exercises
                          </p>
                        )}
                      </div>
                    </div>

                    {isSessionToday && !isInactive && !isCompleted && (
                      <Button
                        onClick={() => navigate('/checkin')}
                        variant="gold"
                        size="sm"
                        className="w-full mt-4"
                      >
                        Start Today's Session
                      </Button>
                    )}

                    {/* Skip button for future planned sessions */}
                    {!isSessionToday && !isCompleted && !isInactive && (
                      <button
                        onClick={() => skipSession(session.id)}
                        className="text-xs text-muted-foreground hover:text-foreground mt-3 flex items-center gap-1 transition-colors"
                      >
                        <SkipForward className="w-3 h-3" /> Skip this session
                      </button>
                    )}

                    {isCompleted && (
                      <div className="flex items-center gap-2 mt-3 text-success text-sm">
                        <CheckCircle className="w-4 h-4" />
                        Completed
                      </div>
                    )}
                  </motion.div>
                );
              })}
          </div>

          <div className="space-y-3 pt-4">
            <Button
              onClick={() => navigate('/checkin')}
              variant="gold"
              size="lg"
              className="w-full"
            >
              Start Today's Training
            </Button>
            
            <button 
              onClick={() => {
                generateWeeklyPlan([]);
              }}
              className="w-full text-sm text-muted-foreground py-3 hover:text-foreground transition-colors"
            >
              Need a new plan? Regenerate week
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
