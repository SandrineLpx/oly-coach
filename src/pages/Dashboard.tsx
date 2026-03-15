import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  PlayCircle, Calendar, ChevronRight, Clock,
  TrendingUp, Dumbbell, Flame, AlertTriangle, Settings, CloudSun
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SessionBadge } from '@/components/SessionBadge';
import { ReadinessIndicator } from '@/components/ReadinessIndicator';
import { useAppStore, loadDemoData } from '@/lib/store';
import { calculateReadiness, getDaysSinceHeavySession } from '@/lib/training-logic';
import { fetchWeeklyForecast, DailyForecast, formatForecastShort, getWeatherDescription } from '@/lib/weather';
import { format, isToday, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const navigate = useNavigate();
  const { 
    profile, 
    currentPlan, 
    trainingLog, 
    prs, 
    todayReadiness,
    onboardingComplete,
    getTodaySession 
  } = useAppStore();

  const [weather, setWeather] = useState<DailyForecast[]>([]);

  useEffect(() => {
    if (!onboardingComplete) {
      loadDemoData();
    }
  }, [onboardingComplete]);

  // Fetch weather if location is set
  useEffect(() => {
    if (profile?.location) {
      fetchWeeklyForecast(
        profile.location.lat,
        profile.location.lon,
        profile.outdoorThresholds,
      ).then(setWeather).catch(() => {});
    }
  }, [profile?.location?.lat, profile?.location?.lon]);

  const todaySession = getTodaySession();
  const recentLogs = trainingLog.slice(-5).reverse();
  const readiness = todayReadiness ? calculateReadiness(todayReadiness) : null;
  const daysSinceHeavy = getDaysSinceHeavySession(trainingLog);
  const topPRs = prs.slice(0, 3);

  // Calculate weekly stats
  const thisWeekLogs = currentPlan 
    ? trainingLog.filter(log => {
        const logDate = parseISO(log.date);
        const weekStart = parseISO(currentPlan.weekStartDate);
        return logDate >= weekStart;
      })
    : [];

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen px-4 py-6 pb-24">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 flex items-start justify-between"
      >
        <div>
          <p className="text-muted-foreground text-sm">
            {format(new Date(), 'EEEE, MMM d')}
          </p>
          <h1 className="text-2xl font-bold mt-1">
            Hey, <span className="text-gradient-gold">{profile?.name || 'Athlete'}</span>
          </h1>
        </div>
        <button onClick={() => navigate('/settings')} className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-card transition-colors">
          <Settings className="w-5 h-5" />
        </button>
      </motion.div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-4"
      >
        {/* Today's Session Card */}
        <motion.div variants={item}>
          <div 
            onClick={() => navigate('/checkin')}
            className={cn(
              "relative overflow-hidden rounded-2xl p-5 cursor-pointer",
              "bg-card-gradient border border-border",
              "transition-all hover:border-primary/30 active:scale-[0.99]"
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">Today's Training</p>
                {todaySession && todaySession.type !== 'REST' ? (
                  <>
                    <div className="flex items-center gap-3 mb-3">
                      <SessionBadge type={todaySession.type} size="lg" />
                      <div>
                        <p className="font-bold text-xl">
                          {todaySession.type === 'T' && 'Technique Day'}
                          {todaySession.type === 'S' && 'Strength Day'}
                          {todaySession.type === 'H' && 'Heavy Day'}
                          {todaySession.type === 'T2' && 'Tech-Strength'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {todaySession.exercises.length} exercises planned
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="gold" 
                      size="lg" 
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/checkin');
                      }}
                    >
                      <PlayCircle className="w-5 h-5" />
                      Start Check-In
                    </Button>
                  </>
                ) : todaySession?.type === 'REST' ? (
                  <div className="py-4">
                    <p className="text-xl font-bold text-muted-foreground">Rest Day</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Recovery is when you grow stronger
                    </p>
                  </div>
                ) : (
                  <div className="py-4">
                    <p className="text-lg font-bold">No plan yet</p>
                    <Button 
                      variant="outline" 
                      className="mt-3"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/plan');
                      }}
                    >
                      Create Weekly Plan
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
              
              {readiness && (
                <ReadinessIndicator 
                  score={readiness.score} 
                  level={readiness.level}
                  size="md"
                  className="ml-4"
                />
              )}
            </div>
            
            {/* Decorative gradient */}
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-primary/5 rounded-full blur-2xl" />
          </div>
        </motion.div>

        {/* Quick Stats Row */}
        <motion.div variants={item} className="grid grid-cols-3 gap-3">
          <div className="bg-card rounded-xl p-3 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <Flame className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Week</span>
            </div>
            <p className="text-2xl font-bold">{thisWeekLogs.length}</p>
            <p className="text-[10px] text-muted-foreground">sessions</p>
          </div>
          
          <div className="bg-card rounded-xl p-3 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-success" />
              <span className="text-xs text-muted-foreground">PRs</span>
            </div>
            <p className="text-2xl font-bold">{prs.length}</p>
            <p className="text-[10px] text-muted-foreground">tracked</p>
          </div>
          
          <div className="bg-card rounded-xl p-3 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <Dumbbell className="w-4 h-4 text-accent" />
              <span className="text-xs text-muted-foreground">Heavy</span>
            </div>
            <p className="text-2xl font-bold">{daysSinceHeavy}</p>
            <p className="text-[10px] text-muted-foreground">days ago</p>
          </div>
        </motion.div>

        {/* Weekly Overview */}
        {currentPlan && (
          <motion.div variants={item}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                This Week
              </h2>
              <button 
                onClick={() => navigate('/plan')}
                className="text-xs text-primary font-medium"
              >
                View Plan
              </button>
            </div>
            
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="grid grid-cols-7">
                {currentPlan.sessions.map((session, i) => {
                  const isSessionToday = isToday(parseISO(session.date));
                  return (
                    <div 
                      key={session.id}
                      className={cn(
                        "flex flex-col items-center py-3 border-r border-border last:border-r-0",
                        isSessionToday && "bg-primary/5"
                      )}
                    >
                      <span className={cn(
                        "text-[10px] font-medium mb-2",
                        isSessionToday ? "text-primary" : "text-muted-foreground"
                      )}>
                        {format(parseISO(session.date), 'EEE')}
                      </span>
                      <SessionBadge type={session.type} size="sm" />
                      {session.completed && (
                        <div className="w-1.5 h-1.5 rounded-full bg-success mt-1.5" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* Weather Widget */}
        {weather.length > 0 && (
          <motion.div variants={item}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Weather
              </h2>
              <CloudSun className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {weather.slice(0, 3).map((day) => (
                <div key={day.date} className={cn(
                  "bg-card rounded-xl p-3 border border-border text-center",
                  day.outdoorSuitable && "border-success/30"
                )}>
                  <p className="text-[10px] text-muted-foreground">
                    {format(parseISO(day.date), 'EEE')}
                  </p>
                  <p className="text-lg font-bold mt-1">{day.tempHighC}°</p>
                  <p className="text-[10px] text-muted-foreground">
                    {getWeatherDescription(day.weatherCode)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {day.precipitationProbability}% rain
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Recent Activity */}
        {recentLogs.length > 0 && (
          <motion.div variants={item}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Recent Training
              </h2>
              <button 
                onClick={() => navigate('/history')}
                className="text-xs text-primary font-medium"
              >
                View All
              </button>
            </div>
            
            <div className="space-y-2">
              {recentLogs.slice(0, 3).map((log) => (
                <div 
                  key={log.id}
                  className="bg-card rounded-xl p-3 border border-border flex items-center gap-3"
                >
                  <SessionBadge type={log.sessionType} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {format(parseISO(log.date), 'EEEE, MMM d')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      RPE {log.rpe} • {log.exercises.length} exercises
                    </p>
                  </div>
                  {log.newPRs.length > 0 && (
                    <div className="px-2 py-1 bg-primary/10 rounded text-[10px] font-bold text-primary">
                      PR!
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Top PRs */}
        {topPRs.length > 0 && (
          <motion.div variants={item}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Top Lifts
              </h2>
              <button 
                onClick={() => navigate('/prs')}
                className="text-xs text-primary font-medium"
              >
                All PRs
              </button>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              {topPRs.map((pr) => (
                <div 
                  key={pr.id}
                  className="bg-card rounded-xl p-3 border border-border text-center"
                >
                  <p className="text-xl font-bold text-primary">{pr.weight}</p>
                  <p className="text-[10px] text-muted-foreground">{pr.unit}</p>
                  <p className="text-xs font-medium mt-1 truncate">{pr.liftName}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Competition taper notice */}
        {profile?.competitionDate && (() => {
          const daysUntil = Math.round((new Date(profile.competitionDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
          if (daysUntil >= 0 && daysUntil <= 10) {
            return (
              <motion.div variants={item}>
                <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 flex items-start gap-3">
                  <Flame className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-primary">
                      {daysUntil === 0 ? 'Competition Day!' : `${daysUntil} days to competition`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {daysUntil > 4 ? 'Taper phase — volume reduced ~30%.' :
                       daysUntil > 1 ? 'Light technique only — stay sharp, stay fresh.' :
                       daysUntil === 1 ? 'Mini technique + mobility tomorrow. Rest up!' :
                       'Give it everything today!'}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          }
          return null;
        })()}

        {/* Warning if heavy day needed */}
        {daysSinceHeavy >= 5 && todaySession?.type !== 'H' && (
          <motion.div variants={item}>
            <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-warning">Time for Heavy Work</p>
                <p className="text-xs text-muted-foreground mt-1">
                  It's been {daysSinceHeavy} days since your last heavy session.
                  Consider prioritizing one this week.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
