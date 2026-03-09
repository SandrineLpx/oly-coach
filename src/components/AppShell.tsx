import { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import { useLocation } from 'react-router-dom';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const isOnboarding = location.pathname.startsWith('/onboarding');
  const isAuth = location.pathname.startsWith('/auth') || location.pathname.startsWith('/reset-password');

  return (
    <div className="min-h-screen bg-background">
      <main className={isOnboarding || isAuth ? '' : 'pb-20'}>
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
