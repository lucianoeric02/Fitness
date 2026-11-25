import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider } from 'react-router';
import { router } from '@/app/router';
import { ToastProvider } from '@/components/ui/Toast';
import { wipeAllData } from '@/data/backup';
import { db } from '@/data/db';
import { ensureExerciseCatalog } from '@/data/repos/exercises';
import { completeOnboarding } from '@/data/repos/onboarding';
import { addTemplateExercise, createTemplate } from '@/data/repos/templates';
import { catalogId } from '@/domain/exerciseCatalog';
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
  await ensureExerciseCatalog();
  const a = await createTemplate({ name: 'Treino A' });
  await addTemplateExercise(a.id, catalogId('bench_bb'));
  await addTemplateExercise(a.id, catalogId('pushdown_rope'));
  const b = await createTemplate({ name: 'Treino B' });
  await addTemplateExercise(b.id, catalogId('squat'));
});
afterEach(cleanup);

describe('workout flow', () => {
  it('never starts a session just by opening the dashboard or the workout tab', async () => {
    await router.navigate('/');
    renderApp();
    expect(await screen.findByText('Treino A')).toBeTruthy();
    await router.navigate('/treino');
    expect(await screen.findByText('Próximo na sequência')).toBeTruthy();
    expect(await db.workoutSessions.count()).toBe(0);
  });

  it('starts explicitly, records a set with rest timer, substitutes, finishes and shows the summary', async () => {
    await router.navigate('/treino');
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar treino' }));
    expect(await screen.findByText('Treino em andamento')).toBeTruthy();

    // First set: prefilled reps, type the load, tap complete.
    const load = await screen.findByLabelText('Carga da série 1');
    fireEvent.change(load, { target: { value: '80' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Concluir série 1' })[0]!);
    expect(await screen.findByRole('timer', { name: 'Timer de descanso' })).toBeTruthy();
    await waitFor(async () => expect((await db.sets.filter((s) => Boolean(s.completedAt)).toArray())[0]?.weightKg).toBe(80));

    // The timer never blocks navigation.
    fireEvent.click(screen.getByRole('button', { name: 'Pular descanso' }));
    await waitFor(() => expect(screen.queryByRole('timer')).toBeNull());

    // Substitute the second exercise for this session only.
    const tricepsHeader = screen.getByRole('button', { name: /Tríceps pulley com corda/ });
    fireEvent.click(tricepsHeader);
    const tricepsCard = tricepsHeader.closest('div.rounded-card') as HTMLElement;
    fireEvent.click(await within(tricepsCard).findByRole('button', { name: 'Substituir' }));
    const picker = await screen.findByRole('dialog', { name: /Substituir/ });
    expect(within(picker).getByText('Alternativas sugeridas')).toBeTruthy();
    fireEvent.click(within(picker).getAllByRole('button', { name: /Tríceps pulley com barra/ })[0]!);
    expect(await screen.findByText('Atualizar a rotina também?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Só neste treino' }));
    expect(await screen.findByText(/substituiu Tríceps pulley com corda/)).toBeTruthy();

    // Finish.
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar treino' }));
    const finish = await screen.findByRole('dialog', { name: 'Finalizar treino?' });
    fireEvent.click(within(finish).getByRole('button', { name: 'Salvar treino' }));
    expect(await screen.findByText('Treino salvo. Bom trabalho!')).toBeTruthy();
    expect(screen.getByText('80 kg × 10')).toBeTruthy();
    const session = (await db.workoutSessions.toArray())[0]!;
    expect(session.status).toBe('completed');

    // Rotation moves on to Treino B.
    await router.navigate('/treino');
    await screen.findByText('Próximo na sequência');
    expect(screen.getByText('Próximo na sequência').closest('div.rounded-card')?.textContent).toContain('Treino B');
  });

  it('asks for confirmation before cancelling a workout', async () => {
    await router.navigate('/treino');
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar treino' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar treino' }));
    expect(await screen.findByText('Cancelar treino?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(await db.workoutSessions.count()).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar treino' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Descartar treino' }));
    await waitFor(async () => expect(await db.workoutSessions.count()).toBe(0));
  });

  it('creates a routine and adds an exercise from the library', async () => {
    await router.navigate('/treino/rotinas/nova');
    renderApp();
    fireEvent.change(await screen.findByLabelText('Nome'), { target: { value: 'Pull' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar e adicionar exercícios' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar exercício' }));
    const picker = await screen.findByRole('dialog', { name: 'Adicionar à rotina' });
    fireEvent.change(within(picker).getByPlaceholderText('Buscar exercício'), { target: { value: 'puxada fr' } });
    fireEvent.click(await within(picker).findByRole('button', { name: /Puxada frontal/ }));
    expect(await screen.findByText('4 × 8–12 · 1min30')).toBeTruthy();
    const t = (await db.workoutTemplates.toArray()).find((x) => x.name === 'Pull')!;
    expect(await db.templateExercises.where('templateId').equals(t.id).count()).toBe(1);
  });
});
