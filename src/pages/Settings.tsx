import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Scale, RotateCcw, Trophy, LogOut, BookOpen, Upload, Target } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export default function Settings() {
  const navigate = useNavigate();
  const { profile, setProfile, preferences, updatePreferences, resetApp, activeProgram, fetchActiveProgram, getCurrentProgramWeek } = useAppStore();
  const { signOut } = useAuth();

  useEffect(() => { fetchActiveProgram(); }, []);

  const handleReset = () => {
    if (confirm('Reset all data? This cannot be undone.')) {
      resetApp();
      navigate('/onboarding');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen px-4 py-6 pb-24">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Settings</h1>
      </motion.div>

      <div className="space-y-4">
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3 mb-4">
            <User className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Profile</h3>
          </div>
          <p className="text-sm">{profile?.name || 'Not set'}</p>
          <p className="text-xs text-muted-foreground">{profile?.trainingAge || 0} years experience</p>
        </div>

        <button onClick={() => navigate('/prs')} className="w-full bg-card rounded-xl p-4 border border-border flex items-center gap-3 text-left hover:border-primary/50 transition-colors">
          <Trophy className="w-5 h-5 text-primary" />
          <div className="flex-1">
            <h3 className="font-semibold">Manage PRs</h3>
            <p className="text-xs text-muted-foreground">Add, edit, or delete personal records</p>
          </div>
        </button>

        <button onClick={() => navigate('/import-program')} className="w-full bg-card rounded-xl p-4 border border-border flex items-center gap-3 text-left hover:border-primary/50 transition-colors">
          <Upload className="w-5 h-5 text-primary" />
          <div className="flex-1">
            <h3 className="font-semibold">Import Program</h3>
            <p className="text-xs text-muted-foreground">Upload or paste a coach's program (Excel, text)</p>
          </div>
        </button>

        {activeProgram && (
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-3 mb-3">
              <BookOpen className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Active Program</h3>
            </div>
            <p className="text-sm font-medium">{activeProgram.name}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Week {getCurrentProgramWeek()} of {activeProgram.weeks} · Started {activeProgram.start_date}
            </p>
            <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${((getCurrentProgramWeek() || 1) / activeProgram.weeks) * 100}%` }} />
            </div>
          </div>
        )}

        {/* Competition Date */}
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3 mb-3">
            <Target className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Competition Date</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Set a competition date to activate automatic taper logic (volume reduction D-10 to D-1).
          </p>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={profile?.competitionDate || ''}
              onChange={(e) => {
                if (profile) {
                  setProfile({ ...profile, competitionDate: e.target.value || undefined });
                }
              }}
              className="h-10 bg-background border-border"
            />
            {profile?.competitionDate && (
              <button
                onClick={() => {
                  if (profile) setProfile({ ...profile, competitionDate: undefined });
                }}
                className="text-xs text-destructive hover:underline whitespace-nowrap"
              >
                Clear
              </button>
            )}
          </div>
          {profile?.competitionDate && (() => {
            const daysUntil = Math.round((new Date(profile.competitionDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
            if (daysUntil >= 0) {
              return <p className="text-xs text-primary mt-2">{daysUntil} days until competition</p>;
            }
            return <p className="text-xs text-muted-foreground mt-2">Competition date has passed</p>;
          })()}
        </div>

        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3 mb-4">
            <Scale className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Units</h3>
          </div>
          <div className="flex gap-2">
            {(['kg', 'lb'] as const).map(unit => (
              <button key={unit}
                onClick={() => updatePreferences({ units: unit })}
                className={`px-4 py-2 rounded-lg border ${preferences.units === unit ? 'border-primary bg-primary/10' : 'border-border'}`}>
                {unit}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={handleReset} variant="destructive" className="w-full">
          <RotateCcw className="w-4 h-4" /> Reset All Data
        </Button>

        <Button onClick={handleSignOut} variant="outline" className="w-full">
          <LogOut className="w-4 h-4" /> Sign Out
        </Button>
      </div>
    </div>
  );
}
