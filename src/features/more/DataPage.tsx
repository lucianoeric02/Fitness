import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download, Trash2, Upload } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { useToast } from '@/components/ui/Toast';
import {
  BackupError,
  backupFileName,
  backupStats,
  exportBackup,
  parseBackup,
  restoreBackup,
  wipeAllData,
  type BackupFile,
} from '@/data/backup';
import { db, TABLE_NAMES } from '@/data/db';
import { saveTextFile } from '@/services/fileExport';
import { formatNumber } from '@/lib/numbers';

export function DataPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);

  const totalRecords = useLiveQuery(async () => {
    const counts = await Promise.all(TABLE_NAMES.map((t) => db.table(t).count()));
    return counts.reduce((a, b) => a + b, 0);
  }, []);

  const onExport = async () => {
    setExporting(true);
    try {
      const backup = await exportBackup();
      const result = await saveTextFile(backupFileName(), JSON.stringify(backup));
      if (result === 'cancelled') toast.info('Exportação cancelada.');
      else toast.success(`Backup gerado com ${formatNumber(backupStats(backup).totalRecords)} registros.`);
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível gerar o backup.');
    } finally {
      setExporting(false);
    }
  };

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPending(parseBackup(await file.text()));
    } catch (e) {
      toast.error(e instanceof BackupError ? e.message : 'Não foi possível ler o arquivo.');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const pendingStats = pending ? backupStats(pending) : null;

  return (
    <>
      <AppHeader title="Dados e backup" back="/mais" />
      <PageContainer className="gap-4">
        <Card>
          <SectionHeader title="Neste aparelho" />
          <p className="text-body">
            <b className="tabular">{totalRecords === undefined ? '…' : formatNumber(totalRecords)}</b>{' '}
            <span className="text-muted">registros salvos localmente</span>
          </p>
          <p className="mt-2 text-caption text-muted">
            Desinstalar o app ou limpar os dados dele no Android apaga tudo. Exporte um backup com frequência e guarde no Google Drive.
          </p>
        </Card>

        <Card className="flex flex-col gap-3">
          <SectionHeader title="Backup" />
          <Button variant="primary" block loading={exporting} icon={<Download className="size-5" />} onClick={onExport}>
            Exportar backup
          </Button>
          <Button variant="secondary" block icon={<Upload className="size-5" />} onClick={() => fileInput.current?.click()}>
            Importar backup
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => void onPickFile(e.target.files?.[0])}
          />
        </Card>

        <Card className="flex flex-col gap-3 border-danger/20">
          <SectionHeader title="Zona de risco" />
          <Button variant="danger" block icon={<Trash2 className="size-5" />} onClick={() => setConfirmWipe(true)}>
            Apagar todos os dados
          </Button>
        </Card>
      </PageContainer>

      <ConfirmSheet
        open={pending !== null}
        onClose={() => setPending(null)}
        title="Restaurar backup?"
        confirmLabel="Substituir dados"
        description={
          pending && pendingStats ? (
            <>
              <p>
                O backup de{' '}
                <b className="text-ink">{new Date(pending.exportedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</b>{' '}
                contém <b className="text-ink">{formatNumber(pendingStats.totalRecords)} registros</b>.
              </p>
              <p className="mt-2">Todos os dados atuais deste aparelho serão substituídos. Isso não pode ser desfeito.</p>
            </>
          ) : null
        }
        onConfirm={async () => {
          if (!pending) return;
          try {
            const stats = await restoreBackup(pending);
            setPending(null);
            toast.success(`Backup restaurado: ${formatNumber(stats.totalRecords)} registros.`);
            navigate('/', { replace: true });
          } catch (e) {
            console.error(e);
            toast.error('Falha ao restaurar. Seus dados atuais foram mantidos.');
          }
        }}
      />

      <ConfirmSheet
        open={confirmWipe}
        onClose={() => setConfirmWipe(false)}
        title="Apagar todos os dados?"
        confirmLabel="Apagar tudo"
        description={
          <>
            <p>Perfil, metas, pesagens, treinos e refeições serão removidos deste aparelho.</p>
            <p className="mt-2 text-ink">Se ainda não exportou um backup, cancele e faça isso primeiro.</p>
          </>
        }
        onConfirm={async () => {
          try {
            await wipeAllData();
            setConfirmWipe(false);
            toast.success('Dados apagados.');
            navigate('/boas-vindas', { replace: true });
          } catch (e) {
            console.error(e);
            toast.error('Não foi possível apagar os dados.');
          }
        }}
      />
    </>
  );
}
