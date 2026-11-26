import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import '@fontsource-variable/inter';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './styles/index.css';
import { router } from './app/router';
import { ToastProvider } from './components/ui/Toast';
import { requestPersistentStorage } from './data/db';
import { ensureExerciseCatalog } from './data/repos/exercises';
import { ensureNutritionData } from './data/repos/foods';
import { ensureDefaultReminders } from './data/repos/planning';

void requestPersistentStorage();
// Starter exercise catalog: installed once, offline, removable in Dados e backup.
void ensureExerciseCatalog().catch((e) => console.error('Catalog seed failed', e));
void ensureNutritionData().catch((e) => console.error('Nutrition seed failed', e));
void ensureDefaultReminders().catch((e) => console.error('Reminder seed failed', e));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  </StrictMode>,
);
