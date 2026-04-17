import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type AppRole = 'coach' | 'athlete';

export function useUserRole() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    setRoles((data?.map((r) => r.role as AppRole)) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return {
    roles,
    isCoach: roles.includes('coach'),
    isAthlete: roles.includes('athlete'),
    loading,
    refresh,
  };
}
