import { Plus, Ruler } from 'lucide-react';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { LinkButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ListGroup, ListRow } from '@/components/ui/List';
import { EmptyState, LoadingScreen } from '@/components/ui/States';
import { MEASUREMENT_REGIONS, measurementKey, measurementLabel } from '@/domain/catalog';
import type { MeasurementEntry } from '@/domain/models';
import { useMeasurementHistory } from '@/hooks/data';
import { useToday } from '@/hooks/useToday';
import { formatRelativeDay } from '@/lib/dates';
import { formatNumber, formatSigned } from '@/lib/numbers';

/** Series of entries per measurement key, oldest → newest. */
export function groupMeasurements(entries: ReadonlyArray<MeasurementEntry>) {
  const map = new Map<string, MeasurementEntry[]>();
  for (const e of entries) {
    const key = measurementKey(e.site, e.customName);
    map.set(key, [...(map.get(key) ?? []), e]);
  }
  for (const list of map.values()) list.sort((a, b) => (a.day === b.day ? (a.measuredAt < b.measuredAt ? -1 : 1) : a.day < b.day ? -1 : 1));
  return map;
}

export function MeasurementsPage() {
  const today = useToday();
  const entries = useMeasurementHistory();
  if (entries === undefined) return <LoadingScreen />;
  const groups = groupMeasurements(entries);
  const predefined = MEASUREMENT_REGIONS.flatMap((r) => r.sites.map((s) => measurementKey(s.site))).filter((k) => groups.has(k));
  const custom = [...groups.keys()].filter((k) => k.startsWith('custom:'));

  const row = (key: string) => {
    const list = groups.get(key)!;
    const last = list[list.length - 1]!;
    const prev = list[list.length - 2];
    return (
      <ListRow
        key={key}
        title={measurementLabel(last.site, last.customName)}
        subtitle={`${formatRelativeDay(last.day, today)}${prev ? ` · ${formatSigned(last.valueCm - prev.valueCm)} cm` : ''}`}
        to={`/mais/perfil/medidas/${encodeURIComponent(key)}`}
        trailing={<span className="tabular text-body font-semibold">{formatNumber(last.valueCm, 1)} cm</span>}
      />
    );
  };

  return (
    <>
      <AppHeader
        title="Medidas corporais"
        back="/mais/perfil"
        action={
          <LinkButton to="/mais/perfil/medidas/nova" size="sm" icon={<Plus className="size-4" />}>
            Registrar
          </LinkButton>
        }
      />
      <PageContainer className="gap-5">
        {groups.size === 0 ? (
          <Card>
            <EmptyState
              icon={<Ruler className="size-6" />}
              title="Nenhuma medida registrada"
              description="Registre cintura, braços, coxas e outras medidas. Membros são medidos dos dois lados."
              action={<LinkButton to="/mais/perfil/medidas/nova">Registrar medidas</LinkButton>}
            />
          </Card>
        ) : (
          <>
            {predefined.length > 0 && <ListGroup title="Medidas">{predefined.map(row)}</ListGroup>}
            {custom.length > 0 && <ListGroup title="Personalizadas">{custom.map(row)}</ListGroup>}
          </>
        )}
      </PageContainer>
    </>
  );
}
