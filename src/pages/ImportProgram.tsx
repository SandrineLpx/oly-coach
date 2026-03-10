import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileSpreadsheet, Eye, Save, Loader2, ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface ParsedExercise {
  name: string;
  sets?: number | null;
  reps?: string | null;
  percent_of_max?: number | null;
  notes?: string | null;
  order_index: number;
}

interface ParsedSession {
  week_number: number;
  day_of_week: number;
  session_type: string;
  name?: string;
  notes?: string;
  exercises: ParsedExercise[];
}

interface ParsedProgram {
  name: string;
  description?: string;
  weeks: number;
  sessions: ParsedSession[];
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SESSION_COLORS: Record<string, string> = {
  T: 'text-blue-400',
  S: 'text-amber-400',
  H: 'text-red-400',
  T2: 'text-purple-400',
  REST: 'text-muted-foreground',
};

export default function ImportProgram() {
  const navigate = useNavigate();
  const { saveProgram } = useAppStore();
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState<ParsedProgram | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [previewWeek, setPreviewWeek] = useState(1);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const lines: string[] = [];

    wb.SheetNames.forEach(name => {
      lines.push(`=== Sheet: ${name} ===`);
      const ws = wb.Sheets[name];
      const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
      lines.push(csv);
      lines.push('');
    });

    setRawText(lines.join('\n'));
    setParsed(null);
    toast.success(`Loaded ${wb.SheetNames.length} sheet(s) from ${file.name}`);
  }, []);

  const handleParse = async () => {
    if (!rawText.trim()) {
      toast.error('Paste or upload program data first');
      return;
    }

    setParsing(true);
    setParsed(null);

    try {
      const { data, error } = await supabase.functions.invoke('parse-program', {
        body: { rawText },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setParsed(data.program);
      setPreviewWeek(1);
      toast.success('Program parsed successfully!');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to parse program');
    } finally {
      setParsing(false);
    }
  };

  const handleSave = async () => {
    if (!parsed) return;
    setSaving(true);

    try {
      await saveProgram(parsed, startDate);
      toast.success('Program saved!');
      navigate('/settings');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to save program');
    } finally {
      setSaving(false);
    }
  };

  const weekSessions = parsed?.sessions.filter(s => s.week_number === previewWeek) || [];

  return (
    <div className="min-h-screen px-4 py-6 pb-24">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-muted-foreground mb-3 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-2xl font-bold">Import Program</h1>
        <p className="text-sm text-muted-foreground mt-1">Paste from Excel or upload an .xlsx file — AI will parse it.</p>
      </motion.div>

      {/* Step 1: Input */}
      <div className="space-y-3 mb-6">
        <label className="relative flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl p-4 cursor-pointer hover:border-primary/50 transition-colors">
          <FileSpreadsheet className="w-5 h-5 text-primary" />
          <span className="text-sm font-medium">Upload .xlsx file</span>
          <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
        </label>

        <div className="text-center text-xs text-muted-foreground">or paste below</div>

        <Textarea
          value={rawText}
          onChange={e => { setRawText(e.target.value); setParsed(null); }}
          placeholder="Paste your program here (copy from Excel, or type it out)..."
          className="min-h-[200px] font-mono text-xs"
        />

        <Button onClick={handleParse} disabled={parsing || !rawText.trim()} className="w-full">
          {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
          {parsing ? 'Parsing with AI…' : 'Parse Program'}
        </Button>
      </div>

      {/* Step 2: Preview */}
      {parsed && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="bg-card rounded-xl p-4 border border-border">
            <h2 className="font-bold text-lg">{parsed.name}</h2>
            {parsed.description && <p className="text-sm text-muted-foreground mt-1">{parsed.description}</p>}
            <p className="text-xs text-muted-foreground mt-2">{parsed.weeks} weeks · {parsed.sessions.length} sessions · {parsed.sessions.reduce((n, s) => n + s.exercises.length, 0)} exercises</p>
          </div>

          {/* Week tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {Array.from({ length: parsed.weeks }, (_, i) => i + 1).map(w => (
              <button
                key={w}
                onClick={() => setPreviewWeek(w)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap border ${previewWeek === w ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
              >
                Wk {w}
              </button>
            ))}
          </div>

          {/* Sessions for selected week */}
          <div className="space-y-3">
            {weekSessions.length === 0 && (
              <div className="text-sm text-muted-foreground flex items-center gap-2 p-4">
                <AlertCircle className="w-4 h-4" /> No sessions found for week {previewWeek}
              </div>
            )}
            {weekSessions.map((session, si) => (
              <div key={si} className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-bold ${SESSION_COLORS[session.session_type] || 'text-foreground'}`}>
                    {session.session_type}
                  </span>
                  <span className="text-sm font-semibold">{session.name || DAY_NAMES[session.day_of_week]}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{DAY_NAMES[session.day_of_week]}</span>
                </div>
                {session.notes && <p className="text-xs text-muted-foreground mb-2">{session.notes}</p>}
                <div className="space-y-1.5">
                  {session.exercises.map((ex, ei) => (
                    <div key={ei} className="flex items-baseline gap-2 text-sm">
                      <span className="text-muted-foreground text-xs w-4">{ei + 1}</span>
                      <span className="font-medium flex-1">{ex.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {[
                          ex.sets && `${ex.sets}s`,
                          ex.reps && `×${ex.reps}`,
                          ex.percent_of_max && `@${ex.percent_of_max}%`,
                        ].filter(Boolean).join(' ')}
                      </span>
                    </div>
                  ))}
                  {session.exercises.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">Rest day</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Step 3: Save */}
          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            <label className="text-sm font-medium">Program Start Date</label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save Program'}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
