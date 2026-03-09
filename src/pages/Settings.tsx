import { motion } from 'framer-motion';
import { Settings as SettingsIcon, User, Scale, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
  const navigate = useNavigate();
  const { profile, preferences, updatePreferences, resetApp } = useAppStore();

  const handleReset = () => {
    if (confirm('Reset all data? This cannot be undone.')) {
      resetApp();
      navigate('/onboarding');
    }
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

        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3 mb-4">
            <Scale className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Units</h3>
          </div>
          <div className="flex gap-2">
            {['kg', 'lb'].map(unit => (
              <button key={unit}
                onClick={() => updatePreferences({ units: unit as 'kg' | 'lb' })}
                className={`px-4 py-2 rounded-lg border ${preferences.units === unit ? 'border-primary bg-primary/10' : 'border-border'}`}>
                {unit}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={handleReset} variant="destructive" className="w-full">
          <RotateCcw className="w-4 h-4" /> Reset All Data
        </Button>
      </div>
    </div>
  );
}
