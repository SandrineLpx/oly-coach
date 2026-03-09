// Training decision logic for Train Smart
import { SessionType, Sleep, ReadinessCheck, LoggedSession, Exercise, PlannedSession } from './types';

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

export function shouldDowngradeSession(
  plannedType: SessionType,
  readiness: ReadinessScore,
  recentCardio: boolean,
  daysSinceHeavy: number
): { newType: SessionType; reason: string | null } {
  
  // Never downgrade REST
  if (plannedType === 'REST') {
    return { newType: 'REST', reason: null };
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
  if (recentCardio && plannedType === 'H') {
    return {
      newType: 'S',
      reason: 'Downgraded due to recent intense cardio activity.'
    };
  }

  return { newType: plannedType, reason: null };
}

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
  isPRDay: boolean = false
): Exercise[] {
  switch (type) {
    case 'T': // Technique
      return [
        { name: 'Muscle Snatch', sets: '3', reps: '3', notes: 'Light, focus on positions' },
        { name: 'Snatch from Blocks', sets: '5', reps: '2', percentOfMax: 60, notes: 'Pause at knee' },
        { name: 'Clean from Hang', sets: '5', reps: '2', percentOfMax: 60 },
        { name: 'Front Squat', sets: '3', reps: '5', percentOfMax: 65, notes: 'Tempo: 3 sec down' },
        { name: 'Core Work', sets: '3', reps: '10', notes: 'Hollow holds or planks' },
      ];

    case 'S': // Strength
      return [
        { name: 'Power Snatch', sets: '4', reps: '2', percentOfMax: 75 },
        { name: 'Power Clean', sets: '4', reps: '2', percentOfMax: 75 },
        { name: 'Back Squat', sets: '5', reps: '3', percentOfMax: 80 },
        { name: 'Push Press', sets: '4', reps: '4', percentOfMax: 75 },
        { name: 'Romanian Deadlift', sets: '3', reps: '8', notes: 'Moderate load' },
        { name: 'Pull-ups', sets: '3', reps: '8-10' },
      ];

    case 'H': // Heavy
      return [
        { name: 'Snatch', sets: '6', reps: '1', percentOfMax: isPRDay ? 100 : 90, notes: isPRDay ? 'PR attempt!' : 'Work up to heavy single' },
        { name: 'Clean & Jerk', sets: '5', reps: '1+1', percentOfMax: isPRDay ? 100 : 88, notes: isPRDay ? 'PR attempt!' : 'Heavy singles' },
        { name: 'Front Squat', sets: '4', reps: '2', percentOfMax: 85, notes: 'Heavy doubles' },
        { name: 'Snatch Pull', sets: '3', reps: '3', percentOfMax: 95, notes: 'Above competition max' },
      ];

    case 'T2': // Hybrid/Technical Strength
      return [
        { name: 'Snatch + Hang Snatch', sets: '4', reps: '1+1', percentOfMax: 72 },
        { name: 'Clean + Front Squat + Jerk', sets: '4', reps: '1+1+1', percentOfMax: 72 },
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

export function generateTimeGuidance(type: SessionType): { short: string; extra: string } {
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
