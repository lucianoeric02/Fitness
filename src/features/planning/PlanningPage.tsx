import { CalendarDays } from 'lucide-react';
import { ModuleShell } from '@/features/ModuleShell';

export function PlanningPage() {
  return (
    <ModuleShell
      title="Planejamento"
      back="/mais"
      description="A semana de treinos e os lembretes que mantêm a rotina."
      empty={{
        icon: <CalendarDays className="size-6" />,
        title: 'Nenhuma semana planejada',
        description: 'O planejamento usa as rotinas do módulo de Treino e chega depois dele.',
      }}
      upcoming={['Rotina atribuída a cada dia da semana', 'Dias de descanso', 'Lembretes de treino, refeições e pesagem']}
    />
  );
}
