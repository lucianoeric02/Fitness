import { TrendingUp } from 'lucide-react';
import { ModuleShell } from '@/features/ModuleShell';

export function ProgressPage() {
  return (
    <ModuleShell
      title="Progresso"
      description="Peso corporal, medidas e a evolução das suas metas ao longo do tempo."
      empty={{
        icon: <TrendingUp className="size-6" />,
        title: 'Sem histórico para analisar',
        description: 'Seu peso inicial e sua meta principal já estão salvos. Gráficos e novas pesagens chegam na próxima atualização.',
      }}
      upcoming={['Pesagens e tendência de 7 dias', 'Medidas corporais e composição', 'Metas secundárias', 'Gráficos de volume e força']}
    />
  );
}
