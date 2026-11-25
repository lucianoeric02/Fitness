import { UtensilsCrossed } from 'lucide-react';
import { ModuleComingSoon } from '@/features/ModuleComingSoon';

export function NutritionPage() {
  return (
    <ModuleComingSoon
      title="Nutrição"
      icon={<UtensilsCrossed className="size-6" />}
      headline="Registro alimentar em construção"
      description="Suas metas diárias já estão ativas e aparecem no Início."
      features={[
        'Catálogo próprio de alimentos',
        'Refeições salvas para registrar em 1 toque',
        'Calorias e macros por refeição',
        'Histórico diário',
      ]}
    />
  );
}
