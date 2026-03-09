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
  notes?: string;
  isPR?: boolean;
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
}

export interface WeeklyPlan {
  id: string;
  weekStartDate: string;
  weekEndDate: string;
  sessions: PlannedSession[];
  availableDays: number[];
  generatedAt: string;
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

// Demo data types
export interface DemoData {
  profile: AthleteProfile;
  prs: PR[];
  weeklyPlan: WeeklyPlan | null;
  trainingLog: LoggedSession[];
  preferences: Preferences;
}
