import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Plus, Calendar, RefreshCw, CheckCircle, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SessionBadge } from '@/components/SessionBadge';
import { useAppStore } from '@/lib/store';
import { format, parseISO, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { ProgramWeekView } from '@/components/ProgramWeekView';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function WeeklyPlan() {
  const navigate = useNavigate();
  const { 
    profile, 
    currentPlan, 
    generateWeeklyPlan,
    markSessionComplete,
    activeProgram,
    fetchActiveProgram,
    getCurrentProgramWeek,
  } = useAppStore();
  
  const [selectedDays, setSelectedDays] = useState<number[]>(profile?.preferredDays || [1, 3, 5]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewWeek, setViewWeek] = useState<number | null>(null);

  useEffect(() => {
    fetchActiveProgram();
  }, []);

  useEffect(() => {
    if (activeProgram && viewWeek === null) {
      setViewWeek(getCurrentProgramWeek());
    }
  }, [activeProgram]);

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
    return (
      <div className="min-h-screen px-4 py-6 pb-24">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-2xl font-bold mb-1">{activeProgram.name}</h1>
          <p className="text-muted-foreground text-sm">
            {activeProgram.description || `${activeProgram.weeks}-week program`}
          </p>
        </motion.div>

        {/* Week Navigator */}
        <div className="flex items-center justify-between bg-card rounded-xl border border-border p-3 mb-4">
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

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${((getCurrentProgramWeek() || 1) / activeProgram.weeks) * 100}%` }}
            />
          </div>
        </div>

        <ProgramWeekView
          sessions={activeProgram.program_sessions?.filter(s => s.week_number === viewWeek) || []}
          onStartSession={() => navigate('/checkin')}
        />
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
                    {session.completed && (
                      <CheckCircle className="w-4 h-4 text-success mt-2" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            {currentPlan.sessions
              .filter(s => s.type !== 'REST')
              .map((session) => {
                const isSessionToday = isToday(parseISO(session.date));
                
                return (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "bg-card rounded-xl border border-border p-4",
                      isSessionToday && "border-primary/30 bg-primary/5"
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <SessionBadge type={session.type} size="md" showLabel />
                        {isSessionToday && (
                          <div className="px-2 py-1 bg-primary/10 rounded text-xs font-bold text-primary">
                            Today
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(parseISO(session.date), 'EEE, MMM d')}
                      </span>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-3">
                      {session.rationale}
                    </p>
                    
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Exercises ({session.exercises.length})
                      </h4>
                      <div className="space-y-1">
                        {session.exercises.slice(0, 3).map((exercise, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span>{exercise.name}</span>
                            <span className="text-muted-foreground text-xs">
                              {exercise.sets && exercise.reps && `${exercise.sets}x${exercise.reps}`}
                              {exercise.percentOfMax && ` @ ${exercise.percentOfMax}%`}
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
                    
                    {isSessionToday && (
                      <Button
                        onClick={() => navigate('/checkin')}
                        variant="gold"
                        size="sm"
                        className="w-full mt-4"
                      >
                        Start Today's Session
                      </Button>
                    )}
                    
                    {session.completed && (
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
