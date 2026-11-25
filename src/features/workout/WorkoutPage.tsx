import { Dumbbell } from 'lucide-react';
import { ModuleShell } from '@/features/ModuleShell';

export function WorkoutPage() {
  return (
    <ModuleShell
      title="Treino"
      description="Suas rotinas, a sessão em andamento e o histórico de cada exercício."
      empty={{
        icon: <Dumbbell className="size-6" />,
        title: 'Nenhuma rotina criada',
        description: 'O construtor de rotinas e o registro de séries chegam na próxima atualização.',
      }}
      upcoming={[
        'Rotinas e divisão semanal',
        'Biblioteca de exercícios',
        'Registro de séries com poucos toques',
        'Timer de descanso com notificação',
        'Sobrecarga progressiva e recordes',
      ]}
    />
  );
}
