import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Lock, Plus, Trash2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button, LinkButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { ChipGroup, DateInput, Input } from '@/components/ui/Field';
import { RangePicker } from '@/components/charts/BarChart';
import { EmptyState, LoadingScreen } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { addPhoto, deletePhoto, listPhotoMeta, photoCategoryKey, photoCategoryLabel, updatePhoto } from '@/data/repos/photos';
import { dailyWeights } from '@/domain/calc/weight';
import { validateRecordDate } from '@/domain/validation';
import type { PhotoCategory, ProgressPhoto } from '@/domain/models';
import { useToday } from '@/hooks/useToday';
import { daysBetween, formatShortDay } from '@/lib/dates';
import { resizeImage } from '@/lib/images';
import { formatNumber, formatSigned } from '@/lib/numbers';

type PhotoMeta = Omit<ProgressPhoto, 'data'>;

/** Object URL for a stored photo, revoked on unmount. Bytes never leave the device. */
function usePhotoUrl(id: string | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    let revoked = false;
    let created: string | null = null;
    void db.progressPhotos.get(id).then((p) => {
      if (!p || revoked) return;
      created = URL.createObjectURL(new Blob([p.data], { type: p.mime }));
      setUrl(created);
    });
    return () => {
      revoked = true;
      if (created) URL.revokeObjectURL(created);
      setUrl(null);
    };
  }, [id]);
  return url;
}

function Thumb({ photo, onClick, className }: { photo: PhotoMeta; onClick?: () => void; className?: string }) {
  const url = usePhotoUrl(photo.id);
  return (
    <button type="button" onClick={onClick} className={`relative overflow-hidden rounded-control bg-elevated ${className ?? ''}`} aria-label={`${photoCategoryLabel(photo)} · ${formatShortDay(photo.day)}`}>
      {url && <img src={url} alt="" className="aspect-3/4 w-full object-cover" />}
      {!url && <span className="block aspect-3/4 w-full" />}
      <span className="absolute inset-x-0 bottom-0 bg-bg/70 px-2 py-1 text-left text-xs">
        {photoCategoryLabel(photo)} · {formatShortDay(photo.day)}
      </span>
    </button>
  );
}

const PrivacyNote = () => (
  <p className="flex items-start gap-2 text-caption text-faint">
    <Lock className="mt-0.5 size-4 shrink-0" /> As fotos ficam só neste aparelho: não são enviadas para nenhum serviço e não entram no backup JSON.
  </p>
);

export function PhotosPage() {
  const photos = useLiveQuery(() => listPhotoMeta(), []);
  const [filter, setFilter] = useState('all');
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<PhotoMeta | null>(null);
  if (photos === undefined) return <LoadingScreen />;

  const categories = [...new Map(photos.map((p) => [photoCategoryKey(p), photoCategoryLabel(p)])).entries()];
  const shown = filter === 'all' ? photos : photos.filter((p) => photoCategoryKey(p) === filter);

  return (
    <>
      <AppHeader
        title="Fotos de progresso"
        back="/progresso"
        action={
          <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
            Foto
          </Button>
        }
      />
      <PageContainer className="gap-4">
        <PrivacyNote />
        {photos.length === 0 ? (
          <Card>
            <EmptyState icon={<Camera className="size-6" />} title="Nenhuma foto" description="Tire fotos de frente, lado e costas com a mesma luz e posição para comparar ao longo do tempo." action={<Button onClick={() => setAdding(true)}>Adicionar foto</Button>} />
          </Card>
        ) : (
          <>
            <RangePicker label="Categoria" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Todas' }, ...categories.map(([k, l]) => ({ value: k, label: l }))]} />
            <div className="grid grid-cols-2 gap-2 xs:grid-cols-3">
              {shown.map((p) => (
                <Thumb key={p.id} photo={p} onClick={() => setViewing(p)} />
              ))}
            </div>
            {photos.length >= 2 && (
              <LinkButton to="/progresso/fotos/comparar" variant="secondary" block>
                Comparar duas datas
              </LinkButton>
            )}
          </>
        )}
      </PageContainer>
      <AddPhotoSheet open={adding} onClose={() => setAdding(false)} />
      <PhotoViewer photo={viewing} onClose={() => setViewing(null)} />
    </>
  );
}

function AddPhotoSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const today = useToday();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [category, setCategory] = useState<PhotoCategory>('front');
  const [custom, setCustom] = useState('');
  const [day, setDay] = useState(today);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setCategory('front');
    setCustom('');
    setDay(today);
    setNote('');
  }, [open, today]);
  useEffect(() => {
    if (!file) return setPreview(null);
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const dayError = validateRecordDate(day, today);
  const save = async () => {
    if (!file) {
      toast.error('Escolha uma foto.');
      return;
    }
    if (dayError || (category === 'custom' && !custom.trim())) {
      toast.error(dayError ?? 'Informe o nome da categoria.');
      return;
    }
    setBusy(true);
    try {
      const img = await resizeImage(file);
      await addPhoto({ day, category, customCategory: custom, note, ...img });
      toast.success('Foto salva no aparelho.');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível salvar a foto.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={() => !busy && onClose()}
      title="Nova foto"
      footer={
        <Button block size="lg" loading={busy} disabled={!file} onClick={save}>
          Salvar foto
        </Button>
      }
    >
      <div className="flex flex-col gap-4 pt-1">
        {preview ? (
          <button type="button" onClick={() => fileRef.current?.click()} className="overflow-hidden rounded-control">
            <img src={preview} alt="Pré-visualização" className="max-h-64 w-full object-contain" />
          </button>
        ) : (
          <Button variant="secondary" size="lg" icon={<Camera className="size-5" />} onClick={() => fileRef.current?.click()}>
            Tirar ou escolher foto
          </Button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <ChipGroup
          label="Categoria"
          value={category}
          onChange={setCategory}
          options={[
            { value: 'front', label: 'Frente' },
            { value: 'side', label: 'Lado' },
            { value: 'back', label: 'Costas' },
            { value: 'custom', label: 'Outra' },
          ]}
        />
        {category === 'custom' && <Input label="Nome da categoria" value={custom} onChange={setCustom} maxLength={24} placeholder="Ex.: Braço contraído" />}
        <DateInput label="Data" value={day} onChange={setDay} max={today} error={dayError} />
        <Input label="Observação (opcional)" value={note} onChange={setNote} maxLength={80} />
        <PrivacyNote />
      </div>
    </BottomSheet>
  );
}

function PhotoViewer({ photo, onClose }: { photo: PhotoMeta | null; onClose: () => void }) {
  const toast = useToast();
  const url = usePhotoUrl(photo?.id);
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false);
  useEffect(() => setNote(photo?.note ?? ''), [photo]);
  if (!photo) return null;
  return (
    <>
      <BottomSheet
        open
        onClose={onClose}
        title={`${photoCategoryLabel(photo)} · ${formatShortDay(photo.day)}`}
        footer={
          <div className="grid grid-cols-2 gap-3">
            <Button variant="danger" icon={<Trash2 className="size-5" />} onClick={() => setConfirm(true)}>
              Excluir
            </Button>
            <Button
              disabled={note === (photo.note ?? '')}
              onClick={async () => {
                await updatePhoto(photo.id, { note });
                toast.success('Observação salva.');
              }}
            >
              Salvar
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4 pt-1">
          {url ? <img src={url} alt={photoCategoryLabel(photo)} className="max-h-sheet w-full rounded-control object-contain" /> : <div className="aspect-3/4 w-full rounded-control bg-elevated" />}
          <Input label="Observação" value={note} onChange={setNote} maxLength={80} />
        </div>
      </BottomSheet>
      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Excluir foto?"
        description="A foto será apagada deste aparelho. Isso não pode ser desfeito."
        confirmLabel="Excluir foto"
        onConfirm={async () => {
          await deletePhoto(photo.id);
          setConfirm(false);
          onClose();
          toast.success('Foto excluída.');
        }}
      />
    </>
  );
}

export function ComparePhotosPage() {
  const photos = useLiveQuery(() => listPhotoMeta(), []);
  const weights = useLiveQuery(async () => dailyWeights(await db.bodyWeights.toArray()), []);
  const [category, setCategory] = useState<string | null>(null);
  const [a, setA] = useState<string | null>(null);
  const [b, setB] = useState<string | null>(null);

  const categories = useMemo(() => [...new Map((photos ?? []).map((p) => [photoCategoryKey(p), photoCategoryLabel(p)])).entries()], [photos]);
  if (photos === undefined || weights === undefined) return <LoadingScreen />;
  const cat = category ?? categories.find(([k]) => photos.filter((p) => photoCategoryKey(p) === k).length >= 2)?.[0] ?? categories[0]?.[0] ?? null;
  const list = photos.filter((p) => photoCategoryKey(p) === cat).sort((x, y) => (x.day < y.day ? -1 : 1));
  const first = list.find((p) => p.id === a) ?? list[0];
  const second = list.find((p) => p.id === b) ?? list[list.length - 1];
  const weightOn = (day: string) => [...weights].reverse().find((w) => w.day <= day);

  return (
    <>
      <AppHeader title="Comparar fotos" back="/progresso/fotos" />
      <PageContainer className="gap-4">
        {photos.length < 2 ? (
          <Card>
            <EmptyState icon={<Camera className="size-6" />} title="Poucas fotos" description="Adicione pelo menos duas fotos da mesma categoria em datas diferentes para comparar." action={<LinkButton to="/progresso/fotos">Ir para fotos</LinkButton>} />
          </Card>
        ) : (
          <>
            <RangePicker
              label="Categoria"
              value={cat ?? ''}
              onChange={(v) => {
                setCategory(v);
                setA(null);
                setB(null);
              }}
              options={categories.map(([k, l]) => ({ value: k, label: l }))}
            />
            {list.length < 2 ? (
              <p className="text-body text-muted">Esta categoria tem só uma foto. Adicione outra em uma data diferente.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {[first!, second!].map((p, i) => {
                    const w = weightOn(p.day);
                    return (
                      <div key={`${p.id}-${i}`} className="flex flex-col gap-1">
                        <Thumb photo={p} />
                        <p className="text-center text-caption text-muted">
                          {formatShortDay(p.day)}
                          {w && ` · ${formatNumber(w.weightKg, 1)} kg`}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <p className="text-center text-caption text-muted">
                  Intervalo de {daysBetween(first!.day, second!.day)} dias
                  {weightOn(first!.day) && weightOn(second!.day) && <> · peso {formatSigned(weightOn(second!.day)!.weightKg - weightOn(first!.day)!.weightKg)} kg</>}
                </p>
                <RangePicker label="Foto da esquerda" value={first!.id} onChange={setA} options={list.map((p) => ({ value: p.id, label: `Antes: ${formatShortDay(p.day)}` }))} />
                <RangePicker label="Foto da direita" value={second!.id} onChange={setB} options={list.map((p) => ({ value: p.id, label: `Depois: ${formatShortDay(p.day)}` }))} />
              </>
            )}
          </>
        )}
      </PageContainer>
    </>
  );
}
