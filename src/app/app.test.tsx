import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider } from 'react-router';
import { ToastProvider } from '@/components/ui/Toast';
import { wipeAllData } from '@/data/backup';
import { db } from '@/data/db';
import { completeOnboarding } from '@/data/repos/onboarding';
import { toDayKey } from '@/lib/dates';
import { router } from './router';

function renderApp() {
  return render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  );
}

beforeEach(async () => {
  await wipeAllData();
  window.location.hash = '#/';
  await router.navigate('/');
});
afterEach(cleanup);

describe('app navigation', () => {
  it('sends a new user through onboarding and lands on Home', async () => {
    renderApp();
    expect(await screen.findByText('Vamos montar seu painel')).toBeTruthy();

    // Validation blocks an empty name.
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText('Informe seu nome.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Como quer ser chamado?'), { target: { value: 'Rafael' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByText('Peso corporal')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Peso atual'), { target: { value: '80,5' } });
    fireEvent.change(screen.getByLabelText('Peso-meta'), { target: { value: '86' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByText('Metas diárias')).toBeTruthy();
    expect((screen.getByLabelText('Calorias por dia') as HTMLInputElement).value).toBe('3400');
    fireEvent.click(screen.getByRole('button', { name: /Começar/ }));

    expect(await screen.findByText(/Rafael/, { selector: 'span' })).toBeTruthy();
    expect(await screen.findByText('Meta principal')).toBeTruthy();
    const weights = await db.bodyWeights.toArray();
    expect(weights[0]?.weightKg).toBe(80.5);
  });

  it('shows five tabs and navigates between them', async () => {
    await completeOnboarding({
      today: toDayKey(),
      profile: { name: 'Rafael' },
      currentWeightKg: 80,
      targetWeightKg: 86,
      targets: { kcal: 3400, proteinG: 180, carbsG: 450, fatG: 95, waterMl: 4000 },
    });
    renderApp();
    const nav = await screen.findByRole('navigation', { name: 'Navegação principal' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Início', 'Treino', 'Nutrição', 'Progresso', 'Mais']);

    fireEvent.click(within(nav).getByText('Mais'));
    expect(await screen.findByText('Dados e backup')).toBeTruthy();

    fireEvent.click(screen.getByText('Metas diárias'));
    expect(await screen.findByLabelText('Calorias por dia')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Metas em vigor' }).hasAttribute('disabled')).toBe(true);

    fireEvent.click(within(nav).getByText('Treino'));
    expect(await screen.findByText('Módulo de treino em construção')).toBeTruthy();
  });
});
