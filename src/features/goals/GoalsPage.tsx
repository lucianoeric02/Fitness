import { Flag, Plus } from 'lucide-react';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { LinkButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState, LoadingScreen } from '@/components/ui/States';
import { useGoalViews, type GoalView } from '@/hooks/data';
import { useToday } from '@/hooks/useToday';
import { GoalRow } from './GoalProgress';

export function GoalsPage() {
  const today = useToday();
  const views = useGoalViews(today);
  if (views === undefined) return <LoadingScreen />;

  const byStatus = (s: GoalView['goal']['status']) => views.filter((v) => v.goal.status === s);
  const active = byStatus('active');
  const primary = active.find((v) => v.goal.isPrimary);
  const secondary = active.filter((v) => !v.goal.isPrimary);
  const paused = byStatus('paused');
  const completed = byStatus('completed');

  const list = (title: string, items: GoalView[]) =>
    items.length > 0 && (
      <Card>
        <SectionHeader title={title} />
        <div className="flex flex-col gap-5">
          {items.map((v) => (
            <GoalRow key={v.goal.id} view={v} to={`/mais/objetivos/${v.goal.id}`} />
          ))}
        </div>
      </Card>
    );

  return (
    <>
      <AppHeader
        title="Objetivos"
        back="/mais"
        action={
          <LinkButton to="/mais/objetivos/novo" size="sm" icon={<Plus className="size-4" />}>
            Novo
          </LinkButton>
        }
      />
      <PageContainer>
        {views.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Flag className="size-6" />}
              title="Nenhum objetivo"
              description="Defina seu objetivo principal. Peso corporal é o padrão recomendado."
              action={<LinkButton to="/mais/objetivos/novo">Definir objetivo</LinkButton>}
            />
          </Card>
        ) : (
          <>
            {primary ? (
              <Card tone="accent">
                <SectionHeader title="Objetivo principal" />
                <GoalRow view={primary} to={`/mais/objetivos/${primary.goal.id}`} prominent />
              </Card>
            ) : (
              active.length > 0 && (
                <Card>
                  <p className="text-body text-muted">Nenhum objetivo ativo está marcado como principal. Abra um objetivo e toque em “Tornar principal”.</p>
                </Card>
              )
            )}
            {list('Secundários', secondary)}
            {list('Pausados', paused)}
            {list('Concluídos', completed)}
          </>
        )}
      </PageContainer>
    </>
  );
}
