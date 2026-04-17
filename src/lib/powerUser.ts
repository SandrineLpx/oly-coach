/**
 * Power-user gate.
 *
 * Train Smart is Olympic-weightlifting first. Cross-training surfaces (Strava
 * sync, weather-based outdoor cardio suggestions, generic "Activity" hints,
 * cardio preferences) are hidden by default to keep the experience focused.
 *
 * To enable them for an account, add the user's auth.users.id to ALLOWLIST.
 * This is intentionally hardcoded — there is no UI to toggle it.
 */
import { useAuth } from '@/hooks/useAuth';

const ALLOWLIST: ReadonlySet<string> = new Set([
  // Sandrine (founder)
  'b2d4f167-0a0d-4530-85ed-60cfae605958',
]);

export function isPowerUserId(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return ALLOWLIST.has(userId);
}

export function usePowerUser(): boolean {
  const { user } = useAuth();
  return isPowerUserId(user?.id);
}
