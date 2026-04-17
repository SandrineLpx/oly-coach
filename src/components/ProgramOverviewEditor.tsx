import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Save, Send, Loader2, Layers, ListChecks, FileText } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import AssignAthleteDialog from './AssignAthleteDialog';

type Priority = 'primary' | 'secondary' | 'supplemental';

interface ParsedSession {
  week_number: number;
  day_of_week: number;
  session_type: string;
  name?: string;
  notes?: string;
  priority?: Priority;
  droppable?: boolean;
  focus_label?: string | null;
  exercises: any[];
}

interface ParsedProgram {
  name: string;
  description?: string;
  phase_summary?: Array<{ weeks: string; label: string; summary: string }>;
  weeks: number;
  sessions: ParsedSession[];
}

interface SessionTemplate {
  focus_label: string;
  priority: Priority;
  droppable: boolean;
}

interface Props {
  parsed: ParsedProgram;
  startDate: string;
  onSaved?: (programId: string, published: boolean) => void;
}

const PRIORITY_VARIANTS: Record<Priority, string> = {
  primary: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  supplemental: 'bg-muted text-muted-foreground',
};

export default function ProgramOverviewEditor({ parsed, startDate, onSaved }: Props) {
  const { saveProgram } = useAppStore();

  const [name, setName] = useState(parsed.name);
  const [description, setDescription] = useState(parsed.description ?? '');
  const [phases, setPhases] = useState(parsed.phase_summary ?? []);
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Build unique session templates by focus_label
  const initialTemplates = useMemo<SessionTemplate[]>(() => {
    const map = new Map<string, SessionTemplate>();
    for (const s of parsed.sessions) {
      const key = (s.focus_label || s.name || `Day ${s.day_of_week}`).trim();
      if (!map.has(key)) {
        map.set(key, {
          focus_label: key,
          priority: (s.priority as Priority) ?? 'primary',
          droppable: s.droppable ?? false,
        });
      }
    }
    return Array.from(map.values());
  }, [parsed]);

  const [templates, setTemplates] = useState<SessionTemplate[]>(initialTemplates);

  const sessionsPerWeek = useMemo(() => {
    const counts = new Set<number>();
    parsed.sessions.forEach(s => counts.add(s.day_of_week + s.week_number * 100));
    // Count distinct days in week 1 as a proxy
    const week1 = parsed.sessions.filter(s => s.week_number === 1);
    return week1.length || Math.round(parsed.sessions.length / Math.max(parsed.weeks, 1));
  }, [parsed]);

  const updatePhase = (i: number, patch: Partial<{ label: string; summary: string }>) => {
    setPhases(prev => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  };

  const updateTemplate = (i: number, patch: Partial<SessionTemplate>) => {
    setTemplates(prev =>
      prev.map((t, idx) => {
        if (idx !== i) return t;
        const next = { ...t, ...patch };
        // Rule: supplemental ↔ droppable auto-link
        if (patch.priority) {
          next.droppable = patch.priority === 'supplemental';
        }
        return next;
      }),
    );
  };

  /** Apply template overrides to sessions array */
  const applyTemplatesToSessions = (sessions: ParsedSession[]): ParsedSession[] => {
    return sessions.map(s => {
      const key = (s.focus_label || s.name || `Day ${s.day_of_week}`).trim();
      const tpl = templates.find(t => t.focus_label === key);
      if (!tpl) return s;
      return { ...s, priority: tpl.priority, droppable: tpl.droppable };
    });
  };

  const buildPayload = (): ParsedProgram => ({
    ...parsed,
    name: name.trim() || parsed.name,
    description: description.trim() || undefined,
    phase_summary: phases,
    sessions: applyTemplatesToSessions(parsed.sessions),
  });

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      const id = await saveProgram(buildPayload(), startDate, { published: false });
      toast.success('Draft saved');
      onSaved?.(id, false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to save draft');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleAssign = async (athleteId: string) => {
    setPublishing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const id = await saveProgram(buildPayload(), startDate, { published: true });

      const { error: assignErr } = await supabase.from('program_assignments').insert({
        program_id: id,
        athlete_id: athleteId,
        assigned_by: user.id,
      });
      if (assignErr) throw assignErr;

      toast.success('Program published & assigned');
      onSaved?.(id, true);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to assign');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      {/* Section 1: Program identity */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <FileText className="w-3.5 h-3.5" /> Program identity
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="prog-name">Program name</Label>
          <Input id="prog-name" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="prog-desc">Description</Label>
          <Textarea
            id="prog-desc"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="3-5 sentence overview shown to the athlete…"
            className="min-h-[120px]"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-muted/50 rounded-lg px-3 py-2">
            <div className="text-xs text-muted-foreground">Total weeks</div>
            <div className="font-semibold">{parsed.weeks}</div>
          </div>
          <div className="bg-muted/50 rounded-lg px-3 py-2">
            <div className="text-xs text-muted-foreground">Sessions / week</div>
            <div className="font-semibold">{sessionsPerWeek}</div>
          </div>
        </div>
      </Card>

      {/* Section 2: Phase breakdown */}
      {phases.length > 0 && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Layers className="w-3.5 h-3.5" /> Phase breakdown
          </div>
          {phases.map((phase, i) => (
            <div key={i} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">Wk {phase.weeks}</Badge>
                <Input
                  value={phase.label}
                  onChange={e => updatePhase(i, { label: e.target.value })}
                  className="h-8 font-semibold"
                />
              </div>
              <Textarea
                value={phase.summary}
                onChange={e => updatePhase(i, { summary: e.target.value })}
                className="min-h-[70px] text-sm"
              />
            </div>
          ))}
        </Card>
      )}

      {/* Section 3: Session priority review */}
      {templates.length > 0 && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <ListChecks className="w-3.5 h-3.5" /> Session priority
          </div>
          <p className="text-xs text-muted-foreground -mt-1">
            Changes apply to every week of this program.
          </p>
          {templates.map((tpl, i) => (
            <div key={i} className="rounded-lg border border-border p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm flex-1 min-w-0 truncate">{tpl.focus_label}</span>
                <Badge className={PRIORITY_VARIANTS[tpl.priority]}>{tpl.priority}</Badge>
              </div>

              <div className="flex gap-1.5">
                {(['primary', 'secondary', 'supplemental'] as Priority[]).map(p => (
                  <button
                    key={p}
                    onClick={() => updateTemplate(i, { priority: p })}
                    className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                      tpl.priority === p
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/40'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between pt-1">
                <Label htmlFor={`drop-${i}`} className="text-xs text-muted-foreground">
                  Droppable
                </Label>
                <Switch
                  id={`drop-${i}`}
                  checked={tpl.droppable}
                  onCheckedChange={v => updateTemplate(i, { droppable: v })}
                />
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Bottom actions */}
      <div className="flex gap-2 sticky bottom-4">
        <Button
          variant="outline"
          onClick={handleSaveDraft}
          disabled={savingDraft || publishing}
          className="flex-1"
        >
          {savingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save draft
        </Button>
        <Button
          onClick={() => setPublishOpen(true)}
          disabled={savingDraft || publishing}
          className="flex-1"
        >
          {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Assign to athlete
        </Button>
      </div>

      <AssignAthleteDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        onConfirm={handleAssign}
      />
    </motion.div>
  );
}
