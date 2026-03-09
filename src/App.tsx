import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { useAppStore } from "@/lib/store";

import Dashboard from "./pages/Dashboard";
import Onboarding from "./pages/Onboarding";
import WeeklyPlan from "./pages/WeeklyPlan";
import CheckIn from "./pages/CheckIn";
import LogSession from "./pages/LogSession";
import PRs from "./pages/PRs";
import History from "./pages/History";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  const { onboardingComplete } = useAppStore();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppShell>
            <Routes>
              <Route 
                path="/" 
                element={onboardingComplete ? <Dashboard /> : <Navigate to="/onboarding" replace />} 
              />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/plan" element={<WeeklyPlan />} />
              <Route path="/checkin" element={<CheckIn />} />
              <Route path="/log" element={<LogSession />} />
              <Route path="/prs" element={<PRs />} />
              <Route path="/history" element={<History />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppShell>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;