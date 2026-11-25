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
        title: 'Seus treinos seguem em sequência',
        description: 'A ordem das rotinas (A → B → C → A…) é definida em Treino. Lembretes chegam em uma próxima atualização.',
      }}
      upcoming={['Lembretes de treino', 'Lembretes de refeições e água', 'Lembrete de pesagem']}
    />
  );
}
