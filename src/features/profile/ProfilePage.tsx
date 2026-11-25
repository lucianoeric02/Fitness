import { Activity, ChevronRight, Flag, Pencil, Ruler, Scale } from 'lucide-react';
import { Link } from 'react-router';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card } from '@/components/ui/Card';
import { ListGroup, ListRow } from '@/components/ui/List';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { LoadingScreen } from '@/components/ui/States';
import { ACTIVITY_LABELS, EXPERIENCE_LABELS } from '@/domain/catalog';
import { useCompositionHistory, useGoalViews, useProfile, useWeightHistory } from '@/hooks/data';
import { useToday } from '@/hooks/useToday';
import { ageOn, formatShortDay } from '@/lib/dates';
import { formatNumber } from '@/lib/numbers';

export function ProfilePage() {
  const today = useToday();
  const profile = useProfile();
  const weights = useWeightHistory();
  const composition = useCompositionHistory();
  const goals = useGoalViews(today);
  if (profile === undefined || weights === undefined || composition === undefined || goals === undefined) return <LoadingScreen />;

  const active = goals.filter((g) => g.goal.status === 'active');
  const weightGoal = active.find((g) => g.goal.kind === 'body_weight')?.goal;
  const fatGoal = active.find((g) => g.goal.kind === 'body_fat')?.goal;
  const current = weights[0];
  // Initial weight: the weight goal's starting point; otherwise the first weigh-in.
  const initialWeight = weightGoal?.startValue ?? weights[weights.length - 1]?.weightKg;
  const latestFat = composition.find((c) => c.bodyFatPct !== undefined);
  const latestMuscle = composition.find((c) => c.muscleMassKg !== undefined);
  const facts = [
    profile?.birthDate ? `${ageOn(profile.birthDate, today)} anos` : null,
    profile?.heightCm ? `${formatNumber(profile.heightCm)} cm` : null,
    profile?.sex === 'male' ? 'Masculino' : profile?.sex === 'female' ? 'Feminino' : null,
  ].filter(Boolean);

  return (
    <>
      <AppHeader
        title="Perfil"
        back="/mais"
        action={
          <Link to="/mais/perfil/editar" aria-label="Editar perfil" className="pressable flex size-touch items-center justify-center rounded-full text-muted active:bg-elevated">
            <Pencil className="size-5" />
          </Link>
        }
      />
      <PageContainer className="gap-4">
        <Card>
          <p className="text-xl font-semibold tracking-tight">{profile?.name}</p>
          <p className="mt-0.5 text-caption text-muted">{facts.length ? facts.join(' · ') : 'Complete idade e altura em Editar perfil.'}</p>
          <dl className="mt-3 grid gap-2 border-t border-line/60 pt-3 text-caption">
            <Row label="Experiência" value={profile?.trainingExperience ? EXPERIENCE_LABELS[profile.trainingExperience] : null} />
            <Row label="Atividade" value={profile?.activityLevel ? ACTIVITY_LABELS[profile.activityLevel] : null} />
          </dl>
        </Card>

        <Card>
          <SectionHeader title="Corpo" />
          <div className="grid grid-cols-2 gap-x-3 gap-y-4 xs:grid-cols-3">
            <Fact label="Peso atual" value={current ? `${formatNumber(current.weightKg, 1)} kg` : null} note={current ? formatShortDay(current.day) : undefined} />
            <Fact label="Peso inicial" value={initialWeight !== undefined ? `${formatNumber(initialWeight, 1)} kg` : null} />
            <Fact label="Peso-meta" value={weightGoal ? `${formatNumber(weightGoal.targetValue, 1)} kg` : null} />
            <Fact label="Gordura" value={latestFat ? `${formatNumber(latestFat.bodyFatPct!, 1)}%` : null} note={latestFat ? formatShortDay(latestFat.day) : undefined} />
            <Fact label="Gordura-meta" value={fatGoal ? `${formatNumber(fatGoal.targetValue, 1)}%` : null} />
            <Fact label="Massa muscular" value={latestMuscle ? `${formatNumber(latestMuscle.muscleMassKg!, 1)} kg` : null} />
          </div>
        </Card>

        <ListGroup title="Registros">
          <ListRow icon={<Scale className="size-5" />} title="Pesagens" subtitle={`${weights.length} registro${weights.length === 1 ? '' : 's'}`} to="/mais/perfil/peso" />
          <ListRow icon={<Ruler className="size-5" />} title="Medidas corporais" subtitle="Cintura, braço, coxa e mais" to="/mais/perfil/medidas" />
          <ListRow icon={<Activity className="size-5" />} title="Composição corporal" subtitle="% de gordura e massa muscular" to="/mais/perfil/composicao" />
          <ListRow icon={<Flag className="size-5" />} title="Objetivos" subtitle={`${active.length} ativo${active.length === 1 ? '' : 's'}`} to="/mais/objetivos" />
        </ListGroup>

        {profile?.notes && (
          <Card>
            <SectionHeader title="Notas" />
            <p className="whitespace-pre-line text-body text-muted">{profile.notes}</p>
          </Card>
        )}

        <Link to="/mais/perfil/editar" className="flex min-h-touch items-center justify-center gap-1 text-caption font-medium text-muted">
          Editar perfil <ChevronRight className="size-4" />
        </Link>
      </PageContainer>
    </>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className={value ? 'text-right text-ink' : 'text-faint'}>{value ?? 'Não informado'}</dd>
    </div>
  );
}

function Fact({ label, value, note }: { label: string; value: string | null; note?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-caption text-muted">{label}</p>
      {value ? <p className="tabular truncate text-lg font-semibold">{value}</p> : <p className="text-caption text-faint">Não registrado</p>}
      {note && <p className="text-xs text-faint">{note}</p>}
    </div>
  );
}
