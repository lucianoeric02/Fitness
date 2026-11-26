import { db } from '@/data/db';
import type { PhotoCategory, ProgressPhoto } from '@/domain/models';
import { nowIso, type DayKey } from '@/lib/dates';
import { newId } from '@/lib/ids';

/**
 * Progress photos live only in this device's IndexedDB. They are never sent
 * over the network and are excluded from JSON backups.
 */
export interface PhotoInput {
  day: DayKey;
  category: PhotoCategory;
  customCategory?: string;
  note?: string;
  mime: string;
  data: ArrayBuffer;
  width: number;
  height: number;
}

export async function addPhoto(input: PhotoInput): Promise<ProgressPhoto> {
  if (input.category === 'custom' && !input.customCategory?.trim()) throw new Error('Informe o nome da categoria.');
  if (!input.data.byteLength) throw new Error('Imagem vazia.');
  const now = nowIso();
  const photo: ProgressPhoto = {
    id: newId(),
    ...input,
    customCategory: input.category === 'custom' ? input.customCategory!.trim() : undefined,
    note: input.note?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
  await db.progressPhotos.add(photo);
  return photo;
}

export async function updatePhoto(id: string, patch: { day?: DayKey; note?: string }): Promise<void> {
  await db.progressPhotos.update(id, { ...patch, ...(patch.note !== undefined ? { note: patch.note.trim() || undefined } : {}), updatedAt: nowIso() });
}

export async function deletePhoto(id: string): Promise<void> {
  await db.progressPhotos.delete(id);
}

/** Metadata only (no image bytes), newest first. */
export async function listPhotoMeta(): Promise<Array<Omit<ProgressPhoto, 'data'>>> {
  const all = await db.progressPhotos.orderBy('day').reverse().toArray();
  return all.map(({ data: _data, ...meta }) => meta);
}

export function photoCategoryKey(p: Pick<ProgressPhoto, 'category' | 'customCategory'>): string {
  return p.category === 'custom' ? `custom:${(p.customCategory ?? '').toLowerCase()}` : p.category;
}

export const PHOTO_CATEGORY_LABELS: Record<Exclude<PhotoCategory, 'custom'>, string> = { front: 'Frente', side: 'Lado', back: 'Costas' };

export function photoCategoryLabel(p: Pick<ProgressPhoto, 'category' | 'customCategory'>): string {
  return p.category === 'custom' ? p.customCategory ?? 'Outra' : PHOTO_CATEGORY_LABELS[p.category];
}
