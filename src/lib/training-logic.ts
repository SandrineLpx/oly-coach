// Training decision logic for Train Smart
import { SessionType, Sleep, ReadinessCheck, LoggedSession, Exercise, PlannedSession, PR } from './types';

export interface ReadinessScore {
  score: number; // 0-100
  level: 'good' | 'mid' | 'low';
  recommendation: SessionType;
  reasoning: string;
}

export function calculateReadiness(check: ReadinessCheck): ReadinessScore {
  let score = 70; // Base score
  let issues: string[] = [];

  // Sleep impact (high weight)
  if (check.sleep === 'good') {
    score += 15;
  } else if (check.sleep === 'ok') {
    score += 0;
  } else {
    score -= 25;
    issues.push('poor sleep');
  }

  // Leg soreness impact
  if (check.legSoreness >= 8) {
    score -= 30;
    issues.push('high soreness');
  } else if (check.legSoreness >= 6) {
    score -= 20;
    issues.push('moderate soreness');
  } else if (check.legSoreness >= 4) {
    score -= 10;
  }

  // Energy impact
  score += (check.energy - 3) * 8; // -16 to +16

  score = Math.max(0, Math.min(100, score));

  // Determine recommendation based on score
  let level: ReadinessScore['level'];
  let recommendation: SessionType;
  let reasoning: string;

  if (score >= 70) {
    level = 'good';
    recommendation = 'H'; // Can handle heavy work
    reasoning = 'You\'re recovered and ready for intense work.';
  } else if (score >= 45) {
    level = 'mid';
    recommendation = 'S'; // Strength, not max effort
    reasoning = issues.length > 0 
      ? `Managing ${issues.join(' and ')}. Moderate intensity recommended.`
      : 'Moderate readiness. Strength work is a good choice.';
  } else {
    level = 'low';
    recommendation = 'T'; // Technique only
    reasoning = `Low readiness due to ${issues.join(' and ')}. Focus on movement quality, not load.`;
  }

  return { score, level, recommendation, reasoning };
}

export function adjustSessionType(
  plannedType: SessionType,
  readiness: ReadinessScore,
  recentCardio: boolean,
  daysSinceHeavy: number,
  competitionDate?: string,
  sessionDate?: string,
): { newType: SessionType; reason: string | null } {

  // Never adjust REST
  if (plannedType === 'REST') {
    return { newType: 'REST', reason: null };
  }

  // Competition taper overrides
  if (competitionDate && sessionDate) {
    const taper = computeTaperAdjustments(competitionDate, sessionDate, plannedType);
    if (taper && taper.overrideType) {
      return { newType: taper.overrideType, reason: taper.note };
    }
  }

  // Low readiness: always technique
  if (readiness.level === 'low') {
    if (plannedType === 'H' || plannedType === 'S') {
      return {
        newType: 'T',
        reason: 'Downgraded to technique work due to low readiness.'
      };
    }
  }

  // Medium readiness + planned heavy: downgrade to strength
  if (readiness.level === 'mid' && plannedType === 'H') {
    return {
      newType: 'S',
      reason: 'Downgraded from heavy to strength work due to moderate readiness.'
    };
  }

  // Recent hard cardio: avoid heavy
  if (recentCardio && (plannedType === 'H' || plannedType === 'S')) {
    const downTo = plannedType === 'H' ? 'S' : 'T';
    return {
      newType: downTo,
      reason: 'Downgraded due to recent intense cardio activity.'
    };
  }

  // Heavy work drought: upgrade if readiness is good
  if (daysSinceHeavy >= 5 && readiness.level === 'good' && plannedType !== 'H') {
    return {
      newType: 'H',
      reason: `Upgraded to heavy work — it's been ${daysSinceHeavy} days since your last heavy session.`
    };
  }

  return { newType: plannedType, reason: null };
}

// Keep backward-compatible alias
export const shouldDowngradeSession = adjustSessionType;

export function shouldPrioritizeHeavy(
  daysSinceHeavy: number,
  readinessLevel: 'good' | 'mid' | 'low'
): boolean {
  // If no heavy work in 5-7 days and readiness is good, prioritize heavy
  return daysSinceHeavy >= 5 && readinessLevel === 'good';
}

export function getDaysSinceHeavySession(logs: LoggedSession[]): number {
  const heavySessions = logs.filter(l => l.sessionType === 'H');
  if (heavySessions.length === 0) return 999;
  
  const lastHeavy = new Date(heavySessions[heavySessions.length - 1].date);
  const now = new Date();
  const diffTime = now.getTime() - lastHeavy.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// Exercise library for Olympic weightlifting
export const OLYMPIC_LIFTS = [
  'Snatch',
  'Clean & Jerk',
  'Power Snatch',
  'Power Clean',
  'Hang Snatch',
  'Hang Clean',
  'Snatch Pull',
  'Clean Pull',
  'Overhead Squat',
  'Snatch Balance',
  'Jerk',
  'Push Jerk',
  'Split Jerk',
];

export const STRENGTH_EXERCISES = [
  'Back Squat',
  'Front Squat',
  'Deadlift',
  'Romanian Deadlift',
  'Push Press',
  'Strict Press',
  'Bent Over Row',
  'Pendlay Row',
];

export const ACCESSORY_EXERCISES = [
  'Good Mornings',
  'Hip Thrusts',
  'Lunges',
  'Bulgarian Split Squat',
  'Core Work',
  'Back Extensions',
  'Pull-ups',
  'Dips',
];

export function generateSessionExercises(
  type: SessionType,
  isPRDay: boolean = false,
  weekNumber: number = 1,
): Exercise[] {
  const isOddWeek = weekNumber % 2 === 1; // Odd = Snatch emphasis, Even = C&J emphasis

  switch (type) {
    case 'T': // Technique
      return isOddWeek ? [
        { name: 'Muscle Snatch', sets: '3', reps: '3', notes: 'Light, focus on positions' },
        { name: 'Snatch from Blocks', sets: '5', reps: '2', percentOfMax: 60, notes: 'Pause at knee' },
        { name: 'Snatch Pull', sets: '4', reps: '3', percentOfMax: 65, notes: 'Speed pull, hold at hip' },
        { name: 'Front Squat', sets: '3', reps: '5', percentOfMax: 65, notes: 'Tempo: 3 sec down' },
        { name: 'Core Work', sets: '3', reps: '10', notes: 'Hollow holds or planks' },
      ] : [
        { name: 'Muscle Clean', sets: '3', reps: '3', notes: 'Light, focus on turnover' },
        { name: 'Clean from Hang', sets: '5', reps: '2', percentOfMax: 60, notes: 'Pause at knee' },
        { name: 'Jerk from Rack', sets: '4', reps: '2', percentOfMax: 60, notes: 'Focus on dip & drive' },
        { name: 'Front Squat', sets: '3', reps: '5', percentOfMax: 65, notes: 'Tempo: 3 sec down' },
        { name: 'Core Work', sets: '3', reps: '10', notes: 'Hollow holds or planks' },
      ];

    case 'S': // Strength
      return isOddWeek ? [
        { name: 'Power Snatch', sets: '4', reps: '2', percentOfMax: 75 },
        { name: 'Snatch Pull', sets: '4', reps: '3', percentOfMax: 80, notes: 'Above knee, controlled' },
        { name: 'Back Squat', sets: '5', reps: '3', percentOfMax: 80 },
        { name: 'Push Press', sets: '4', reps: '4', percentOfMax: 75 },
        { name: 'Romanian Deadlift', sets: '3', reps: '8', notes: 'Moderate load' },
        { name: 'Pull-ups', sets: '3', reps: '8-10' },
      ] : [
        { name: 'Power Clean', sets: '4', reps: '2', percentOfMax: 75 },
        { name: 'Clean Pull', sets: '4', reps: '3', percentOfMax: 80, notes: 'Controlled extension' },
        { name: 'Front Squat', sets: '5', reps: '5', percentOfMax: 75 },
        { name: 'Push Press', sets: '4', reps: '4', percentOfMax: 75 },
        { name: 'Romanian Deadlift', sets: '3', reps: '8', notes: 'Moderate load' },
        { name: 'Pull-ups', sets: '3', reps: '8-10' },
      ];

    case 'H': // Heavy
      return isOddWeek ? [
        { name: 'Snatch', sets: '6', reps: '1', percentOfMax: isPRDay ? 100 : 90, notes: isPRDay ? 'PR attempt!' : 'Work up to heavy single' },
        { name: 'Clean & Jerk', sets: '4', reps: '1+1', percentOfMax: isPRDay ? 95 : 85, notes: 'Supporting work' },
        { name: 'Front Squat', sets: '4', reps: '2', percentOfMax: 85, notes: 'Heavy doubles' },
        { name: 'Snatch Pull', sets: '3', reps: '3', percentOfMax: 95, notes: 'Above competition max' },
      ] : [
        { name: 'Clean & Jerk', sets: '6', reps: '1+1', percentOfMax: isPRDay ? 100 : 88, notes: isPRDay ? 'PR attempt!' : 'Heavy singles' },
        { name: 'Snatch', sets: '4', reps: '1', percentOfMax: isPRDay ? 95 : 85, notes: 'Supporting work' },
        { name: 'Back Squat', sets: '4', reps: '2', percentOfMax: 85, notes: 'Heavy doubles' },
        { name: 'Clean Pull', sets: '3', reps: '3', percentOfMax: 95, notes: 'Above competition max' },
      ];

    case 'T2': // Hybrid/Technical Strength
      return isOddWeek ? [
        { name: 'Snatch + Hang Snatch', sets: '4', reps: '1+1', percentOfMax: 72 },
        { name: 'Snatch Balance', sets: '4', reps: '2', percentOfMax: 65 },
        { name: 'Overhead Squat', sets: '3', reps: '3', percentOfMax: 70 },
        { name: 'Back Squat', sets: '4', reps: '5', percentOfMax: 75 },
        { name: 'Good Mornings', sets: '3', reps: '10' },
      ] : [
        { name: 'Clean + Front Squat + Jerk', sets: '4', reps: '1+1+1', percentOfMax: 72 },
        { name: 'Jerk Recovery', sets: '4', reps: '2', percentOfMax: 70, notes: 'Catch and stand' },
        { name: 'Overhead Squat', sets: '3', reps: '3', percentOfMax: 70 },
        { name: 'Back Squat', sets: '4', reps: '5', percentOfMax: 75 },
        { name: 'Good Mornings', sets: '3', reps: '10' },
      ];

    default:
      return [];
  }
}

export function generateStopRules(type: SessionType, readinessLevel: 'good' | 'mid' | 'low'): string[] {
  const baseRules = [
    'Stop if any lift feels significantly harder than expected',
    'Stop immediately if you feel any sharp pain',
  ];

  if (readinessLevel === 'low') {
    return [
      'Stop at first sign of technique breakdown',
      'Keep all lifts feeling easy (RPE 6 or less)',
      ...baseRules,
    ];
  }

  if (type === 'H') {
    return [
      'Miss the same lift twice at the same weight = done with that movement',
      'If bar speed drops significantly, cap for the day',
      ...baseRules,
    ];
  }

  return baseRules;
}

export function generateTimeGuidance(type: SessionType, exercises?: Exercise[]): { short: string; extra: string } {
  // If we have the actual exercise list, give specific advice
  if (exercises && exercises.length >= 3) {
    const droppable = exercises.slice(-2).map(e => e.name).join(' and ');
    const shortAdvice = `Drop ${droppable}, focus on the first ${exercises.length - 2} movements`;

    let extraAdvice: string;
    switch (type) {
      case 'T': extraAdvice = 'Add jerk drills and extra core work'; break;
      case 'S': extraAdvice = 'Add back-off sets on squats or extra pulling work'; break;
      case 'H': extraAdvice = 'Add pulls after main work at 90-95% of max'; break;
      case 'T2': extraAdvice = 'Add extra squat volume or technique drills'; break;
      default: extraAdvice = 'Light mobility work if desired';
    }
    return { short: shortAdvice, extra: extraAdvice };
  }

  // Fallback to generic advice
  switch (type) {
    case 'T':
      return {
        short: 'Drop accessories, focus on snatch and clean positions only (30 min)',
        extra: 'Add jerk drills and extra core work',
      };
    case 'S':
      return {
        short: 'Cut last 2 accessory exercises, keep main movements',
        extra: 'Add drop sets on squats or extra pulling work',
      };
    case 'H':
      return {
        short: 'One lift only (snatch or clean & jerk), fewer warm-up sets',
        extra: 'Add snatch pulls or clean pulls after main work',
      };
    case 'T2':
      return {
        short: 'Do complexes only, skip accessory work',
        extra: 'Add extra squat volume or technique drills',
      };
    default:
      return { short: 'Rest', extra: 'Light mobility work if desired' };
  }
}

export function getSessionTypeInfo(type: SessionType): { label: string; description: string; color: string } {
  switch (type) {
    case 'T':
      return {
        label: 'Technique',
        description: 'Light loads, focus on positions and movement quality',
        color: 'session-T',
      };
    case 'S':
      return {
        label: 'Strength',
        description: 'Moderate loads, building strength base',
        color: 'session-S',
      };
    case 'H':
      return {
        label: 'Heavy',
        description: 'High intensity, near-max attempts',
        color: 'session-H',
      };
    case 'T2':
      return {
        label: 'Technical Strength',
        description: 'Complexes and moderate volume',
        color: 'session-T2',
      };
    case 'REST':
      return {
        label: 'Rest',
        description: 'Recovery day',
        color: 'session-REST',
      };
    default:
      return { label: type, description: '', color: '' };
  }
}

export function checkForPR(
  exercise: Exercise,
  existingPRs: { liftName: string; weight: number }[]
): boolean {
  if (!exercise.weight) return false;

  const existingPR = existingPRs.find(pr =>
    pr.liftName.toLowerCase() === exercise.name.toLowerCase()
  );

  if (!existingPR) return exercise.weight > 0;
  return exercise.weight > existingPR.weight;
}

// ─── Weight Guidance ───────────────────────────────────────────────

// Map exercise names to PR exercise names for lookup
const EXERCISE_TO_PR_MAP: Record<string, string> = {
  'snatch': 'Snatch',
  'snatch from blocks': 'Snatch',
  'hang snatch': 'Snatch',
  'snatch + hang snatch': 'Snatch',
  'muscle snatch': 'Snatch',
  'power snatch': 'Power Snatch',
  'snatch pull': 'Snatch',
  'snatch balance': 'Snatch',
  'snatch deadlift': 'Snatch',
  'clean & jerk': 'Clean & Jerk',
  'clean + front squat + jerk': 'Clean & Jerk',
  'hang power clean + 2 jerks': 'Clean & Jerk',
  'clean': 'Clean',
  'clean from hang': 'Clean',
  'hang clean': 'Clean',
  'muscle clean': 'Clean',
  'power clean': 'Power Clean',
  'clean pull': 'Clean',
  'jerk': 'Jerk',
  'jerk from rack': 'Jerk',
  'jerk recovery': 'Jerk',
  'push jerk': 'Jerk',
  'split jerk': 'Jerk',
  'back squat': 'Back Squat',
  'front squat': 'Front Squat',
  'overhead squat': 'Snatch',
  'deadlift': 'Deadlift',
};

// Rep-based percentage ranges (from CLAUDE.md)
const REP_PERCENTAGE_TABLE: { maxReps: number; low: number; high: number }[] = [
  { maxReps: 1, low: 85, high: 95 },
  { maxReps: 2, low: 80, high: 88 },
  { maxReps: 3, low: 75, high: 85 },
  { maxReps: 5, low: 70, high: 80 },
  { maxReps: 99, low: 60, high: 70 }, // 6+
];

// Note-based overrides
function getPercentageFromNotes(notes?: string): { low: number; high: number } | null {
  if (!notes) return null;
  const n = notes.toLowerCase();
  if (n.includes('heavy single') || n.includes('as heavy as possible')) return { low: 90, high: 95 };
  if (n.includes('working weight') || n.includes('speed pull')) return { low: 70, high: 80 };
  if (n.includes('controlled eccentric') || n.includes('slow eccentric')) return { low: 70, high: 80 };
  if (n.includes('go heavy')) return { low: 85, high: 95 };
  return null;
}

function parseRepsToNumber(reps?: string): number {
  if (!reps) return 1;
  // Handle complex rep schemes: "1+1", "1+1+1", "8-10"
  const parts = reps.split(/[+\-]/);
  return parseInt(parts[0], 10) || 1;
}

function findMatchingPR(exerciseName: string, prs: PR[]): PR | null {
  const key = exerciseName.toLowerCase();
  const prName = EXERCISE_TO_PR_MAP[key];
  if (prName) {
    return prs.find(p => p.liftName.toLowerCase() === prName.toLowerCase()) || null;
  }
  // Direct name match fallback
  return prs.find(p => p.liftName.toLowerCase() === key) || null;
}

function roundToHalf(n: number): number {
  return Math.round(n * 2) / 2;
}

export function resolveExerciseWeights(
  exercises: Exercise[],
  prs: PR[],
  readinessLevel: 'good' | 'mid' | 'low',
  unit: 'kg' | 'lb' = 'kg',
): Exercise[] {
  return exercises.map(ex => {
    const pr = findMatchingPR(ex.name, prs);
    if (!pr) return ex;

    // Determine percentage range
    let pctRange: { low: number; high: number } | null = null;

    // 1. Note-based override
    pctRange = getPercentageFromNotes(ex.notes);

    // 2. Explicit percentOfMax
    if (!pctRange && ex.percentOfMax) {
      pctRange = { low: ex.percentOfMax - 5, high: ex.percentOfMax };
    }

    // 3. Rep-based table fallback
    if (!pctRange) {
      const repNum = parseRepsToNumber(ex.reps);
      const entry = REP_PERCENTAGE_TABLE.find(e => repNum <= e.maxReps);
      if (entry) pctRange = { low: entry.low, high: entry.high };
    }

    if (!pctRange) return ex;

    const lowWeight = roundToHalf(pr.weight * pctRange.low / 100);
    const highWeight = roundToHalf(pr.weight * pctRange.high / 100);

    // Low readiness → use low end only
    const displayLow = readinessLevel === 'low' ? lowWeight : lowWeight;
    const displayHigh = readinessLevel === 'low' ? lowWeight : highWeight;

    const weightRange = displayLow === displayHigh
      ? `${displayLow}${unit} (${pctRange.low}% of ${pr.weight}${unit} PR)`
      : `${displayLow}-${displayHigh}${unit} (${pctRange.low}-${pctRange.high}% of ${pr.weight}${unit} PR)`;

    return { ...ex, weightRange, weight: roundToHalf((displayLow + displayHigh) / 2) };
  });
}

// ─── T2 Intelligence ───────────────────────────────────────────────

export function shouldAddT2(
  recentLogs: LoggedSession[],
  readinessLevel: 'good' | 'mid' | 'low',
  weekNumber: number,
): { add: boolean; focus: string } {
  // Only add T2 when readiness is good
  if (readinessLevel !== 'good') {
    return { add: false, focus: '' };
  }

  // Check what session types have been completed this week
  const completedTypes = new Set(recentLogs.map(l => l.sessionType));
  const isOddWeek = weekNumber % 2 === 1;

  // Identify uncovered work
  if (isOddWeek && !completedTypes.has('T2')) {
    // Odd week: check if snatch balance / overhead squat work is missing
    return { add: true, focus: 'Snatch balance and overhead squat work' };
  }
  if (!isOddWeek && !completedTypes.has('T2')) {
    // Even week: check if jerk technique is missing
    return { add: true, focus: 'Jerk technique and clean complex work' };
  }

  return { add: false, focus: '' };
}

// ─── Carry-Over Logic ──────────────────────────────────────────────

export function computeCarryOver(
  skippedExercises: Exercise[],
): Exercise[] {
  // Priority: Olympic lifts > squats > accessories
  const prioritized = [...skippedExercises].sort((a, b) => {
    const aIsOly = OLYMPIC_LIFTS.some(ol => a.name.toLowerCase().includes(ol.toLowerCase()));
    const bIsOly = OLYMPIC_LIFTS.some(ol => b.name.toLowerCase().includes(ol.toLowerCase()));
    const aIsStrength = STRENGTH_EXERCISES.some(se => a.name.toLowerCase().includes(se.toLowerCase()));
    const bIsStrength = STRENGTH_EXERCISES.some(se => b.name.toLowerCase().includes(se.toLowerCase()));

    if (aIsOly && !bIsOly) return -1;
    if (!aIsOly && bIsOly) return 1;
    if (aIsStrength && !bIsStrength) return -1;
    if (!aIsStrength && bIsStrength) return 1;
    return 0;
  });

  // Take top 1-2 priority exercises, mark as carry-over
  return prioritized.slice(0, 2).map(ex => ({ ...ex, isCarryOver: true }));
}

// ─── Competition Taper ─────────────────────────────────────────────

export interface TaperAdjustment {
  volumeMultiplier: number;
  note: string;
  overrideType?: SessionType;
}

export function computeTaperAdjustments(
  competitionDate: string,
  sessionDate: string,
  sessionType: SessionType,
): TaperAdjustment | null {
  const comp = new Date(competitionDate);
  const sess = new Date(sessionDate);
  const daysUntilComp = Math.round((comp.getTime() - sess.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilComp < 0 || daysUntilComp > 10) return null;

  if (daysUntilComp === 0) {
    return { volumeMultiplier: 0, note: 'Competition day!', overrideType: 'REST' };
  }
  if (daysUntilComp === 1) {
    return { volumeMultiplier: 0.3, note: 'Day before competition — mini technique + mobility only.', overrideType: 'T' };
  }
  if (daysUntilComp <= 4) {
    // D-2 to D-4: light technique only
    const override = (sessionType === 'H' || sessionType === 'S') ? 'T' as SessionType : undefined;
    return { volumeMultiplier: 0.5, note: `${daysUntilComp} days to competition — light technique only.`, overrideType: override };
  }
  // D-5 to D-10: reduce volume 20-40%
  return { volumeMultiplier: 0.7, note: `${daysUntilComp} days to competition — reducing volume 30%.` };
}

// ─── Protection Rules ──────────────────────────────────────────────

export function generateProtectionRule(sessions: PlannedSession[]): string | null {
  const trainingSessions = sessions.filter(s => s.type !== 'REST');

  for (let i = 0; i < trainingSessions.length - 1; i++) {
    const current = trainingSessions[i];
    const next = trainingSessions[i + 1];

    const currentDate = new Date(current.date);
    const nextDate = new Date(next.date);
    const daysBetween = Math.round((nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));

    // Adjacent days with S followed by H
    if (daysBetween === 1 && current.type === 'S' && next.type === 'H') {
      const currentDay = new Date(current.date).toLocaleDateString('en-US', { weekday: 'long' });
      const nextDay = new Date(next.date).toLocaleDateString('en-US', { weekday: 'long' });
      return `If legs are heavy after ${currentDay}'s Strength session, switch ${nextDay}'s Heavy to mini-H.`;
    }

    // Back-to-back training days
    if (daysBetween === 1) {
      const nextDay = new Date(next.date).toLocaleDateString('en-US', { weekday: 'long' });
      return `Back-to-back training days — if fatigued after today, reduce ${nextDay} to technique only.`;
    }
  }

  return null;
}

// ─── Cardio Suggestions ────────────────────────────────────────────

export function generateCardioSuggestion(
  cardioPreference: 'running' | 'rowing' | 'cycling' | 'none',
  restDayIndex: number,
  totalRestDays: number,
): string | null {
  if (cardioPreference === 'none') return null;
  // Suggest cardio on the first 1-2 rest days only
  if (restDayIndex >= 2) return null;

  const activityMap = {
    running: 'easy run',
    rowing: 'rowing session',
    cycling: 'easy ride',
  };
  const activity = activityMap[cardioPreference];
  const duration = restDayIndex === 0 ? '45-60 min' : '30-40 min';

  return `Suggested: ${duration} ${activity} (Zone 2)`;
}
