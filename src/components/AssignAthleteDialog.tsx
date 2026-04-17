import { useEffect, useState } from 'react';
import { Loader2, UserPlus, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
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
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AthleteOption {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Receives athleteId and ISO date (yyyy-MM-dd) */
  onConfirm: (athleteId: string, startDate: string) => Promise<void> | void;
}

export default function AssignAthleteDialog({ open, onOpenChange, onConfirm }: Props) {
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [manualId, setManualId] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);

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
      const opts = (data || []).map((a) => ({ id: a.user_id, name: a.name }));
      setAthletes(opts);
      if (user && opts.find((o) => o.id === user.id)) setSelected(user.id);
      else if (opts.length > 0) setSelected(opts[0].id);
      // default start date: next Monday
      const today = new Date();
      const day = today.getDay();
      const offset = day === 1 ? 0 : (8 - day) % 7 || 7;
      const monday = new Date(today);
      monday.setDate(today.getDate() + offset);
      setStartDate(monday);
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
    if (!startDate) {
      toast.error('Pick a program start date');
      return;
    }
    setConfirming(true);
    try {
      await onConfirm(id, format(startDate, 'yyyy-MM-dd'));
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
            Publishing makes this program visible to the selected athlete from the chosen start date.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {athletes.length > 0 ? (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {athletes.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setSelected(a.id)}
                    className={cn(
                      'w-full text-left px-3 py-2.5 rounded-lg border transition-colors',
                      selected === a.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50',
                    )}
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
              <Label className="text-xs font-medium text-muted-foreground">Or paste user ID</Label>
              <Input
                placeholder="uuid…"
                value={manualId}
                onChange={(e) => { setManualId(e.target.value); setSelected(''); }}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5 pt-2 border-t border-border">
              <Label className="text-xs font-medium text-muted-foreground">
                Program start date <span className="text-destructive">*</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !startDate && 'text-muted-foreground',
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'PPP') : <span>Pick a start date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    className={cn('p-3 pointer-events-auto')}
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Week 1 begins on this date. Each athlete can have their own start date.
              </p>
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
