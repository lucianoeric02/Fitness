import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

  async function onboarded() {
    await completeOnboarding({
      today: toDayKey(),
      profile: { name: 'Rafael' },
      currentWeightKg: 80,
      targetWeightKg: 86,
      targets: { kcal: 3400, proteinG: 180, carbsG: 450, fatG: 95, waterMl: 4000 },
    });
  }

  it('shows five tabs, highlights the active one and navigates', async () => {
    await onboarded();
    renderApp();
    const nav = await screen.findByRole('navigation', { name: 'Navegação principal' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Início', 'Treino', 'Nutrição', 'Progresso', 'Mais']);
    expect(within(nav).getByText('Início').closest('a')?.getAttribute('aria-current')).toBe('page');

    fireEvent.click(within(nav).getByText('Treino'));
    expect(await screen.findByText('Nenhuma rotina criada')).toBeTruthy();
    expect(within(nav).getByText('Treino').closest('a')?.getAttribute('aria-current')).toBe('page');
    expect(within(nav).getByText('Início').closest('a')?.getAttribute('aria-current')).toBeNull();
  });

  it.each([
    ['/treino', 'Treino'],
    ['/nutricao', 'Nutrição'],
    ['/progresso', 'Progresso'],
    ['/mais', 'Mais'],
    ['/mais/hidratacao', 'Hidratação'],
    ['/mais/planejamento', 'Planejamento'],
    ['/mais/perfil', 'Perfil'],
    ['/mais/metas', 'Metas diárias'],
    ['/mais/configuracoes', 'Configurações'],
    ['/mais/dados', 'Dados e backup'],
  ])('renders %s', async (path, heading) => {
    await onboarded();
    await router.navigate(path);
    renderApp();
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeTruthy();
  });

  it('links every More destination', async () => {
    await onboarded();
    await router.navigate('/mais');
    renderApp();
    for (const name of ['Hidratação', 'Planejamento', 'Perfil', 'Configurações', 'Dados e backup']) {
      expect((await screen.findByText(name)).closest('a')).toBeTruthy();
    }
  });

  it('asks before leaving a form with unsaved changes', async () => {
    await onboarded();
    await router.navigate('/mais/metas');
    renderApp();
    const kcal = await screen.findByLabelText('Calorias por dia');
    fireEvent.change(kcal, { target: { value: '3600' } });

    const nav = screen.getByRole('navigation', { name: 'Navegação principal', hidden: true });
    fireEvent.click(within(nav).getByText('Início'));
    expect(await screen.findByText('Descartar alterações?')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(router.state.location.pathname).toBe('/mais/metas');
    expect((screen.getByLabelText('Calorias por dia') as HTMLInputElement).value).toBe('3600');

    fireEvent.click(within(nav).getByText('Início'));
    fireEvent.click(await screen.findByRole('button', { name: 'Descartar' }));
    expect(await screen.findByText('Meta principal')).toBeTruthy();
  });

  it('hides the bottom navigation while typing', async () => {
    await onboarded();
    await router.navigate('/mais/metas');
    renderApp();
    const kcal = await screen.findByLabelText('Calorias por dia');
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' });
    expect(nav.hasAttribute('inert')).toBe(false);
    act(() => kcal.focus());
    await waitFor(() => expect(nav.hasAttribute('inert')).toBe(true));
    act(() => kcal.blur());
    await waitFor(() => expect(nav.hasAttribute('inert')).toBe(false));
  });
});
