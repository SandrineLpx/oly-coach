import { useEffect, useState } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AthleteOption {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (athleteId: string) => Promise<void> | void;
}

export default function AssignAthleteDialog({ open, onOpenChange, onConfirm }: Props) {
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [manualId, setManualId] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase
        .from('athlete_profiles')
        .select('user_id, name')
        .order('name');
      if (cancelled) return;
      const opts = (data || []).map(a => ({ id: a.user_id, name: a.name }));
      setAthletes(opts);
      // Default to current user (self-coach common case)
      if (user && opts.find(o => o.id === user.id)) setSelected(user.id);
      else if (opts.length > 0) setSelected(opts[0].id);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open]);

  const handleConfirm = async () => {
    const id = selected || manualId.trim();
    if (!id) {
      toast.error('Pick an athlete or paste a user ID');
      return;
    }
    setConfirming(true);
    try {
      await onConfirm(id);
      onOpenChange(false);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Assign to athlete
          </DialogTitle>
          <DialogDescription>
            Publishing makes this program visible to the selected athlete.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {athletes.length > 0 ? (
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {athletes.map(a => (
                  <button
                    key={a.id}
                    onClick={() => setSelected(a.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                      selected === a.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="font-medium text-sm">{a.name}</div>
                    <div className="text-xs text-muted-foreground font-mono truncate">{a.id}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No athlete profiles found. Paste an athlete user ID below.
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Or paste user ID</label>
              <Input
                placeholder="uuid…"
                value={manualId}
                onChange={e => { setManualId(e.target.value); setSelected(''); }}
                className="font-mono text-xs"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={confirming}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={confirming || loading}>
            {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            {confirming ? 'Publishing…' : 'Publish & assign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
