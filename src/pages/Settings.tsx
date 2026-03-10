import { motion } from 'framer-motion';
import { User, Scale, RotateCcw, Trophy, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export default function Settings() {
  const navigate = useNavigate();
  const { profile, preferences, updatePreferences, resetApp } = useAppStore();
  const { signOut } = useAuth();

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
