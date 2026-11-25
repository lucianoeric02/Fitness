import { ArrowDown, ArrowUp, BookOpen, Dumbbell, History, Play, Plus } from 'lucide-react';
import { Link } from 'react-router';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button, IconButton, LinkButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ListGroup, ListRow } from '@/components/ui/List';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState, LoadingScreen } from '@/components/ui/States';
import { moveTemplate } from '@/data/repos/templates';
import { activeDurationMs } from '@/domain/calc/workout';
import { MUSCLE_LABELS } from '@/domain/exerciseCatalog';
import { useActiveSession, useRoutines, type TemplateSummary } from '@/hooks/workout';
import { useNow } from '@/hooks/useNow';
import { cn } from '@/lib/cn';
import { formatElapsed } from './format';
import { useStartWorkout } from './useStartWorkout';

export function routineDetails(s: TemplateSummary): string {
  const parts = [
    s.muscles.map((m) => MUSCLE_LABELS[m]).join(', '),
    `${s.items.length} exercício${s.items.length === 1 ? '' : 's'}`,
    s.items.length ? `~${s.estimatedMin} min` : '',
  ];
  return parts.filter(Boolean).join(' · ');
}

export function WorkoutPage() {
  const routines = useRoutines();
  const active = useActiveSession();
  const now = useNow(Boolean(active), 1000);
  const { start, starting } = useStartWorkout();
  if (routines === undefined || active === undefined) return <LoadingScreen />;

  const { summaries, next } = routines;
  const activeRoutines = summaries.filter((s) => s.template.active);
  const inactive = summaries.filter((s) => !s.template.active);

  return (
    <>
      <AppHeader title="Treino" description="Rotinas em sequência, treino em andamento e histórico." />
      <PageContainer className="gap-4">
        {active ? (
          <Card tone="accent">
            <SectionHeader title="Em andamento" action={<span className="tabular text-caption font-semibold text-accent">{formatElapsed(activeDurationMs(active, now))}</span>} />
            <p className="text-lg font-semibold">{active.name}</p>
            {active.pausedAt && <p className="text-caption text-warning">Pausado</p>}
            <LinkButton to="/treino/sessao" block size="lg" className="mt-4" icon={<Play className="size-5" />}>
              Retomar treino
            </LinkButton>
          </Card>
        ) : next ? (
          <Card tone="accent">
            <SectionHeader title="Próximo na sequência" />
            <p className="text-xl font-semibold tracking-tight">{next.template.name}</p>
            <p className="mt-0.5 text-caption text-muted">{routineDetails(next)}</p>
            {next.items.length === 0 ? (
              <LinkButton to={`/treino/rotinas/${next.template.id}`} block variant="secondary" className="mt-4">
                Adicionar exercícios
              </LinkButton>
            ) : (
              <Button block size="lg" className="mt-4" loading={starting} icon={<Play className="size-5" />} onClick={() => void start(next.template.id)}>
                Iniciar treino
              </Button>
            )}
          </Card>
        ) : (
          <Card>
            <EmptyState
              icon={<Dumbbell className="size-6" />}
              title="Nenhuma rotina criada"
              description="Crie suas rotinas (ex.: A, B, C ou Push, Pull, Legs). Elas seguem em sequência: depois da última, volta para a primeira."
              action={<LinkButton to="/treino/rotinas/nova" icon={<Plus className="size-5" />}>Criar rotina</LinkButton>}
            />
          </Card>
        )}

        {summaries.length > 0 && (
          <section>
            <SectionHeader title="Sequência de rotinas" className="px-1" action={<LinkButton to="/treino/rotinas/nova" size="sm" variant="secondary" icon={<Plus className="size-4" />}>Nova</LinkButton>} />
            <div className="flex flex-col gap-2">
              {activeRoutines.map((s, i) => (
                <RoutineRow key={s.template.id} s={s} index={i} count={activeRoutines.length} isNext={next?.template.id === s.template.id && !active} />
              ))}
            </div>
            {inactive.length > 0 && (
              <>
                <p className="mb-2 mt-4 px-1 text-caption font-semibold uppercase tracking-label text-faint">Inativas (fora da sequência)</p>
                <div className="flex flex-col gap-2">
                  {inactive.map((s) => (
                    <RoutineRow key={s.template.id} s={s} />
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        <ListGroup>
          <ListRow icon={<History className="size-5" />} title="Histórico de treinos" subtitle="Sessões concluídas" to="/treino/historico" />
          <ListRow icon={<BookOpen className="size-5" />} title="Biblioteca de exercícios" subtitle="Catálogo e exercícios personalizados" to="/treino/exercicios" />
        </ListGroup>
        {!active && summaries.length > 0 && (
          <button type="button" onClick={() => void start()} className="flex min-h-touch items-center justify-center text-caption font-medium text-muted">
            Iniciar treino livre (sem rotina)
          </button>
        )}
      </PageContainer>
    </>
  );
}

function RoutineRow({ s, index, count, isNext }: { s: TemplateSummary; index?: number; count?: number; isNext?: boolean }) {
  return (
    <Card className={cn('flex items-center gap-2 py-2 pl-4 pr-1', isNext && 'border-accent/40')}>
      <Link to={`/treino/rotinas/${s.template.id}`} className="flex min-h-14 min-w-0 flex-1 items-center gap-3">
        {index !== undefined && (
          <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold', isNext ? 'bg-accent text-accent-ink' : 'bg-elevated text-muted')}>{index + 1}</span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-body font-semibold">{s.template.name}</span>
          <span className="block truncate text-caption text-muted">{routineDetails(s)}</span>
        </span>
      </Link>
      {index !== undefined && count !== undefined && count > 1 && (
        <div className="flex shrink-0 flex-col">
          <IconButton label={`Mover ${s.template.name} para cima`} disabled={index === 0} onClick={() => void moveTemplate(s.template.id, -1)}>
            <ArrowUp className="size-4" />
          </IconButton>
          <IconButton label={`Mover ${s.template.name} para baixo`} disabled={index === count - 1} onClick={() => void moveTemplate(s.template.id, 1)}>
            <ArrowDown className="size-4" />
          </IconButton>
        </div>
      )}
    </Card>
  );
}
