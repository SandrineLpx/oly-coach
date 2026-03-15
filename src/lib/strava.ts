// Strava integration client-side helpers
import { supabase } from '@/integrations/supabase/client';
import { LoggedSession } from './types';

export interface StravaActivityClassified {
  id: string;
  name: string;
  type: string;
  date: string;
  duration_minutes: number;
  distance_km: number | null;
  classified_as: 'hard_cardio' | 'easy_cardio' | 'gym' | 'yoga' | 'walk' | 'ignored';
}

export async function getStravaStatus(): Promise<{ connected: boolean; athlete_id?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { connected: false };

    const { data, error } = await supabase.functions.invoke('strava-auth', {
      body: { action: 'status' },
    });
    if (error) return { connected: false };
    return data;
  } catch {
    return { connected: false };
  }
}

export async function exchangeStravaCode(code: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('strava-auth', {
      body: { action: 'exchange', code },
    });
    return !error && data?.success;
  } catch {
    return false;
  }
}

export async function disconnectStrava(): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('strava-auth', {
      body: { action: 'disconnect' },
    });
    return !error && data?.success;
  } catch {
    return false;
  }
}

export async function fetchStravaActivities(daysBack: number = 7): Promise<StravaActivityClassified[]> {
  try {
    const { data, error } = await supabase.functions.invoke('strava-activities', {
      body: { days_back: daysBack },
    });
    if (error || data?.status !== 'connected') return [];
    return data.activities || [];
  } catch {
    return [];
  }
}

/**
 * Check if there was hard cardio in the last 36 hours
 */
export function hasRecentHardCardio(activities: StravaActivityClassified[]): boolean {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - 36);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  return activities.some(
    a => a.classified_as === 'hard_cardio' && a.date >= cutoffStr
  );
}

/**
 * Find gym sessions on Strava that aren't in the training log
 */
export function findUnloggedGymSessions(
  activities: StravaActivityClassified[],
  trainingLog: LoggedSession[],
): StravaActivityClassified[] {
  const loggedDates = new Set(trainingLog.map(l => l.date));
  return activities.filter(
    a => a.classified_as === 'gym' && !loggedDates.has(a.date)
  );
}

/**
 * Build the Strava OAuth URL for the authorization flow
 */
export function getStravaAuthUrl(clientId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'activity:read_all',
  });
  return `https://www.strava.com/oauth/authorize?${params.toString()}`;
}
