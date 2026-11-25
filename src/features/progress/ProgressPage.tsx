import { TrendingUp } from 'lucide-react';
import { ModuleComingSoon } from '@/features/ModuleComingSoon';

export function ProgressPage() {
  return (
    <ModuleComingSoon
      title="Progresso"
      icon={<TrendingUp className="size-6" />}
      headline="Análises em construção"
      description="Seu peso inicial e sua meta principal já estão salvos."
      features={[
        'Pesagens e tendência de 7 dias',
        'Medidas corporais e composição',
        'Metas secundárias',
        'Gráficos de volume e força',
      ]}
    />
  );
}
