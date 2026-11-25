import type { ReactNode } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState } from '@/components/ui/States';

/**
 * Shell for a module whose screens are not built yet: real title and
 * description, an honest empty state, and what the module will offer.
 * No placeholder metrics.
 */
export function ModuleShell({
  title,
  description,
  back,
  empty,
  upcoming,
}: {
  title: string;
  description: string;
  back?: string;
  empty: { icon: ReactNode; title: string; description: string };
  upcoming: string[];
}) {
  return (
    <>
      <AppHeader title={title} description={description} back={back} />
      <PageContainer>
        <Card>
          <EmptyState icon={empty.icon} title={empty.title} description={empty.description} className="py-8" />
        </Card>
        <Card>
          <SectionHeader title="Chega neste módulo" />
          <ul className="flex flex-col gap-3">
            {upcoming.map((f) => (
              <li key={f} className="flex items-center gap-3 text-body text-muted">
                <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
        </Card>
      </PageContainer>
    </>
  );
}
