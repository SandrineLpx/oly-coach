import { Home, Calendar, PlayCircle, ClipboardList, Trophy, Settings } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/plan', icon: Calendar, label: 'Plan' },
  { to: '/checkin', icon: PlayCircle, label: 'Train' },
  { to: '/history', icon: ClipboardList, label: 'Log' },
  { to: '/prs', icon: Trophy, label: 'PRs' },
];

export function BottomNav() {
  const location = useLocation();

  // Don't show on onboarding
  if (location.pathname.startsWith('/onboarding')) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-border safe-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
          
          return (
            <NavLink
              key={to}
              to={to}
              className={cn(
                'relative flex flex-col items-center justify-center w-16 h-14 rounded-xl tap-highlight transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="bottomNavIndicator"
                  className="absolute inset-0 bg-primary/10 rounded-xl"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <Icon className={cn('w-5 h-5 relative z-10', isActive && 'stroke-[2.5px]')} />
              <span className="text-[10px] font-medium mt-1 relative z-10">{label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
