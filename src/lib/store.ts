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
} from './types';
import { 
  generateSessionExercises, 
  generateStopRules, 
  generateTimeGuidance,
  getDaysSinceHeavySession,
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
  
  // Actions
  completeOnboarding: () => void;
  resetApp: () => void;
}

const generateId = () => Math.random().toString(36).substring(2, 11);

// Generate session type sequence based on available days
function getSessionSequence(numDays: number, daysSinceHeavy: number): SessionType[] {
  // Standard 3-day pattern: T-S-H or variations
  if (numDays <= 2) {
    return daysSinceHeavy > 5 ? ['S', 'H'] : ['T', 'S'];
  }
  if (numDays === 3) {
    return ['T', 'S', 'H'];
  }
  if (numDays === 4) {
    return ['T', 'S', 'T2', 'H'];
  }
  // 5+ days
  return ['T', 'S', 'T2', 'S', 'H'];
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
        const daysSinceHeavy = getDaysSinceHeavySession(logs);
        const sessionTypes = getSessionSequence(availableDays.length, daysSinceHeavy);
        
        const sessions: PlannedSession[] = availableDays.map((day, index) => {
          const sessionDate = addDays(weekStart, day === 0 ? 6 : day - 1);
          const type = sessionTypes[index] || 'T';
          const exercises = generateSessionExercises(type);
          const timeGuidance = generateTimeGuidance(type);
          
          return {
            id: generateId(),
            date: format(sessionDate, 'yyyy-MM-dd'),
            dayOfWeek: day,
            type,
            exercises,
            rationale: getRationale(type, index, daysSinceHeavy),
            stopRules: generateStopRules(type, 'good'),
            ifShortOnTime: timeGuidance.short,
            ifExtraTime: timeGuidance.extra,
            completed: false,
          };
        });
        
        // Fill in rest days
        const allDays: PlannedSession[] = [];
        for (let d = 1; d <= 7; d++) {
          const dayNum = d === 7 ? 0 : d;
          const planned = sessions.find(s => s.dayOfWeek === dayNum);
          if (planned) {
            allDays.push(planned);
          } else {
            const sessionDate = addDays(weekStart, d - 1);
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
            });
          }
        }
        
        set({
          currentPlan: {
            id: generateId(),
            weekStartDate: format(weekStart, 'yyyy-MM-dd'),
            weekEndDate: format(weekEnd, 'yyyy-MM-dd'),
            sessions: allDays,
            availableDays,
            generatedAt: new Date().toISOString(),
          },
        });
      },
      
      markSessionComplete: (sessionId) => set((state) => ({
        currentPlan: state.currentPlan ? {
          ...state.currentPlan,
          sessions: state.currentPlan.sessions.map(s =>
            s.id === sessionId ? { ...s, completed: true } : s
          ),
        } : null,
      })),
      
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
  store.completeOnboarding();
}
