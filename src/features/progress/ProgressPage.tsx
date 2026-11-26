import { useSearchParams } from 'react-router';
import { RangePicker } from '@/components/charts/BarChart';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { BodyTab } from './BodyTab';
import { NutritionTab } from './NutritionTab';
import { TrainingTab } from './TrainingTab';
import { WeekReport } from './WeekReport';

const TABS = [
  { value: 'corpo', label: 'Corpo' },
  { value: 'treino', label: 'Treino' },
  { value: 'nutricao', label: 'Nutrição' },
  { value: 'semana', label: 'Semana' },
] as const;
type Tab = (typeof TABS)[number]['value'];

export function ProgressPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('aba');
  const tab: Tab = TABS.some((t) => t.value === raw) ? (raw as Tab) : 'corpo';
  return (
    <>
      <AppHeader title="Progresso" description="Evolução física, treino e nutrição com base nos seus registros." />
      <PageContainer className="gap-4">
        <RangePicker label="Seção" value={tab} onChange={(v) => setParams(v === 'corpo' ? {} : { aba: v }, { replace: true })} options={TABS} />
        {tab === 'corpo' && <BodyTab />}
        {tab === 'treino' && <TrainingTab />}
        {tab === 'nutricao' && <NutritionTab />}
        {tab === 'semana' && <WeekReport />}
      </PageContainer>
    </>
  );
}
