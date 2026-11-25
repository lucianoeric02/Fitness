import { Card } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Field';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { LoadingScreen } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { updateSettings } from '@/data/repos/profile';
import { useSettings } from '@/hooks/data';

const DAY_START_OPTIONS = [
  { value: '0', label: '00h' },
  { value: '2', label: '02h' },
  { value: '3', label: '03h' },
  { value: '4', label: '04h' },
] as const;

export function SettingsPage() {
  const settings = useSettings();
  const toast = useToast();
  if (!settings) return <LoadingScreen />;

  const apply = async (patch: Parameters<typeof updateSettings>[0]) => {
    try {
      await updateSettings(patch);
      toast.success('Configuração salva.');
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível salvar.');
    }
  };

  return (
    <>
      <AppHeader title="Configurações" back="/mais" />
      <PageContainer className="gap-4">
        <Card className="flex flex-col gap-2">
          <Segmented
            label="A semana começa"
            value={String(settings.weekStartsOn) as '0' | '1'}
            onChange={(v) => apply({ weekStartsOn: v === '0' ? 0 : 1 })}
            options={[
              { value: '1', label: 'Segunda' },
              { value: '0', label: 'Domingo' },
            ]}
          />
          <p className="text-caption text-faint">Usado nos resumos semanais e no planejamento.</p>
        </Card>
        <Card className="flex flex-col gap-2">
          <Segmented
            label="O dia vira às"
            value={String(settings.dayStartHour) as (typeof DAY_START_OPTIONS)[number]['value']}
            onChange={(v) => apply({ dayStartHour: Number(v) })}
            options={DAY_START_OPTIONS}
          />
          <p className="text-caption text-faint">
            Se você treina ou come tarde, registros feitos antes desse horário contam para o dia anterior.
          </p>
        </Card>
        <Card className="text-sm text-muted">
          Unidades: quilogramas, centímetros e mililitros. Idioma: português (Brasil).
        </Card>
      </PageContainer>
    </>
  );
}
