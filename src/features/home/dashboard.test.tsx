import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider } from 'react-router';
import { router } from '@/app/router';
import { ToastProvider } from '@/components/ui/Toast';
import { wipeAllData } from '@/data/backup';
import { db } from '@/data/db';
import { logWeight } from '@/data/repos/body';
import { completeOnboarding } from '@/data/repos/onboarding';
import { addDays, toDayKey } from '@/lib/dates';
import { newId } from '@/lib/ids';

function renderApp() {
  return render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  );
}

const today = () => toDayKey();

async function onboard() {
  await completeOnboarding({
    today: addDays(today(), -7),
    profile: { name: 'Rafael' },
    currentWeightKg: 80,
    targetWeightKg: 86,
    targets: { kcal: 3400, proteinG: 180, carbsG: 450, fatG: 95, waterMl: 4000 },
  });
}

beforeEach(async () => {
  await wipeAllData();
  await router.navigate('/');
});
afterEach(cleanup);

describe('dashboard', () => {
  it('shows real values only and setup-oriented empty states', async () => {
    await onboard();
    renderApp();
    expect(await screen.findByText('Nenhuma rotina criada')).toBeTruthy();
    expect(screen.getByText('Adicione sua primeira refeição')).toBeTruthy();
    expect(screen.getByText('3.400')).toBeTruthy(); // remaining = target − 0 consumed
    expect(screen.getByText(/Primeira pesagem/)).toBeTruthy();
    expect(screen.getByText(/Consistência alimentar aparece após registros/)).toBeTruthy();
    expect(screen.getByText('Defina em Objetivos → Frequência de treino')).toBeTruthy();
  });

  it('shows a setup state when there is no weight or goal', async () => {
    await onboard();
    await db.bodyWeights.clear();
    await db.goals.clear();
    renderApp();
    expect(await screen.findByText('Registre seu peso inicial para acompanhar a evolução.')).toBeTruthy();
    expect(screen.getByText('Defina seu objetivo principal para acompanhar o progresso aqui.')).toBeTruthy();
  });

  it('quick water adds update totals immediately and can be undone', async () => {
    await onboard();
    renderApp();
    const card = (await screen.findByText('Hidratação')).closest('div.rounded-card') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: '+300 ml' }));
    await waitFor(() => expect(within(card).getByText('0,3')).toBeTruthy());
    fireEvent.click(within(card).getByRole('button', { name: '+500 ml' }));
    await waitFor(() => expect(within(card).getByText('0,8')).toBeTruthy());
    expect(within(card).getByText('Faltam 3,2 L')).toBeTruthy();

    fireEvent.click(within(card).getByRole('button', { name: /Desfazer \+500 ml/ }));
    await waitFor(() => expect(within(card).getByText('0,3')).toBeTruthy());
    expect(await db.waterEntries.count()).toBe(1);
  });

  it('logs weight from the dashboard and shows the change vs the previous weigh-in', async () => {
    await onboard();
    renderApp();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Registrar peso' }))[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'Registrar peso' });
    const input = within(dialog).getByLabelText('Peso') as HTMLInputElement;
    expect(input.value).toBe('80'); // pre-filled with latest weight
    fireEvent.change(input, { target: { value: '81,2' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText('81,2')).toBeTruthy();
    expect(screen.getByText('+1,2 kg')).toBeTruthy();
    expect(screen.getAllByText('20%')).toHaveLength(2); // (81.2 − 80) / (86 − 80): weight card + goals card
  });

  it('shows active and completed workouts with the right CTA', async () => {
    await onboard();
    const now = new Date().toISOString();
    const base = { createdAt: now, updatedAt: now, day: today(), startedAt: now };
    await db.workoutSessions.add({ ...base, id: newId(), name: 'Push A', status: 'in_progress' });
    renderApp();
    expect(await screen.findByText('Push A')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Retomar treino' }).getAttribute('href')).toBe('#/treino/sessao');
    await db.workoutSessions.toCollection().modify({ status: 'completed', endedAt: now });
    expect((await screen.findByRole('link', { name: 'Ver treino' })).getAttribute('href')).toMatch(/^#\/treino\/historico\//);
  });

  it('cards and quick actions go to the right places', async () => {
    await onboard();
    renderApp();
    const links = (name: string | RegExp) => screen.getAllByRole('link', { name }).map((a) => a.getAttribute('href'));
    await screen.findByText('Esta semana');
    expect(links('Calorias: abrir nutrição')).toEqual(['#/nutricao']);
    expect(links('Macronutrientes: abrir nutrição')).toEqual(['#/nutricao']);
    expect(links('Abrir perfil')).toEqual(['#/mais/perfil']);
    expect(links(/Adicionar alimento/)).toEqual(['#/nutricao']);
    expect(links(/Iniciar treino/)).toEqual(['#/treino']);
    expect(links(/Histórico/)).toEqual(['#/mais/perfil/peso']);
    expect(links(/Ver todos/)).toEqual(['#/mais/objetivos']);

    fireEvent.click(screen.getByRole('button', { name: /Adicionar água/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Adicionar água' });
    fireEvent.click(within(dialog).getByRole('button', { name: '+200 ml' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await db.waterEntries.count()).toBe(1);
  });

  it('updates when data changes elsewhere', async () => {
    await onboard();
    renderApp();
    await screen.findByText('Esta semana');
    await logWeight({ day: today(), weightKg: 79.5 });
    expect(await screen.findByText('79,5')).toBeTruthy();
    expect(await screen.findByText('Abaixo do ponto de partida')).toBeTruthy();
  });
});
