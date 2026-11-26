import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider } from 'react-router';
import { router } from '@/app/router';
import { ToastProvider } from '@/components/ui/Toast';
import { wipeAllData } from '@/data/backup';
import { db } from '@/data/db';
import { completeOnboarding } from '@/data/repos/onboarding';
import { getTargetForDay } from '@/data/repos/targets';
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
  await router.navigate('/mais/hidratacao');
});
afterEach(cleanup);

describe('hydration page', () => {
  it('adds water instantly, shows progress and undoes the last entry without confirmation', async () => {
    renderApp();
    expect(await screen.findByText('Nenhum registro')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '+500' }));
    fireEvent.click(screen.getByRole('button', { name: '+300' }));
    expect(await screen.findByText('Faltam 3,2 L')).toBeTruthy();
    expect(screen.getByText('20%')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Desfazer último/ }));
    expect(await screen.findByText('Faltam 3,5 L')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('adds a custom amount with a note, then edits and deletes it', async () => {
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: 'Outra quantidade' }));
    const sheet = await screen.findByRole('dialog', { name: 'Outra quantidade' });
    fireEvent.change(within(sheet).getByLabelText('Quantidade'), { target: { value: '650' } });
    fireEvent.change(within(sheet).getByLabelText('Observação (opcional)'), { target: { value: 'garrafa' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Adicionar' }));
    fireEvent.click(await screen.findByRole('button', { name: /\+650 ml/ }));
    const edit = await screen.findByRole('dialog', { name: 'Editar registro' });
    fireEvent.change(within(edit).getByLabelText('Quantidade'), { target: { value: '700' } });
    fireEvent.click(within(edit).getByRole('button', { name: 'Salvar' }));
    await waitFor(async () => expect((await db.waterEntries.toArray())[0]).toMatchObject({ amountMl: 700, note: 'garrafa' }));
    fireEvent.click(await screen.findByRole('button', { name: /\+700 ml/ }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Editar registro' })).getByRole('button', { name: 'Excluir registro' }));
    await waitFor(async () => expect(await db.waterEntries.count()).toBe(0));
  });

  it('changes the daily target from today on', async () => {
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: /Alterar meta/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Meta diária de água' });
    fireEvent.change(within(sheet).getByLabelText('Meta'), { target: { value: '4500' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Salvar meta' }));
    await waitFor(async () => expect((await getTargetForDay(toDayKey()))?.waterMl).toBe(4500));
    expect((await getTargetForDay(toDayKey()))?.kcal).toBe(3400); // other targets untouched
  });
});
