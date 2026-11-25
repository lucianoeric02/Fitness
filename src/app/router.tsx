import { createHashRouter, Navigate, Outlet, useLocation, useRouteError } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';
import { ErrorState, LoadingScreen } from '@/components/ui/States';
import { HomePage } from '@/features/home/HomePage';
import { HydrationPage } from '@/features/hydration/HydrationPage';
import { PlanningPage } from '@/features/planning/PlanningPage';
import { DataPage } from '@/features/more/DataPage';
import { MorePage } from '@/features/more/MorePage';
import { ProfilePage } from '@/features/more/ProfilePage';
import { SettingsPage } from '@/features/more/SettingsPage';
import { TargetsPage } from '@/features/more/TargetsPage';
import { NutritionPage } from '@/features/nutrition/NutritionPage';
import { OnboardingPage } from '@/features/onboarding/OnboardingPage';
import { ProgressPage } from '@/features/progress/ProgressPage';
import { WorkoutPage } from '@/features/workout/WorkoutPage';
import { useProfile } from '@/hooks/data';

const ONBOARDING_PATH = '/boas-vindas';

/** Sends first-time users to onboarding and keeps onboarded users out of it. */
function ProfileGate() {
  const profile = useProfile();
  const { pathname } = useLocation();
  if (profile === undefined) return <LoadingScreen />;
  if (profile === null && pathname !== ONBOARDING_PATH) return <Navigate to={ONBOARDING_PATH} replace />;
  if (profile !== null && pathname === ONBOARDING_PATH) return <Navigate to="/" replace />;
  return <Outlet />;
}

function RouteError() {
  const error = useRouteError();
  console.error(error);
  return (
    <div className="pt-safe-12">
      <ErrorState
        description="Esta tela encontrou um erro inesperado. Seus registros continuam salvos no aparelho."
        onRetry={() => window.location.reload()}
      />
    </div>
  );
}

// Hash routing: robust inside the Capacitor WebView and on static hosting.
export const router = createHashRouter([
  {
    element: <ProfileGate />,
    errorElement: <RouteError />,
    children: [
      { path: ONBOARDING_PATH, element: <OnboardingPage /> },
      {
        element: <AppShell />,
        errorElement: <RouteError />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'treino', element: <WorkoutPage /> },
          { path: 'nutricao', element: <NutritionPage /> },
          { path: 'progresso', element: <ProgressPage /> },
          { path: 'mais', element: <MorePage /> },
          { path: 'mais/hidratacao', element: <HydrationPage /> },
          { path: 'mais/planejamento', element: <PlanningPage /> },
          { path: 'mais/perfil', element: <ProfilePage /> },
          { path: 'mais/metas', element: <TargetsPage /> },
          { path: 'mais/configuracoes', element: <SettingsPage /> },
          { path: 'mais/dados', element: <DataPage /> },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
]);
