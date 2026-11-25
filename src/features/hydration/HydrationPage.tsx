import { Droplets } from 'lucide-react';
import { ModuleShell } from '@/features/ModuleShell';

export function HydrationPage() {
  return (
    <ModuleShell
      title="Hidratação"
      back="/mais"
      description="Água ao longo do dia em relação à sua meta diária."
      empty={{
        icon: <Droplets className="size-6" />,
        title: 'Nenhum registro de água hoje',
        description: 'Sua meta de água já aparece no Início. Os botões de registro rápido chegam na próxima atualização.',
      }}
      upcoming={['Registro em 1 toque (copo, garrafa, personalizado)', 'Histórico por dia', 'Lembretes ao longo do dia']}
    />
  );
}
