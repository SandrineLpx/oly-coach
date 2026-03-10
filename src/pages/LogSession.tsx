import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CalendarIcon, CheckCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SessionBadge } from '@/components/SessionBadge';
import { useAppStore } from '@/lib/store';
import { Sleep, LoggedSession, SessionType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';

const sleepOptions: { value: Sleep; label: string }[] = [
  { value: 'good', label: 'Good' },
  { value: 'ok', label: 'OK' },
  { value: 'bad', label: 'Poor' },
];

const sessionTypes: SessionType[] = ['T', 'S', 'H', 'T2'];

export default function LogSession() {
  const navigate = useNavigate();
  const { getTodaySession, logSession, markSessionComplete, prs, addPR, preferences } = useAppStore();
  
  const todaySession = getTodaySession();
  
  const [sessionType, setSessionType] = useState<SessionType>(todaySession?.type || 'S');
  const [sessionDate, setSessionDate] = useState<Date>(new Date());
  const [rpe, setRpe] = useState([7]);
  const [sleep, setSleep] = useState<Sleep>('good');
  const [soreness, setSoreness] = useState([3]);
  const [notes, setNotes] = useState('');
  const [asPlanned, setAsPlanned] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = () => {
    const log: LoggedSession = {
      id: Math.random().toString(36).substring(2, 11),
      date: format(sessionDate, 'yyyy-MM-dd'),
      sessionType,
      plannedSessionId: todaySession?.id,
      exercises: todaySession?.exercises || [],
      asPlanned,
      rpe: rpe[0],
      sleep,
      soreness: soreness[0],
      notes,
      newPRs: [],
    };
    
    logSession(log);
    if (todaySession) {
      markSessionComplete(todaySession.id);
    }
    
    setShowSuccess(true);
    toast.success('Session logged!', { description: 'Great work today!' });
    
    setTimeout(() => navigate('/'), 2000);
  };

  if (showSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="min-h-screen flex items-center justify-center px-4"
      >
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle className="w-10 h-10 text-success" />
          </motion.div>
          <h1 className="text-2xl font-bold mb-2">Session Logged!</h1>
          <p className="text-muted-foreground">Great work today</p>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 pb-24">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Log Session</h1>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("justify-start text-left font-normal gap-2")}>
              <CalendarIcon className="h-4 w-4" />
              {format(sessionDate, 'EEEE, MMMM d')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={sessionDate}
              onSelect={(d) => d && setSessionDate(d)}
              disabled={(date) => date > new Date()}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </motion.div>

      <div className="space-y-6">
        <div className="bg-card rounded-xl p-5 border border-border">
          <h3 className="font-semibold mb-4">Session Type</h3>
          <div className="grid grid-cols-4 gap-2">
            {sessionTypes.map(type => (
              <button key={type} onClick={() => setSessionType(type)}
                className={cn("p-3 rounded-xl border-2 transition-all flex flex-col items-center",
                  sessionType === type ? "border-primary bg-primary/10" : "border-border")}>
                <SessionBadge type={type} size="sm" />
              </button>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-xl p-5 border border-border">
          <h3 className="font-semibold mb-4">RPE (Rate of Perceived Exertion)</h3>
          <Slider value={rpe} onValueChange={setRpe} min={1} max={10} step={1} />
          <p className="text-center mt-2 text-2xl font-bold text-primary">{rpe[0]}</p>
        </div>

        <div className="bg-card rounded-xl p-5 border border-border">
          <h3 className="font-semibold mb-4">Sleep Last Night</h3>
          <div className="grid grid-cols-3 gap-2">
            {sleepOptions.map(option => (
              <button key={option.value} onClick={() => setSleep(option.value)}
                className={cn("p-3 rounded-xl border-2 transition-all text-sm font-medium",
                  sleep === option.value ? "border-primary bg-primary/10" : "border-border")}>
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-xl p-5 border border-border">
          <h3 className="font-semibold mb-4">Post-Session Soreness</h3>
          <Slider value={soreness} onValueChange={setSoreness} min={0} max={10} step={1} />
          <p className="text-center mt-2 text-2xl font-bold">{soreness[0]}</p>
        </div>

        <div className="bg-card rounded-xl p-5 border border-border">
          <h3 className="font-semibold mb-4">Notes</h3>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="How did the session feel? Any PRs?" className="min-h-[100px]" />
        </div>

        <Button onClick={handleSubmit} variant="gold" size="xl" className="w-full">
          <Sparkles className="w-5 h-5" /> Log Session
        </Button>
      </div>
    </div>
  );
}
