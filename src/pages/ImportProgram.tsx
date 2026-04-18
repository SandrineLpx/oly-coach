import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { FileSpreadsheet, Eye, Loader2, ArrowLeft, AlertCircle, CalendarRange } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import ProgramOverviewEditor from '@/components/ProgramOverviewEditor';

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
  phase_summary?: Array<{ weeks: string; label: string; summary: string }>;
  weeks: number;
  sessions: ParsedSession[];
}

interface DetectedWeek {
  weekNumber: number;
  blockText: string;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SESSION_COLORS: Record<string, string> = {
  T: 'text-blue-400',
  S: 'text-amber-400',
  H: 'text-red-400',
  T2: 'text-purple-400',
  REST: 'text-muted-foreground',
};

const DEFAULT_BATCH_SIZE = 4;

/** Splits raw text into per-week blocks based on "=== Sheet: Week N ===" markers. */
function detectWeeks(rawText: string): { preamble: string; weeks: DetectedWeek[] } {
  const weekRegex = /=== Sheet: Week\s*(\d+)\s*===/gi;
  const matches = [...rawText.matchAll(weekRegex)];
  if (matches.length === 0) return { preamble: '', weeks: [] };

  const preamble = rawText.slice(0, matches[0].index ?? 0);
  const weeks: DetectedWeek[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index!;
    const end = i + 1 < matches.length ? matches[i + 1].index! : rawText.length;
    weeks.push({
      weekNumber: parseInt(matches[i][1], 10),
      blockText: rawText.slice(start, end),
    });
  }
  return { preamble, weeks };
}

/**
 * Re-numbers session week_number values so they start from 1 within the
 * imported subset (e.g. importing weeks 5-8 of a 26-week program becomes
 * weeks 1-4 in our database).
 */
function renumberSessions(
  sessions: ParsedSession[],
  selectedWeeks: number[],
): ParsedSession[] {
  const sortedUnique = [...new Set(selectedWeeks)].sort((a, b) => a - b);
  const map = new Map<number, number>();
  sortedUnique.forEach((orig, idx) => map.set(orig, idx + 1));
  return sessions.map(s => ({
    ...s,
    week_number: map.get(s.week_number) ?? s.week_number,
  }));
}

/** SHA-256 hash of a string (hex). Used as cache key for the global pass. */
async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

const GLOBAL_CACHE_PREFIX = 'parse-program:global:';

interface GlobalOverview {
  name?: string;
  description?: string;
  phase_summary?: Array<{ weeks: string; label: string; summary: string }>;
  total_program_weeks?: number;
}

function readGlobalCache(hash: string): GlobalOverview | null {
  try {
    const raw = sessionStorage.getItem(GLOBAL_CACHE_PREFIX + hash);
    return raw ? (JSON.parse(raw) as GlobalOverview) : null;
  } catch {
    return null;
  }
}

function writeGlobalCache(hash: string, overview: GlobalOverview) {
  try {
    sessionStorage.setItem(GLOBAL_CACHE_PREFIX + hash, JSON.stringify(overview));
  } catch {
    /* quota exceeded — ignore */
  }
}

export default function ImportProgram() {
  const navigate = useNavigate();
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState<ParsedProgram | null>(null);
  const [parsing, setParsing] = useState(false);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [previewWeek, setPreviewWeek] = useState(1);
  const [selectedWeeks, setSelectedWeeks] = useState<Set<number>>(new Set());
  // Original (pre-renumber) week numbers actually imported. null = whole program.
  const [importedOriginalWeeks, setImportedOriginalWeeks] = useState<number[] | null>(null);

  const { preamble, weeks: detectedWeeks } = useMemo(() => detectWeeks(rawText), [rawText]);
  const totalDetected = detectedWeeks.length;

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

    const text = lines.join('\n');
    setRawText(text);
    setParsed(null);

    // Auto-select first 4 weeks if many weeks detected, otherwise select all.
    const detected = detectWeeks(text).weeks;
    const defaultSelection = detected.length > DEFAULT_BATCH_SIZE
      ? detected.slice(0, DEFAULT_BATCH_SIZE).map(w => w.weekNumber)
      : detected.map(w => w.weekNumber);
    setSelectedWeeks(new Set(defaultSelection));

    toast.success(
      detected.length > DEFAULT_BATCH_SIZE
        ? `Loaded ${file.name} · ${detected.length} weeks detected — first ${DEFAULT_BATCH_SIZE} pre-selected`
        : `Loaded ${wb.SheetNames.length} sheet(s) from ${file.name}`,
    );
  }, []);

  const toggleWeek = (weekNumber: number) => {
    setSelectedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(weekNumber)) next.delete(weekNumber);
      else next.add(weekNumber);
      return next;
    });
  };

  const selectFirstN = (n: number) => {
    setSelectedWeeks(new Set(detectedWeeks.slice(0, n).map(w => w.weekNumber)));
  };

  const selectAll = () => {
    setSelectedWeeks(new Set(detectedWeeks.map(w => w.weekNumber)));
  };

  const handleParse = async () => {
    if (!rawText.trim()) {
      toast.error('Paste or upload program data first');
      return;
    }

    setParsing(true);
    setParsed(null);

    try {
      // Build chunks from the SELECTED weeks only.
      // If no week markers were detected, fall back to sending raw text as-is.
      let chunks: string[];
      let importedWeekCount: number;
      let originalRange: string | null = null;
      let selectedSorted: number[] = [];

      if (detectedWeeks.length === 0) {
        chunks = [rawText];
        importedWeekCount = 0; // unknown — let parser decide
      } else {
        selectedSorted = [...selectedWeeks].sort((a, b) => a - b);
        if (selectedSorted.length === 0) {
          toast.error('Select at least one week to import');
          setParsing(false);
          return;
        }
        const blocks = detectedWeeks
          .filter(w => selectedWeeks.has(w.weekNumber))
          .map(w => w.blockText);

        const CHUNK_SIZE = 4;
        chunks = [];
        for (let i = 0; i < blocks.length; i += CHUNK_SIZE) {
          chunks.push(preamble + blocks.slice(i, i + CHUNK_SIZE).join('\n'));
        }
        importedWeekCount = selectedSorted.length;
        originalRange = `${selectedSorted[0]}–${selectedSorted[selectedSorted.length - 1]}`;
      }

      toast.info(
        `Parsing ${chunks.length} session chunk${chunks.length > 1 ? 's' : ''} + 1 global pass…`,
      );

      // Run the GLOBAL overview pass on the FULL raw text in parallel with the
      // session chunks. The global pass produces description + phase_summary
      // covering the entire program, so the explanation reflects the whole
      // cycle even when only a subset of weeks is being imported.
      const sessionInvocations = chunks.map((chunk, idx) =>
        supabase.functions.invoke('parse-program', {
          body: {
            rawText: chunk,
            mode: 'sessions',
            chunkIndex: idx,
            totalChunks: chunks.length,
          },
        }),
      );
      const globalInvocation = supabase.functions.invoke('parse-program', {
        body: { rawText, mode: 'global' },
      });

      const [sessionResults, globalResult] = await Promise.all([
        Promise.all(sessionInvocations),
        globalInvocation,
      ]);

      // Validate session results
      const programs: ParsedProgram[] = [];
      for (let i = 0; i < sessionResults.length; i++) {
        const { data, error } = sessionResults[i];
        if (error) throw error;
        if (data?.error) throw new Error(`Chunk ${i + 1}: ${data.error}`);
        if (!data?.program) throw new Error(`Chunk ${i + 1}: empty response`);
        programs.push(data.program);
      }

      const first = programs[0];
      let allSessions = programs.flatMap(p => p.sessions ?? []);

      // Re-number sessions so weeks start at 1 in our system.
      if (selectedSorted.length > 0) {
        allSessions = renumberSessions(allSessions, selectedSorted);
      }

      const maxWeek = allSessions.reduce((m, s) => Math.max(m, s.week_number ?? 0), 0);
      const finalWeeks = importedWeekCount || Math.max(first.weeks ?? 0, maxWeek);

      // Merge global overview metadata (description + phase_summary describe the
      // whole program). If global pass failed, fall back gracefully.
      const overview = (globalResult as any)?.data?.overview;
      const totalProgramWeeks: number | undefined = overview?.total_program_weeks;

      let description = overview?.description as string | undefined;
      if (description && originalRange && importedWeekCount && totalProgramWeeks &&
          totalProgramWeeks > importedWeekCount) {
        description = `${description}\n\nYou are currently viewing weeks ${originalRange} of this ${totalProgramWeeks}-week program (${importedWeekCount} week${importedWeekCount === 1 ? '' : 's'}).`;
      }

      const merged: ParsedProgram = {
        ...first,
        name: overview?.name || first.name,
        description,
        phase_summary: overview?.phase_summary?.length ? overview.phase_summary : first.phase_summary,
        weeks: finalWeeks,
        sessions: allSessions,
      };

      setParsed(merged);
      setImportedOriginalWeeks(selectedSorted.length > 0 ? selectedSorted : null);
      setPreviewWeek(1);
      toast.success(
        `Parsed ${merged.weeks} of ${totalProgramWeeks ?? merged.weeks} weeks · ${merged.sessions.length} sessions`,
      );
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to parse program');
    } finally {
      setParsing(false);
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
          onChange={e => {
            setRawText(e.target.value);
            setParsed(null);
            const detected = detectWeeks(e.target.value).weeks;
            const defaultSelection = detected.length > DEFAULT_BATCH_SIZE
              ? detected.slice(0, DEFAULT_BATCH_SIZE).map(w => w.weekNumber)
              : detected.map(w => w.weekNumber);
            setSelectedWeeks(new Set(defaultSelection));
          }}
          placeholder="Paste your program here (copy from Excel, or type it out)..."
          className="min-h-[200px] font-mono text-xs"
        />

        {/* Week selector — only shown when we detected weeks in the input */}
        {totalDetected > 0 && (
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CalendarRange className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">Which weeks to import</h3>
              <span className="text-xs text-muted-foreground ml-auto">
                {selectedWeeks.size} of {totalDetected}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Detected {totalDetected} weeks. Importing fewer weeks at once is faster and easier
              to review. You can always import more later.
            </p>

            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="outline" onClick={() => selectFirstN(4)} className="h-7 text-xs">
                First 4
              </Button>
              <Button size="sm" variant="outline" onClick={() => selectFirstN(8)} className="h-7 text-xs">
                First 8
              </Button>
              <Button size="sm" variant="outline" onClick={selectAll} className="h-7 text-xs">
                All ({totalDetected})
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedWeeks(new Set())} className="h-7 text-xs">
                Clear
              </Button>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 pt-1">
              {detectedWeeks.map(w => {
                const checked = selectedWeeks.has(w.weekNumber);
                return (
                  <label
                    key={w.weekNumber}
                    className={`flex items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-xs font-medium cursor-pointer transition-colors ${
                      checked
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/40'
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleWeek(w.weekNumber)}
                      className="h-3.5 w-3.5"
                    />
                    Wk {w.weekNumber}
                  </label>
                );
              })}
            </div>
          </Card>
        )}

        <Button onClick={handleParse} disabled={parsing || !rawText.trim()} className="w-full">
          {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
          {parsing
            ? 'Parsing with AI…'
            : totalDetected > 0
            ? `Parse ${selectedWeeks.size} week${selectedWeeks.size !== 1 ? 's' : ''}`
            : 'Parse Program'}
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

          {/* Start date */}
          <div className="bg-card rounded-xl border border-border p-4 space-y-2">
            <label className="text-sm font-medium">Program start date</label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>

          {/* Review & Publish */}
          <ProgramOverviewEditor
            parsed={parsed}
            startDate={startDate}
            importedOriginalWeeks={importedOriginalWeeks}
            onSaved={(_id, published) => {
              if (published) navigate('/settings');
            }}
          />
        </motion.div>
      )}
    </div>
  );
}
