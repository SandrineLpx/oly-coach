import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  User, Dumbbell, Calendar, Activity, ChevronRight, 
  Check, Sparkles, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { PR } from '@/lib/types';
import { usePowerUser } from '@/lib/powerUser';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const KEY_LIFTS = ['Snatch', 'Clean & Jerk', 'Back Squat', 'Front Squat'];
const EXTRA_LIFTS = ['Power Snatch', 'Power Clean', 'Clean', 'Jerk', 'Deadlift', 'Snatch Balance', 'Snatch Deadlift'];

interface StepProps {
  onNext: () => void;
  onBack?: () => void;
}

function WelcomeStep({ onNext }: StepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center justify-center min-h-screen px-6 text-center"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
        className="w-24 h-24 mb-8 rounded-2xl bg-gradient-gold flex items-center justify-center shadow-gold"
      >
        <Dumbbell className="w-12 h-12 text-primary-foreground" />
      </motion.div>
      
      <h1 className="text-4xl font-bold mb-3 tracking-tight">
        Train <span className="text-gradient-gold">Smart</span>
      </h1>
      
      <p className="text-muted-foreground text-lg mb-2 max-w-sm">
        Your personal Olympic weightlifting coach
      </p>
      
      <p className="text-muted-foreground text-sm mb-10 max-w-xs">
        Readiness-based programming for serious lifters
      </p>
      
      <Button size="xl" variant="gold" onClick={onNext} className="w-full max-w-xs">
        Get Started
        <ArrowRight className="w-5 h-5" />
      </Button>
    </motion.div>
  );
}

function ProfileStep({ onNext }: StepProps) {
  const { setProfile, profile } = useAppStore();
  const [name, setName] = useState(profile?.name || '');
  const [trainingAge, setTrainingAge] = useState(profile?.trainingAge || 1);

  const handleNext = () => {
    setProfile({
      name,
      trainingAge,
      preferredDays: [1, 3, 5],
      programStartDate: new Date().toISOString(),
      stravaConnected: false,
      weatherPreference: 'both',
      cardioPreference: 'none',
    });
    onNext();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="min-h-screen px-6 py-12"
    >
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <User className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Your Profile</h2>
          <p className="text-sm text-muted-foreground">Let's get to know you</p>
        </div>
      </div>
      
      <div className="space-y-6">
        <div>
          <Label htmlFor="name" className="text-sm font-medium">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="mt-2 h-12 bg-card border-border"
          />
        </div>
        
        <div>
          <Label className="text-sm font-medium">Years of Olympic lifting</Label>
          <div className="mt-4 flex items-center gap-4">
            <Slider
              value={[trainingAge]}
              onValueChange={(v) => setTrainingAge(v[0])}
              min={0}
              max={15}
              step={1}
              className="flex-1"
            />
            <span className="text-2xl font-bold w-12 text-right">{trainingAge}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {trainingAge === 0 ? 'Beginner' : trainingAge < 3 ? 'Intermediate' : 'Advanced'}
          </p>
        </div>
      </div>
      
      <div className="mt-10">
        <Button 
          size="lg" 
          onClick={handleNext} 
          disabled={!name.trim()}
          className="w-full"
        >
          Continue
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>
    </motion.div>
  );
}

function PRsStep({ onNext }: StepProps) {
  const { addPR, prs, preferences } = useAppStore();
  const unit = preferences.units;
  const [showExtra, setShowExtra] = useState(false);
  const [liftPRs, setLiftPRs] = useState<Record<string, number>>(() => {
    const existing: Record<string, number> = {};
    prs.forEach(pr => {
      existing[pr.liftName] = pr.weight;
    });
    return existing;
  });

  const handlePRChange = (lift: string, value: string) => {
    const weight = parseInt(value) || 0;
    setLiftPRs(prev => ({ ...prev, [lift]: weight }));
  };

  const handleNext = () => {
    Object.entries(liftPRs).forEach(([liftName, weight]) => {
      if (weight > 0) {
        addPR({
          id: Math.random().toString(36).substring(2, 11),
          liftName,
          weight,
          unit,
          date: new Date().toISOString().split('T')[0],
        });
      }
    });
    onNext();
  };

  const renderLiftInput = (lift: string) => (
    <div key={lift} className="bg-card rounded-xl p-4 border border-border">
      <Label className="text-sm font-medium text-muted-foreground">{lift}</Label>
      <div className="flex items-center gap-3 mt-2">
        <Input
          type="number"
          value={liftPRs[lift] || ''}
          onChange={(e) => handlePRChange(lift, e.target.value)}
          placeholder="0"
          className="h-12 bg-background border-border text-xl font-bold text-center"
        />
        <span className="text-muted-foreground font-medium w-8">{unit}</span>
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="min-h-screen px-6 py-12"
    >
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Your PRs</h2>
          <p className="text-sm text-muted-foreground">Current personal records</p>
        </div>
      </div>

      <div className="space-y-4">
        {KEY_LIFTS.map(renderLiftInput)}
      </div>

      {/* Expandable extra lifts */}
      <button
        onClick={() => setShowExtra(!showExtra)}
        className="w-full text-sm text-primary font-medium mt-4 py-2 flex items-center justify-center gap-1"
      >
        {showExtra ? 'Hide extra lifts' : 'Add more lifts (optional)'}
        <ChevronRight className={cn("w-4 h-4 transition-transform", showExtra && "rotate-90")} />
      </button>

      {showExtra && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="space-y-4 mt-2"
        >
          {EXTRA_LIFTS.map(renderLiftInput)}
        </motion.div>
      )}

      <div className="mt-8">
        <Button size="lg" onClick={handleNext} className="w-full">
          Continue
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>
    </motion.div>
  );
}

function ScheduleStep({ onNext }: StepProps) {
  const { profile, setProfile } = useAppStore();
  const isPowerUser = usePowerUser();
  const [selectedDays, setSelectedDays] = useState<number[]>(profile?.preferredDays || [1, 3, 5]);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day].sort()
    );
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('error');
      return;
    }
    setLocationStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (profile) {
          setProfile({
            ...profile,
            location: { lat: pos.coords.latitude, lon: pos.coords.longitude },
          });
        }
        setLocationStatus('done');
      },
      () => setLocationStatus('error'),
      { timeout: 10000 },
    );
  };

  const handleNext = () => {
    if (profile) {
      setProfile({ ...profile, preferredDays: selectedDays });
    }
    onNext();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="min-h-screen px-6 py-12"
    >
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Calendar className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Training Days</h2>
          <p className="text-sm text-muted-foreground">When do you usually train?</p>
        </div>
      </div>
      
      <div className="grid grid-cols-7 gap-2 mb-8">
        {DAYS.map((day, index) => (
          <button
            key={day}
            onClick={() => toggleDay(index)}
            className={cn(
              'aspect-square rounded-xl flex flex-col items-center justify-center transition-all border-2',
              selectedDays.includes(index)
                ? 'bg-primary/10 border-primary text-primary'
                : 'bg-card border-transparent text-muted-foreground hover:border-border'
            )}
          >
            <span className="text-xs font-medium">{day}</span>
            {selectedDays.includes(index) && (
              <Check className="w-4 h-4 mt-1" />
            )}
          </button>
        ))}
      </div>
      
      <div className="bg-card rounded-xl p-4 border border-border mb-8">
        <p className="text-sm text-muted-foreground">
          <span className="text-foreground font-semibold">{selectedDays.length} days</span> selected
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {selectedDays.length === 3 
            ? 'Perfect for Olympic lifting progression'
            : selectedDays.length < 3
            ? 'Consider adding another day for best results'
            : 'Great volume, watch your recovery'}
        </p>
      </div>
      
      {/* Location for weather */}
      <div className="bg-card rounded-xl p-4 border border-border mb-8">
        <Label className="text-sm font-medium">Location (for weather-based cardio suggestions)</Label>
        <button
          onClick={handleGetLocation}
          disabled={locationStatus === 'loading'}
          className={cn(
            'w-full mt-3 p-3 rounded-lg border text-sm font-medium transition-all text-center',
            locationStatus === 'done' ? 'border-success text-success bg-success/5' :
            locationStatus === 'error' ? 'border-destructive text-destructive bg-destructive/5' :
            'border-border text-muted-foreground hover:border-primary/50'
          )}
        >
          {locationStatus === 'idle' && 'Enable location'}
          {locationStatus === 'loading' && 'Getting location...'}
          {locationStatus === 'done' && 'Location set'}
          {locationStatus === 'error' && 'Could not get location — skip for now'}
        </button>
      </div>

      <Button
        size="lg"
        onClick={handleNext}
        disabled={selectedDays.length === 0}
        className="w-full"
      >
        Continue
        <ChevronRight className="w-5 h-5" />
      </Button>
    </motion.div>
  );
}

function IntegrationsStep({ onNext }: StepProps) {
  const { profile, setProfile } = useAppStore();
  const [stravaConnected, setStravaConnected] = useState(false);
  const [cardioPreference, setCardioPreference] = useState<'running' | 'rowing' | 'cycling' | 'none'>(
    profile?.cardioPreference || 'none'
  );

  const cardioOptions: { value: 'running' | 'rowing' | 'cycling' | 'none'; label: string }[] = [
    { value: 'cycling', label: 'Cycling' },
    { value: 'running', label: 'Running' },
    { value: 'rowing', label: 'Rowing' },
    { value: 'none', label: 'None' },
  ];

  const handleFinish = () => {
    if (profile) {
      setProfile({ ...profile, cardioPreference, stravaConnected });
    }
    onNext();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="min-h-screen px-6 py-12"
    >
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Activity className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Integrations</h2>
          <p className="text-sm text-muted-foreground">Connect your other apps</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Cardio preference */}
        <div className="bg-card rounded-xl p-4 border border-border">
          <Label className="text-sm font-medium">Outdoor cardio preference</Label>
          <div className="grid grid-cols-4 gap-2 mt-3">
            {cardioOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setCardioPreference(opt.value)}
                className={cn(
                  'p-2 rounded-lg border-2 text-xs font-medium transition-all text-center',
                  cardioPreference === opt.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Strava */}
        <button
          onClick={() => setStravaConnected(!stravaConnected)}
          className={cn(
            'w-full bg-card rounded-xl p-4 border-2 transition-all text-left',
            stravaConnected ? 'border-success' : 'border-border'
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FC4C02]/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-[#FC4C02]" />
              </div>
              <div>
                <p className="font-semibold">Strava</p>
                <p className="text-xs text-muted-foreground">Sync cardio activities</p>
              </div>
            </div>
            {stravaConnected && (
              <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center">
                <Check className="w-4 h-4 text-success-foreground" />
              </div>
            )}
          </div>
        </button>

        <div className="bg-card/50 rounded-xl p-4 border border-border">
          <p className="text-xs text-muted-foreground">
            Connecting Strava helps adjust your training based on recent cardio intensity.
            This is optional and can be done later.
          </p>
        </div>
      </div>

      <div className="mt-10 space-y-3">
        <Button size="lg" variant="gold" onClick={handleFinish} className="w-full">
          Let's Go!
          <Sparkles className="w-5 h-5" />
        </Button>
        {!stravaConnected && (
          <button onClick={handleFinish} className="w-full text-sm text-muted-foreground py-2">
            Skip for now
          </button>
        )}
      </div>
    </motion.div>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { completeOnboarding, generateWeeklyPlan, profile } = useAppStore();
  const isPowerUser = usePowerUser();
  const [step, setStep] = useState(0);

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => Math.max(0, s - 1));

  const finishOnboarding = () => {
    completeOnboarding();
    if (profile) {
      generateWeeklyPlan(profile.preferredDays);
    }
    navigate('/');
  };

  // Olympic-weightlifting first: hide cross-training integrations from
  // standard users. Power users still see Strava + cardio prefs.
  const steps = [
    <WelcomeStep key="welcome" onNext={nextStep} />,
    <ProfileStep key="profile" onNext={nextStep} onBack={prevStep} />,
    <PRsStep key="prs" onNext={nextStep} onBack={prevStep} />,
    <ScheduleStep key="schedule" onNext={isPowerUser ? nextStep : finishOnboarding} onBack={prevStep} />,
    ...(isPowerUser
      ? [<IntegrationsStep key="integrations" onNext={finishOnboarding} onBack={prevStep} />]
      : []),
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Progress indicator */}
      {step > 0 && (
        <div className="fixed top-0 left-0 right-0 z-50 px-6 pt-4">
          <div className="flex gap-1.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1 rounded-full flex-1 transition-all',
                  i < step ? 'bg-primary' : 'bg-border'
                )}
              />
            ))}
          </div>
        </div>
      )}
      
      <AnimatePresence mode="wait">
        {steps[step]}
      </AnimatePresence>
    </div>
  );
}
