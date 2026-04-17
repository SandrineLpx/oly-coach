import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  AthleteProfile, 
  PR, 
  WeeklyPlan, 
  LoggedSession, 
  Preferences, 
  ReadinessCheck,
  PlannedSession,
  SessionType,
  BodyWeightEntry,
  Program,
} from './types';
import {
  generateSessionExercises,
  generateStopRules,
  generateTimeGuidance,
  getDaysSinceHeavySession,
  resolveExerciseWeights,
  shouldAddT2,
  computeCarryOver,
  generateProtectionRule,
  generateCardioSuggestion,
  computeTaperAdjustments,
} from './training-logic';
import { addDays, format, startOfWeek, endOfWeek, parseISO, isToday, isSameDay, subDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface AppState {
  // Onboarding
  onboardingComplete: boolean;
  
  // Profile
  profile: AthleteProfile | null;
  setProfile: (profile: AthleteProfile) => void;
  
  // PRs
  prs: PR[];
  addPR: (pr: PR) => void;
  updatePR: (id: string, pr: Partial<PR>) => void;
  
  // Weekly Plan
  currentPlan: WeeklyPlan | null;
  generateWeeklyPlan: (availableDays: number[]) => void;
  markSessionComplete: (sessionId: string) => void;
  skipSession: (sessionId: string) => void;
  moveSession: (sessionId: string, newDate: string) => void;
  
  // Training Log
  trainingLog: LoggedSession[];
  logSession: (session: LoggedSession) => void;
  
  // Body Weight
  bodyWeightLog: BodyWeightEntry[];
  logBodyWeight: (entry: Omit<BodyWeightEntry, 'id'>) => void;
  deleteBodyWeight: (id: string) => void;
  getRecentWeights: (days: number) => BodyWeightEntry[];
  
  // Preferences
  preferences: Preferences;
  updatePreferences: (prefs: Partial<Preferences>) => void;
  
  // Readiness
  todayReadiness: ReadinessCheck | null;
  setReadiness: (check: ReadinessCheck) => void;
  
  // Computed
  getTodaySession: () => PlannedSession | null;
  getRecentLog: (days: number) => LoggedSession[];
  
  // Program
  activeProgram: Program | null;
  fetchActiveProgram: () => Promise<void>;
  getCurrentProgramWeek: () => number | null;
  
  // Actions
  completeOnboarding: () => void;
  resetApp: () => void;
  deletePR: (id: string) => void;
  saveProgram: (parsed: any, startDate: string, opts?: { published?: boolean }) => Promise<string>;
  recordPRHistory: (entry: { lift_name: string; weight: number; unit: string; achieved_at: string }) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 11);

// Generate session type sequence based on available days
function getSessionSequence(
  numDays: number,
  daysSinceHeavy: number,
  includeT2: boolean = true,
): SessionType[] {
  let sequence: SessionType[];

  if (numDays <= 1) {
    sequence = daysSinceHeavy >= 5 ? ['H'] : ['T'];
  } else if (numDays === 2) {
    sequence = daysSinceHeavy >= 5 ? ['S', 'H'] : ['T', 'S'];
  } else if (numDays === 3) {
    sequence = ['T', 'S', 'H'];
  } else if (numDays === 4) {
    sequence = includeT2 ? ['T', 'S', 'T2', 'H'] : ['T', 'S', 'S', 'H'];
  } else {
    sequence = includeT2 ? ['T', 'S', 'T2', 'S', 'H'] : ['T', 'S', 'S', 'S', 'H'];
  }

  // Heavy work drought override: ensure H is in the sequence for 3+ days
  if (daysSinceHeavy >= 5 && numDays >= 3 && !sequence.includes('H')) {
    sequence[sequence.length - 1] = 'H';
  }

  return sequence;
}

const defaultPreferences: Preferences = {
  units: 'kg',
  restDayReminders: true,
  prCelebrations: true,
  darkMode: true,
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      onboardingComplete: false,
      profile: null,
      prs: [],
      currentPlan: null,
      trainingLog: [],
      bodyWeightLog: [],
      preferences: defaultPreferences,
      todayReadiness: null,
      activeProgram: null,

      setProfile: (profile) => {
        set({ profile });
        // Persist to database asynchronously
        (async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          const row = {
            user_id: user.id,
            name: profile.name,
            training_age: profile.trainingAge,
            preferred_days: profile.preferredDays,
            program_start_date: profile.programStartDate,
            strava_connected: profile.stravaConnected,
            weather_preference: profile.weatherPreference,
            cardio_preference: profile.cardioPreference,
          };
          await supabase
            .from('athlete_profiles')
            .upsert(row, { onConflict: 'user_id' });
        })();
      },
      
      addPR: (pr) => set((state) => {
        const existing = state.prs.find(
          p => p.liftName.toLowerCase() === pr.liftName.toLowerCase()
        );
        if (existing && pr.weight > existing.weight) {
          return {
            prs: state.prs.map(p => 
              p.id === existing.id ? { ...pr, id: existing.id } : p
            ),
          };
        }
        if (!existing) {
          return { prs: [...state.prs, pr] };
        }
        return state;
      }),
      
      updatePR: (id, updates) => set((state) => ({
        prs: state.prs.map(p => p.id === id ? { ...p, ...updates } : p),
      })),
      
      generateWeeklyPlan: (availableDays) => {
        const today = new Date();
        const weekStart = startOfWeek(today, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

        const logs = get().trainingLog;
        const prs = get().prs;
        const profile = get().profile;
        const preferences = get().preferences;
        const daysSinceHeavy = getDaysSinceHeavySession(logs);

        // Compute week number for periodization
        let weekNumber = 1;
        if (profile?.programStartDate) {
          const start = new Date(profile.programStartDate);
          weekNumber = Math.max(1, Math.floor((today.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1);
        }

        // T2 intelligence: check if we should include T2
        const recentLogs = get().getRecentLog(7);
        const t2Decision = shouldAddT2(recentLogs, 'good', weekNumber);
        const includeT2 = t2Decision.add;

        const sessionTypes = getSessionSequence(availableDays.length, daysSinceHeavy, includeT2);

        const sessions: PlannedSession[] = availableDays.map((day, index) => {
          const sessionDate = addDays(weekStart, day === 0 ? 6 : day - 1);
          const dateStr = format(sessionDate, 'yyyy-MM-dd');
          let type = sessionTypes[index] || 'T';

          // Competition taper adjustments
          if (profile?.competitionDate) {
            const taper = computeTaperAdjustments(profile.competitionDate, dateStr, type);
            if (taper?.overrideType) {
              type = taper.overrideType;
            }
          }

          let exercises = generateSessionExercises(type, false, weekNumber);

          // Resolve weights from PRs
          exercises = resolveExerciseWeights(exercises, prs, 'good', preferences.units);

          const timeGuidance = generateTimeGuidance(type, exercises);

          // Competition taper note
          let rationale = getRationale(type, index, daysSinceHeavy);
          if (profile?.competitionDate) {
            const taper = computeTaperAdjustments(profile.competitionDate, dateStr, type);
            if (taper) {
              rationale = taper.note;
            }
          }

          return {
            id: generateId(),
            date: dateStr,
            dayOfWeek: day,
            type,
            exercises,
            rationale,
            stopRules: generateStopRules(type, 'good'),
            ifShortOnTime: timeGuidance.short,
            ifExtraTime: timeGuidance.extra,
            completed: false,
            status: 'planned' as const,
          };
        });

        // Fill in rest days with cardio suggestions
        const allDays: PlannedSession[] = [];
        let restDayIndex = 0;
        for (let d = 1; d <= 7; d++) {
          const dayNum = d === 7 ? 0 : d;
          const planned = sessions.find(s => s.dayOfWeek === dayNum);
          if (planned) {
            allDays.push(planned);
          } else {
            const sessionDate = addDays(weekStart, d - 1);
            const totalRestDays = 7 - availableDays.length;
            const cardioSuggestion = profile?.cardioPreference
              ? generateCardioSuggestion(profile.cardioPreference, restDayIndex, totalRestDays) || undefined
              : undefined;
            restDayIndex++;

            allDays.push({
              id: generateId(),
              date: format(sessionDate, 'yyyy-MM-dd'),
              dayOfWeek: dayNum,
              type: 'REST',
              exercises: [],
              rationale: 'Recovery day for optimal adaptation.',
              stopRules: [],
              ifShortOnTime: '',
              ifExtraTime: 'Light mobility or easy walk if desired.',
              completed: false,
              status: 'planned' as const,
              cardioSuggestion,
            });
          }
        }

        // Generate protection rule
        const protectionRule = generateProtectionRule(allDays) || undefined;

        set({
          currentPlan: {
            id: generateId(),
            weekStartDate: format(weekStart, 'yyyy-MM-dd'),
            weekEndDate: format(weekEnd, 'yyyy-MM-dd'),
            sessions: allDays,
            availableDays,
            generatedAt: new Date().toISOString(),
            protectionRule,
          },
        });
      },
      
      markSessionComplete: (sessionId) => set((state) => ({
        currentPlan: state.currentPlan ? {
          ...state.currentPlan,
          sessions: state.currentPlan.sessions.map(s =>
            s.id === sessionId ? { ...s, completed: true, status: 'completed' as const } : s
          ),
        } : null,
      })),

      skipSession: (sessionId) => set((state) => {
        if (!state.currentPlan) return state;

        const skipped = state.currentPlan.sessions.find(s => s.id === sessionId);
        if (!skipped || skipped.type === 'REST') return state;

        // Compute carry-over exercises from the skipped session
        const carryOverExercises = computeCarryOver(skipped.exercises);

        // Find next planned (non-completed, non-skipped, non-REST) session
        const skippedIdx = state.currentPlan.sessions.findIndex(s => s.id === sessionId);
        const nextSession = state.currentPlan.sessions.find((s, idx) =>
          idx > skippedIdx && s.type !== 'REST' && s.status !== 'completed' && s.status !== 'skipped'
        );

        return {
          currentPlan: {
            ...state.currentPlan,
            sessions: state.currentPlan.sessions.map(s => {
              if (s.id === sessionId) {
                return { ...s, status: 'skipped' as const };
              }
              if (nextSession && s.id === nextSession.id && carryOverExercises.length > 0) {
                // Add carry-over exercises and trim accessories to compensate
                const trimmed = s.exercises.slice(0, -carryOverExercises.length);
                return {
                  ...s,
                  carryOverExercises,
                  exercises: [...trimmed, ...carryOverExercises],
                };
              }
              return s;
            }),
          },
        };
      }),

      moveSession: (sessionId, newDate) => set((state) => {
        if (!state.currentPlan) return state;
        return {
          currentPlan: {
            ...state.currentPlan,
            sessions: state.currentPlan.sessions.map(s => {
              if (s.id === sessionId) {
                return { ...s, status: 'moved' as const, date: newDate };
              }
              return s;
            }),
          },
        };
      }),
      
      logSession: (session) => set((state) => ({
        trainingLog: [...state.trainingLog, session],
      })),
      
      updatePreferences: (prefs) => set((state) => ({
        preferences: { ...state.preferences, ...prefs },
      })),
      
      setReadiness: (check) => set({ todayReadiness: check }),

      logBodyWeight: (entry) => {
        const id = generateId();
        const fullEntry: BodyWeightEntry = { ...entry, id };
        set((state) => ({
          bodyWeightLog: [...state.bodyWeightLog, fullEntry],
        }));
        // Persist to database
        (async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          await supabase.from('body_weight_logs').insert({
            id,
            user_id: user.id,
            weight: entry.weight,
            unit: entry.unit,
            logged_at: entry.date,
          });
        })();
      },

      deleteBodyWeight: (id) => {
        set((state) => ({
          bodyWeightLog: state.bodyWeightLog.filter(e => e.id !== id),
        }));
        (async () => {
          await supabase.from('body_weight_logs').delete().eq('id', id);
        })();
      },

      getRecentWeights: (days) => {
        const cutoff = subDays(new Date(), days);
        return get().bodyWeightLog
          .filter(e => parseISO(e.date) >= cutoff)
          .sort((a, b) => a.date.localeCompare(b.date));
      },
      
      getTodaySession: () => {
        const plan = get().currentPlan;
        if (!plan) return null;
        const today = new Date();
        return plan.sessions.find(s => isToday(parseISO(s.date))) || null;
      },
      
      getRecentLog: (days) => {
        const logs = get().trainingLog;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        return logs.filter(l => new Date(l.date) >= cutoff);
      },
      
      completeOnboarding: () => set({ onboardingComplete: true }),
      
      resetApp: () => set({
        onboardingComplete: false,
        profile: null,
        prs: [],
        currentPlan: null,
        trainingLog: [],
        bodyWeightLog: [],
        preferences: defaultPreferences,
        todayReadiness: null,
      }),

      deletePR: (id) => set((state) => ({
        prs: state.prs.filter(p => p.id !== id),
      })),

      saveProgram: async (parsed: any, startDate: string, opts?: { published?: boolean }) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Deactivate existing active programs
        await supabase
          .from('programs')
          .update({ is_active: false })
          .eq('user_id', user.id)
          .eq('is_active', true);

        // Insert program
        const { data: program, error: progErr } = await supabase
          .from('programs')
          .insert({
            user_id: user.id,
            name: parsed.name,
            description: parsed.description ?? null,
            phase_summary: parsed.phase_summary ?? null,
            weeks: parsed.weeks,
            start_date: startDate,
            is_active: true,
            published: opts?.published ?? false,
          })
          .select()
          .single();

        if (progErr || !program) throw progErr || new Error('Failed to create program');

        // Insert sessions and exercises
        for (const session of parsed.sessions) {
          const { data: sess, error: sessErr } = await supabase
            .from('program_sessions')
            .insert({
              program_id: program.id,
              week_number: session.week_number,
              day_of_week: session.day_of_week,
              session_type: session.session_type || 'T',
              name: session.name || null,
              notes: session.notes || null,
              order_index: session.week_number * 10 + session.day_of_week,
              priority: session.priority ?? 'primary',
              droppable: session.droppable ?? false,
              focus_label: session.focus_label ?? null,
              // can_merge_into stays null for now — handled in a later step
            })
            .select()
            .single();

          if (sessErr || !sess) throw sessErr || new Error('Failed to create session');

          if (session.exercises?.length > 0) {
            const exRows = session.exercises.map((ex: any) => ({
              session_id: sess.id,
              name: ex.name,
              sets: ex.sets ?? null,
              reps: ex.reps ?? null,
              percent_of_max: ex.percent_of_max ?? null,
              notes: ex.notes ?? null,
              order_index: ex.order_index ?? 0,
            }));

            const { error: exErr } = await supabase
              .from('program_exercises')
              .insert(exRows);

            if (exErr) throw exErr;
          }
        }

        // Refresh active program in store
        await get().fetchActiveProgram();
        return program.id as string;
      },

      recordPRHistory: (entry) => {
        (async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          await supabase.from('pr_history').insert({
            user_id: user.id,
            lift_name: entry.lift_name,
            weight: entry.weight,
            unit: entry.unit,
            achieved_at: entry.achieved_at,
          });
        })();
      },

      fetchActiveProgram: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: program } = await supabase
          .from('programs')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();
        if (!program) { set({ activeProgram: null }); return; }
        const { data: sessions } = await supabase
          .from('program_sessions')
          .select('*, program_exercises(*)')
          .eq('program_id', program.id)
          .order('week_number')
          .order('day_of_week');
        set({ activeProgram: { ...program, program_sessions: sessions || [] } as Program });
      },

      getCurrentProgramWeek: () => {
        const prog = get().activeProgram;
        if (!prog) return null;
        const start = new Date(prog.start_date);
        const now = new Date();
        const diffMs = now.getTime() - start.getTime();
        const week = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
        return Math.max(1, Math.min(week, prog.weeks));
      },
    }),
    {
      name: 'train-smart-storage',
    }
  )
);

function getRationale(type: SessionType, dayIndex: number, daysSinceHeavy: number): string {
  switch (type) {
    case 'T':
      return dayIndex === 0 
        ? 'Starting the week with technique work to groove patterns after rest.'
        : 'Technique session to refine positions without accumulating fatigue.';
    case 'S':
      return 'Building strength foundation with moderate intensity lifts.';
    case 'H':
      return daysSinceHeavy >= 5
        ? 'Time for heavy work—it\'s been a while since your last max effort day.'
        : 'End-of-week heavy session when you\'re primed and recovered.';
    case 'T2':
      return 'Technical-strength hybrid to bridge light and heavy work.';
    default:
      return 'Recovery time.';
  }
}

// Demo data initialization
export function loadDemoData() {
  const store = useAppStore.getState();
  
  if (store.onboardingComplete) return;
  
  store.setProfile({
    name: 'Alex Chen',
    trainingAge: 3,
    preferredDays: [1, 3, 5], // Mon, Wed, Fri
    programStartDate: '2024-01-15',
    stravaConnected: false,
    weatherPreference: 'both',
    cardioPreference: 'running',
  });
  
  const demoPRs: PR[] = [
    { id: generateId(), liftName: 'Snatch', weight: 85, unit: 'kg', date: '2024-02-10' },
    { id: generateId(), liftName: 'Clean & Jerk', weight: 105, unit: 'kg', date: '2024-02-15' },
    { id: generateId(), liftName: 'Back Squat', weight: 140, unit: 'kg', date: '2024-01-20' },
    { id: generateId(), liftName: 'Front Squat', weight: 115, unit: 'kg', date: '2024-02-01' },
    { id: generateId(), liftName: 'Power Snatch', weight: 70, unit: 'kg', date: '2024-02-20' },
    { id: generateId(), liftName: 'Power Clean', weight: 90, unit: 'kg', date: '2024-02-18' },
  ];
  
  demoPRs.forEach(pr => store.addPR(pr));
  
  // Generate a plan
  store.generateWeeklyPlan([1, 3, 5]);
  
  // Add some recent training log entries
  const demoLogs: LoggedSession[] = [
    {
      id: generateId(),
      date: format(addDays(new Date(), -5), 'yyyy-MM-dd'),
      sessionType: 'T',
      exercises: generateSessionExercises('T'),
      asPlanned: true,
      rpe: 6,
      sleep: 'good',
      soreness: 3,
      notes: 'Good positions on snatch. Clean felt a bit off.',
      newPRs: [],
    },
    {
      id: generateId(),
      date: format(addDays(new Date(), -3), 'yyyy-MM-dd'),
      sessionType: 'S',
      exercises: generateSessionExercises('S'),
      asPlanned: true,
      rpe: 7,
      sleep: 'ok',
      soreness: 4,
      notes: 'Squats felt strong. Good session overall.',
      newPRs: [],
    },
  ];
  
  demoLogs.forEach(log => store.logSession(log));
  
  // Demo body weight entries (last 14 days)
  const baseWeight = 78;
  for (let i = 13; i >= 0; i--) {
    const variation = (Math.random() - 0.5) * 1.2;
    const trend = -0.03 * i; // slight downward trend
    store.logBodyWeight({
      weight: parseFloat((baseWeight + trend + variation).toFixed(1)),
      unit: 'kg',
      date: format(subDays(new Date(), i), 'yyyy-MM-dd'),
    });
  }
  
  store.completeOnboarding();
}
