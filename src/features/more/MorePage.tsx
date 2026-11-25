import { CalendarDays, Database, Droplets, Settings, Target, UserRound } from 'lucide-react';
import { ListGroup, ListRow, PageBody, PageHeader } from '@/components/ui/Page';
import { useProfile, useTargetForDay } from '@/hooks/data';
import { useToday } from '@/hooks/useToday';
import { formatNumber } from '@/lib/numbers';

export function MorePage() {
  const today = useToday();
  const profile = useProfile();
  const target = useTargetForDay(today);

  return (
    <>
      <PageHeader title="Mais" />
      <PageBody className="gap-5">
        <ListGroup title="Você">
          <ListRow icon={<UserRound className="size-5" />} title="Perfil" subtitle={profile?.name ?? 'Nome, altura e meta de peso'} to="/mais/perfil" />
          <ListRow
            icon={<Target className="size-5" />}
            title="Metas diárias"
            subtitle={target ? `${formatNumber(target.kcal)} kcal · ${formatNumber(target.proteinG)} g proteína` : 'Calorias, macros e água'}
            to="/mais/metas"
          />
        </ListGroup>

        <ListGroup title="Em breve">
          <ListRow icon={<Droplets className="size-5" />} title="Hidratação" subtitle="Registro rápido de água" disabled />
          <ListRow icon={<CalendarDays className="size-5" />} title="Planejamento" subtitle="Semana de treinos e lembretes" disabled />
        </ListGroup>

        <ListGroup title="App">
          <ListRow icon={<Settings className="size-5" />} title="Configurações" subtitle="Semana e virada do dia" to="/mais/configuracoes" />
          <ListRow icon={<Database className="size-5" />} title="Dados e backup" subtitle="Exportar, importar e apagar" to="/mais/dados" />
        </ListGroup>

        <p className="pt-2 text-center text-[12px] text-faint">Iron Track {__APP_VERSION__} · dados armazenados apenas neste aparelho</p>
      </PageBody>
    </>
  );
}
