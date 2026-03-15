// Type definitions for Train Smart

export type SessionType = 'T' | 'S' | 'H' | 'T2' | 'REST';

export type Sleep = 'good' | 'ok' | 'bad';

export interface AthleteProfile {
  name: string;
  email?: string;
  trainingAge: number; // years of Olympic lifting experience
  preferredDays: number[]; // 0 = Sunday, 1 = Monday, etc.
  programStartDate: string; // ISO date string
  stravaConnected: boolean;
  weatherPreference: 'indoor' | 'outdoor' | 'both';
  cardioPreference: 'running' | 'rowing' | 'cycling' | 'none';
  competitionDate?: string; // ISO date string, triggers taper logic
  location?: { lat: number; lon: number };
  outdoorThresholds?: {
    maxPrecipPct: number;
    minTempC: number;
    maxWindKmh: number;
  };
}

export interface PR {
  id: string;
  liftName: string;
  weight: number;
  unit: 'kg' | 'lb';
  date: string;
  notes?: string;
}

export interface Exercise {
  name: string;
  sets?: string;
  reps?: string;
  percentOfMax?: number;
  weight?: number;
  weightRange?: string; // e.g. "56-60kg (75-80% of 75kg PR)"
  notes?: string;
  isPR?: boolean;
  isCarryOver?: boolean; // carried from a skipped session
}

export interface PlannedSession {
  id: string;
  date: string;
  dayOfWeek: number;
  type: SessionType;
  exercises: Exercise[];
  adjustments?: string;
  rationale: string;
  stopRules: string[];
  ifShortOnTime: string;
  ifExtraTime: string;
  cardioSuggestion?: string;
  completed: boolean;
  status?: 'planned' | 'completed' | 'moved' | 'skipped';
  carryOverExercises?: Exercise[];
}

export interface WeeklyPlan {
  id: string;
  weekStartDate: string;
  weekEndDate: string;
  sessions: PlannedSession[];
  availableDays: number[];
  generatedAt: string;
  protectionRule?: string;
}

export interface ReadinessCheck {
  sleep: Sleep;
  legSoreness: number; // 0-10
  energy: number; // 1-5
  timestamp: string;
}

export interface LoggedSession {
  id: string;
  date: string;
  sessionType: SessionType;
  plannedSessionId?: string;
  exercises: Exercise[];
  asPlanned: boolean;
  rpe: number; // 1-10
  sleep: Sleep;
  soreness: number;
  notes: string;
  newPRs: string[]; // lift names
  duration?: number; // minutes
}

export interface StravaActivity {
  id: string;
  name: string;
  type: string;
  date: string;
  duration: number;
  distance?: number;
}

export interface Preferences {
  units: 'kg' | 'lb';
  restDayReminders: boolean;
  prCelebrations: boolean;
  darkMode: boolean; // Always dark, but we keep it
}

export interface BodyWeightEntry {
  id: string;
  weight: number;
  unit: 'kg' | 'lb';
  date: string; // ISO date string (YYYY-MM-DD)
}

// Program types (backend-driven)
export interface ProgramExercise {
  id: string;
  session_id: string;
  name: string;
  sets: number | null;
  reps: string | null;
  weight: number | null;
  percent_of_max: number | null;
  notes: string | null;
  order_index: number;
}

export interface ProgramSession {
  id: string;
  program_id: string;
  week_number: number;
  day_of_week: number;
  session_type: string;
  name: string | null;
  notes: string | null;
  order_index: number;
  program_exercises?: ProgramExercise[];
}

export interface Program {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  start_date: string;
  weeks: number;
  is_active: boolean;
  created_at: string;
  program_sessions?: ProgramSession[];
}

// Demo data types
export interface DemoData {
  profile: AthleteProfile;
  prs: PR[];
  weeklyPlan: WeeklyPlan | null;
  trainingLog: LoggedSession[];
  preferences: Preferences;
  bodyWeightLog: BodyWeightEntry[];
}
