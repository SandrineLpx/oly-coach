import { useState } from 'react';
import { motion } from 'framer-motion';
import { Dumbbell, Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export default function Auth() {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, resetPassword } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (mode === 'forgot') {
      const { error } = await resetPassword(email);
      setLoading(false);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Check your email', description: 'Password reset link sent.' });
        setMode('signin');
      }
      return;
    }

    const { error } = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password);

    setLoading(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else if (mode === 'signup') {
      toast({ title: 'Account created', description: 'Check your email to verify your account.' });
      setMode('signin');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-8"
      >
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-2">
            <Dumbbell className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-display tracking-tight text-foreground">
            TRAIN SMART
          </h1>
          <p className="text-muted-foreground text-sm">
            {mode === 'signin' && 'Sign in to continue training'}
            {mode === 'signup' && 'Create your account'}
            {mode === 'forgot' && 'Reset your password'}
          </p>
        </div>

        {/* Google sign-in */}
        {mode !== 'forgot' && (
          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogle}
              disabled={googleLoading || loading}
              className="w-full h-12 font-semibold"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.5 12 2.5 6.8 2.5 2.6 6.7 2.6 12s4.2 9.5 9.4 9.5c5.4 0 9-3.8 9-9.2 0-.6-.1-1.1-.2-1.6H12z"/>
              </svg>
              {googleLoading ? 'Redirecting…' : 'Continue with Google'}
            </Button>
            <div className="flex items-center gap-3">
              <div className="h-px bg-border flex-1" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">or</span>
              <div className="h-px bg-border flex-1" />
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-muted-foreground text-xs uppercase tracking-wider">
              Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="pl-10 bg-card border-border"
                required
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div className="space-y-2">
              <Label htmlFor="password" className="text-muted-foreground text-xs uppercase tracking-wider">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 pr-10 bg-card border-border"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {mode === 'signin' && (
            <button
              type="button"
              onClick={() => setMode('forgot')}
              className="text-xs text-primary hover:underline"
            >
              Forgot password?
            </button>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-primary text-primary-foreground font-semibold group"
          >
            {loading ? (
              <span className="animate-pulse">Loading…</span>
            ) : (
              <>
                {mode === 'signin' && 'Sign In'}
                {mode === 'signup' && 'Create Account'}
                {mode === 'forgot' && 'Send Reset Link'}
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </Button>
        </form>

        {/* Toggle */}
        <div className="text-center text-sm text-muted-foreground">
          {mode === 'signin' ? (
            <>
              Don't have an account?{' '}
              <button onClick={() => setMode('signup')} className="text-primary hover:underline font-medium">
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button onClick={() => setMode('signin')} className="text-primary hover:underline font-medium">
                Sign in
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
