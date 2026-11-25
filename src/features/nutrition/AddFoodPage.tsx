import { useState } from 'react';
import { Check } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/Button';
import { LoadingScreen } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { addFoodEntry, deleteFoodEntry } from '@/data/repos/foodLog';
import type { Food } from '@/domain/models';
import { useMeals } from '@/hooks/nutrition';
import { useToday } from '@/hooks/useToday';
import { formatRelativeDay, isDayKey } from '@/lib/dates';
import { formatNumber } from '@/lib/numbers';
import { FoodQuantitySheet } from './FoodQuantitySheet';
import { FoodSearch } from './FoodSearch';

/** Search → pick → quantity → add. Stays on the page so several foods can be logged in a row. */
export function AddFoodPage() {
  const today = useToday();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const meals = useMeals();
  const day = params.get('dia') && isDayKey(params.get('dia')) && params.get('dia')! <= today ? params.get('dia')! : today;
  const [slot, setSlot] = useState(params.get('refeicao') ?? undefined);
  const [picked, setPicked] = useState<Food | null>(null);
  const [added, setAdded] = useState(0);
  if (meals === undefined) return <LoadingScreen />;
  const back = `/nutricao${day === today ? '' : `?dia=${day}`}`;

  return (
    <>
      <AppHeader
        title="Adicionar alimento"
        eyebrow={formatRelativeDay(day, today)}
        back={back}
        action={
          added > 0 && (
            <Button size="sm" icon={<Check className="size-4" />} onClick={() => navigate(back)}>
              Concluir
            </Button>
          )
        }
      />
      <PageContainer>
        <FoodSearch onPick={setPicked} />
      </PageContainer>
      <FoodQuantitySheet
        food={picked}
        meals={meals}
        defaultSlot={slot}
        onClose={() => setPicked(null)}
        onConfirm={async (r) => {
          if (!picked) return;
          try {
            const entry = await addFoodEntry({ day, slot: r.slot, food: picked, quantity: r.quantity, servingLabel: r.servingLabel, note: r.note });
            setSlot(r.slot);
            setAdded((n) => n + 1);
            setPicked(null);
            const meal = meals.find((m) => m.id === r.slot)?.name ?? '';
            toast.success(`${picked.name}: ${formatNumber(entry.nutrients.kcal)} kcal em ${meal}.`, { label: 'Desfazer', onClick: () => void deleteFoodEntry(entry.id).then(() => setAdded((n) => Math.max(0, n - 1))) });
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Não foi possível adicionar.');
          }
        }}
      />
    </>
  );
}
