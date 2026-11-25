import { UtensilsCrossed } from 'lucide-react';
import { ModuleShell } from '@/features/ModuleShell';

export function NutritionPage() {
  return (
    <ModuleShell
      title="Nutrição"
      description="Refeições do dia, calorias e macros em relação às suas metas."
      empty={{
        icon: <UtensilsCrossed className="size-6" />,
        title: 'Nenhuma refeição registrada',
        description: 'Suas metas diárias já estão ativas no Início. O registro de refeições chega na próxima atualização.',
      }}
      upcoming={['Catálogo próprio de alimentos', 'Refeições salvas para registrar em 1 toque', 'Calorias e macros por refeição', 'Histórico diário']}
    />
  );
}
