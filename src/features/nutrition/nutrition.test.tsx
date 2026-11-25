import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider } from 'react-router';
import { router } from '@/app/router';
import { ToastProvider } from '@/components/ui/Toast';
import { wipeAllData } from '@/data/backup';
import { db } from '@/data/db';
import { ensureNutritionData } from '@/data/repos/foods';
import { completeOnboarding } from '@/data/repos/onboarding';
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
  await completeOnboarding({
    today: toDayKey(),
    profile: { name: 'Rafael' },
    currentWeightKg: 80,
    targetWeightKg: 86,
    targets: { kcal: 3400, proteinG: 180, carbsG: 450, fatG: 95, waterMl: 4000 },
  });
  await ensureNutritionData();
});
afterEach(cleanup);

describe('nutrition UI', () => {
  it('shows the empty day with targets, then logs a food with live preview', async () => {
    await router.navigate('/nutricao');
    renderApp();
    expect(await screen.findByText('Nenhuma refeição registrada')).toBeTruthy();
    expect(screen.getAllByText('3.400 kcal')).toHaveLength(2); // meta + restantes

    fireEvent.click(screen.getByRole('link', { name: 'Adicionar em Almoço' }));
    fireEvent.change(await screen.findByPlaceholderText('Buscar alimento'), { target: { value: 'arroz branco' } });
    fireEvent.click(await screen.findByRole('button', { name: /Arroz branco cozido/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Arroz branco cozido' });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Gramas' }));
    fireEvent.change(within(sheet).getByLabelText('Quantidade'), { target: { value: '150' } });
    expect(within(sheet).getByText('192')).toBeTruthy(); // 128 × 1.5
    expect((within(sheet).getByRole('radio', { name: 'Almoço' }) as HTMLElement).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Adicionar' }));
    await waitFor(async () => expect(await db.foodEntries.count()).toBe(1));

    fireEvent.click(await screen.findByRole('button', { name: 'Concluir' }));
    expect(await screen.findByText('Arroz branco cozido')).toBeTruthy();
    expect(screen.getAllByText('192 kcal', { selector: 'span' }).length).toBeGreaterThan(0);
    expect(screen.getByText('3.208')).toBeTruthy(); // remaining = 3400 − 192
  });

  it('edits a logged entry and moves it to another meal', async () => {
    const rice = (await db.foods.get('seed-food-arroz_branco'))!;
    const { addFoodEntry } = await import('@/data/repos/foodLog');
    await addFoodEntry({ day: toDayKey(), slot: 'lunch', food: rice, quantity: 100 });
    await router.navigate('/nutricao');
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: /Arroz branco cozido/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Arroz branco cozido' });
    fireEvent.change(within(sheet).getByLabelText('Quantidade'), { target: { value: '200' } });
    fireEvent.click(within(sheet).getByRole('radio', { name: 'Jantar' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Salvar' }));
    await waitFor(async () => expect((await db.foodEntries.toArray())[0]).toMatchObject({ grams: 200, slot: 'dinner' }));
    expect((await screen.findAllByText('256 kcal', { selector: 'span' })).length).toBeGreaterThan(0);
  });

  it('shows a setup state when no targets exist, and blocks future days', async () => {
    await db.nutritionTargets.clear();
    await router.navigate('/nutricao');
    renderApp();
    expect(await screen.findByText('Metas diárias não configuradas')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Próximo dia' }).hasAttribute('disabled')).toBe(true);
  });
});
