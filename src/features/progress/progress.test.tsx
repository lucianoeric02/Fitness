import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RouterProvider } from 'react-router';
import { router } from '@/app/router';
import { ToastProvider } from '@/components/ui/Toast';
import { wipeAllData } from '@/data/backup';
import { logWeight } from '@/data/repos/body';
import { completeOnboarding } from '@/data/repos/onboarding';
import { addWater } from '@/data/repos/water';
import { addDays, toDayKey } from '@/lib/dates';

function renderApp() {
  return render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  );
}

const today = () => toDayKey();

beforeEach(async () => {
  await wipeAllData();
  await completeOnboarding({
    today: addDays(today(), -60),
    profile: { name: 'Rafael' },
    currentWeightKg: 80,
    targetWeightKg: 86,
    targets: { kcal: 3400, proteinG: 180, carbsG: 450, fatG: 95, waterMl: 4000 },
  });
});
afterEach(cleanup);

describe('progress', () => {
  it('shows facts from real data and explains sparse periods instead of drawing them', async () => {
    await logWeight({ day: addDays(today(), -10), weightKg: 81 });
    await logWeight({ day: today(), weightKg: 82 });
    await router.navigate('/progresso');
    renderApp();
    expect(await screen.findByText('Objetivo principal')).toBeTruthy();
    expect(screen.getAllByText('+2 kg')).toHaveLength(2); // since initial and within 90 days (80 → 82)
    expect(screen.getByRole('img', { name: 'Gráfico de peso corporal' })).toBeTruthy();
    expect(screen.getByText('Média móvel 7 dias (calculada)')).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: '7 dias' }));
    expect(await screen.findByText(/Registre pelo menos 2 pesagens em 7 dias/)).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'Gráfico de peso corporal' })).toBeNull();
  });

  it('shows empty states for training, nutrition and measurements without data', async () => {
    await router.navigate('/progresso');
    renderApp();
    expect(await screen.findByText(/Nenhuma medida registrada/)).toBeTruthy();
    expect(screen.getByText(/Sem avaliações/)).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Treino' }));
    expect(await screen.findByText('Sem treinos concluídos')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Nutrição' }));
    expect(await screen.findByText('Sem registros no período')).toBeTruthy();
  });

  it('builds a factual weekly report', async () => {
    await logWeight({ day: today(), weightKg: 81.2 });
    await addWater(today(), 500);
    await router.navigate('/progresso?aba=semana');
    renderApp();
    expect(await screen.findByText('Esta semana')).toBeTruthy();
    expect(screen.getByText(/0 treinos concluídos/)).toBeTruthy();
    expect(screen.getByText('Nenhuma refeição registrada.')).toBeTruthy();
    expect(screen.getByText(/Média de 500 ml nos 1 dias com registro/)).toBeTruthy();
    expect(screen.getByText(/Peso corporal: /)).toBeTruthy();
  });
});
