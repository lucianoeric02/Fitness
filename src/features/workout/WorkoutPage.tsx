import { Dumbbell } from 'lucide-react';
import { ModuleComingSoon } from '@/features/ModuleComingSoon';

export function WorkoutPage() {
  return (
    <ModuleComingSoon
      title="Treino"
      icon={<Dumbbell className="size-6" />}
      headline="Módulo de treino em construção"
      description="A estrutura de dados já está pronta. A interface de treino é a próxima fase."
      features={[
        'Rotinas e divisão semanal',
        'Biblioteca de exercícios',
        'Registro de séries com poucos toques',
        'Timer de descanso com notificação',
        'Sobrecarga progressiva e recordes',
      ]}
    />
  );
}
