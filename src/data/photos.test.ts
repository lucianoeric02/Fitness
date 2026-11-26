import { beforeEach, describe, expect, it } from 'vitest';
import { exportBackup, wipeAllData } from './backup';
import { db } from './db';
import { addPhoto, deletePhoto, listPhotoMeta, updatePhoto } from './repos/photos';
import { saveMeasurements, updateMeasurement } from './repos/body';

const bytes = () => new Uint8Array([255, 216, 255, 224, 1, 2, 3]).buffer;

beforeEach(async () => {
  await wipeAllData();
});

describe('progress photos', () => {
  it('stores locally, lists metadata without image bytes, edits and deletes', async () => {
    const p = await addPhoto({ day: '2026-11-20', category: 'front', note: ' manhã ', mime: 'image/jpeg', data: bytes(), width: 3, height: 4 });
    await addPhoto({ day: '2026-11-26', category: 'custom', customCategory: ' Braço ', mime: 'image/jpeg', data: bytes(), width: 3, height: 4 });
    const meta = await listPhotoMeta();
    expect(meta.map((m) => m.day)).toEqual(['2026-11-26', '2026-11-20']);
    expect(meta.every((m) => !('data' in m))).toBe(true);
    expect(meta[0]!.customCategory).toBe('Braço');
    expect((await db.progressPhotos.get(p.id))!.data.byteLength).toBe(7);
    await updatePhoto(p.id, { note: 'luz natural' });
    expect((await db.progressPhotos.get(p.id))?.note).toBe('luz natural');
    await deletePhoto(p.id);
    expect(await db.progressPhotos.count()).toBe(1);
  });

  it('validates input', async () => {
    await expect(addPhoto({ day: '2026-11-20', category: 'custom', mime: 'image/jpeg', data: bytes(), width: 1, height: 1 })).rejects.toThrow(/categoria/);
    await expect(addPhoto({ day: '2026-11-20', category: 'front', mime: 'image/jpeg', data: new ArrayBuffer(0), width: 1, height: 1 })).rejects.toThrow(/vazia/);
  });

  it('keeps photos private: never part of the JSON backup, but wiped with all data', async () => {
    await addPhoto({ day: '2026-11-20', category: 'side', mime: 'image/jpeg', data: bytes(), width: 1, height: 1 });
    const backup = await exportBackup();
    expect(Object.keys(backup.tables)).not.toContain('progressPhotos');
    expect(JSON.stringify(backup)).not.toContain('image/jpeg');
    await wipeAllData();
    expect(await db.progressPhotos.count()).toBe(0);
  });
});

describe('measurement notes', () => {
  it('stores a batch note and allows editing it', async () => {
    await saveMeasurements('2026-11-20', [{ site: 'waist', valueCm: 84 }], 'em jejum');
    const [m] = await db.measurements.toArray();
    expect(m!.note).toBe('em jejum');
    await updateMeasurement(m!.id, { day: '2026-11-20', valueCm: 83.5, note: '' });
    expect(await db.measurements.get(m!.id)).toMatchObject({ valueCm: 83.5, note: undefined });
  });
});
