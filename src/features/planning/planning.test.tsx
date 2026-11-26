import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider } from 'react-router';

const perm = { state: 'prompt' as 'prompt' | 'granted' | 'denied' | 'unsupported' };
const requestSpy = vi.fn(async () => {
  perm.state = 'denied';
  return 'denied' as const;
});
vi.mock('@/services/reminderNotifications', () => ({
  notificationPermission: vi.fn(async () => perm.state),
  requestNotificationPermission: () => requestSpy(),
  syncReminderNotifications: vi.fn(async () => 0),
  listenReminderTaps: vi.fn(async () => () => undefined),
}));

import { router } from '@/app/router';
import { ToastProvider } from '@/components/ui/Toast';
import { wipeAllData } from '@/data/backup';
import { db } from '@/data/db';
import { completeOnboarding } from '@/data/repos/onboarding';
import { ensureDefaultReminders } from '@/data/repos/planning';
import { getSettings } from '@/data/repos/profile';
import { toDayKey } from '@/lib/dates';

function renderApp() {
  return render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  );
}

beforeEach(async () => {
  await wipeAllData();
  perm.state = 'prompt';
  requestSpy.mockClear();
  await completeOnboarding({
    today: toDayKey(),
    profile: { name: 'Rafael' },
    currentWeightKg: 80,
    targetWeightKg: 86,
    targets: { kcal: 3400, proteinG: 180, carbsG: 450, fatG: 95, waterMl: 4000 },
  });
  await ensureDefaultReminders();
});
afterEach(cleanup);

describe('planning UI', () => {
  it('sets the weekly pattern and marks/unmarks days', async () => {
    await router.navigate('/mais/planejamento');
    renderApp();
    expect(await screen.findByText(/Sem plano: toque nos dias/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Seg: descanso' }));
    fireEvent.click(screen.getByRole('button', { name: 'Qua: descanso' }));
    await waitFor(async () => expect((await getSettings()).trainingDays).toEqual([1, 3]));
    expect(await screen.findByText(/2 dias de treino por semana/)).toBeTruthy();
  });

  it('explains before asking for notification permission, and asks only once', async () => {
    await router.navigate('/mais/lembretes');
    renderApp();
    fireEvent.click(await screen.findByRole('switch', { name: 'Ativar Pesagem' }));
    expect(await screen.findByText('Permitir notificações?')).toBeTruthy();
    expect(requestSpy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() => expect(requestSpy).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Notificações bloqueadas/)).toBeTruthy();
    await waitFor(async () => expect((await db.reminders.toArray()).find((r) => r.type === 'weigh_in')?.enabled).toBe(true));

    // With permission denied, enabling another reminder does not prompt again.
    fireEvent.click(screen.getByRole('switch', { name: 'Ativar Treino' }));
    await waitFor(async () => expect((await db.reminders.toArray()).find((r) => r.type === 'workout')?.enabled).toBe(true));
    expect(screen.queryByText('Permitir notificações?')).toBeNull();
    expect(requestSpy).toHaveBeenCalledTimes(1);
  });

  it('declining the explanation keeps the reminder off and does not prompt', async () => {
    await router.navigate('/mais/lembretes');
    renderApp();
    fireEvent.click(await screen.findByRole('switch', { name: 'Ativar Beber água' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Agora não' }));
    expect(requestSpy).not.toHaveBeenCalled();
    expect((await db.reminders.toArray()).find((r) => r.type === 'water')?.enabled).toBe(false);
  });

  it('edits and deletes a reminder', async () => {
    perm.state = 'granted';
    await router.navigate('/mais/lembretes');
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: /Registrar refeições/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Editar lembrete' });
    fireEvent.change(within(sheet).getByLabelText('Título'), { target: { value: 'Diário alimentar' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Salvar' }));
    await waitFor(async () => expect((await db.reminders.toArray()).some((r) => r.title === 'Diário alimentar')).toBe(true));
    fireEvent.click(await screen.findByRole('button', { name: /Diário alimentar/ }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Editar lembrete' })).getByRole('button', { name: 'Excluir lembrete' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir' }));
    await waitFor(async () => expect(await db.reminders.count()).toBe(4));
  });
});
