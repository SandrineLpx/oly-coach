import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, KeyRound, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';

export default function BecomeCoach() {
  const navigate = useNavigate();
  const { isCoach, refresh } = useUserRole();
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('gym_settings')
        .select('is_setup_complete')
        .eq('id', 1)
        .maybeSingle();
      setSetupComplete(data?.is_setup_complete ?? false);
    })();
  }, []);

  const isBootstrap = setupComplete === false;
  const isCoachUpdating = setupComplete === true && isCoach;
  const mode: 'bootstrap' | 'redeem' | 'update' =
    isBootstrap ? 'bootstrap' : isCoachUpdating ? 'update' : 'redeem';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length < 4) {
      toast.error('Code must be at least 4 characters');
      return;
    }
    setSubmitting(true);
    try {
      const rpc = mode === 'redeem' ? 'redeem_coach_code' : 'setup_gym_code';
      const { data, error } = await supabase.rpc(rpc, { _plain_code: code.trim() });
      if (error) throw error;
      const result = data as { success: boolean; error?: string; bootstrapped?: boolean };
      if (!result.success) {
        const msg =
          result.error === 'invalid_code' ? 'Invalid gym code' :
          result.error === 'not_setup' ? 'Gym code is not set yet. Ask your gym admin.' :
          result.error === 'forbidden' ? 'Only coaches can update the gym code.' :
          result.error === 'code_too_short' ? 'Code must be at least 4 characters' :
          'Something went wrong';
        toast.error(msg);
        return;
      }
      if (mode === 'redeem') {
        toast.success('You are now a coach 🎉');
      } else if (mode === 'bootstrap') {
        toast.success('Gym code set — you are the first coach 🎉');
      } else {
        toast.success('Gym code updated');
      }
      await refresh();
      navigate('/settings');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (setupComplete === null) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 pb-24">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-muted-foreground mb-6 hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          {mode === 'bootstrap' ? (
            <Sparkles className="w-7 h-7 text-primary" />
          ) : (
            <KeyRound className="w-7 h-7 text-primary" />
          )}
        </div>

        <h1 className="text-2xl font-bold mb-2">
          {mode === 'bootstrap' && 'Set up your gym'}
          {mode === 'redeem' && 'Become a coach'}
          {mode === 'update' && 'Manage gym code'}
        </h1>

        <p className="text-sm text-muted-foreground mb-6">
          {mode === 'bootstrap' &&
            'No gym code exists yet. Pick one now — you’ll automatically become the first coach. Share this code with other coaches at your gym.'}
          {mode === 'redeem' &&
            'Enter the code your gym shared with you to unlock coach features (program creation, athlete assignment).'}
          {mode === 'update' &&
            'Set a new gym code. The previous code will stop working immediately.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">
              {mode === 'bootstrap' ? 'Choose gym code' : 'Gym code'}
            </Label>
            <Input
              id="code"
              type="text"
              autoComplete="off"
              autoFocus
              placeholder="e.g. iron-house-2026"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="h-11"
            />
          </div>

          <Button type="submit" disabled={submitting} className="w-full" size="lg">
            {submitting
              ? 'Working…'
              : mode === 'bootstrap'
              ? 'Create code & become coach'
              : mode === 'update'
              ? 'Update code'
              : 'Redeem code'}
          </Button>
        </form>

        {isCoach && mode === 'redeem' && (
          <p className="text-xs text-muted-foreground mt-4 text-center">
            You already have the coach role.
          </p>
        )}
      </motion.div>
    </div>
  );
}
