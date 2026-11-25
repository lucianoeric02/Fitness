import { db, migrateGoalV1, TABLE_NAMES, type TableName } from '@/data/db';
import { nowIso } from '@/lib/dates';

export const BACKUP_FORMAT = 'iron-track-backup';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  schemaVersion: number;
  exportedAt: string;
  tables: Partial<Record<TableName, unknown[]>>;
}

export interface BackupStats {
  totalRecords: number;
  perTable: Partial<Record<TableName, number>>;
}

export async function exportBackup(): Promise<BackupFile> {
  return db.transaction('r', TABLE_NAMES.map((t) => db.table(t)), async () => {
    const tables: BackupFile['tables'] = {};
    for (const name of TABLE_NAMES) {
      tables[name] = await db.table(name).toArray();
    }
    return {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      schemaVersion: db.verno,
      exportedAt: nowIso(),
      tables,
    };
  });
}

export function backupStats(backup: Pick<BackupFile, 'tables'>): BackupStats {
  const perTable: BackupStats['perTable'] = {};
  let totalRecords = 0;
  for (const name of TABLE_NAMES) {
    const n = backup.tables[name]?.length ?? 0;
    perTable[name] = n;
    totalRecords += n;
  }
  return { totalRecords, perTable };
}

export class BackupError extends Error {}

/** Parses and validates a backup file's text. Throws BackupError with a pt-BR message. */
export function parseBackup(text: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError('O arquivo não é um JSON válido.');
  }
  if (!data || typeof data !== 'object') throw new BackupError('Arquivo de backup inválido.');
  const b = data as Partial<BackupFile>;
  if (b.format !== BACKUP_FORMAT) throw new BackupError('Este arquivo não é um backup do Iron Track.');
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) {
    throw new BackupError('Backup criado por uma versão mais nova do app. Atualize o app antes de importar.');
  }
  if (typeof b.schemaVersion !== 'number' || b.schemaVersion > db.verno) {
    throw new BackupError('Backup criado por uma versão mais nova do app. Atualize o app antes de importar.');
  }
  if (!b.tables || typeof b.tables !== 'object') throw new BackupError('Backup sem dados.');
  const known = new Set<string>(TABLE_NAMES);
  for (const [name, rows] of Object.entries(b.tables)) {
    if (!known.has(name)) throw new BackupError(`Tabela desconhecida no backup: ${name}.`);
    if (!Array.isArray(rows)) throw new BackupError(`Dados inválidos em ${name}.`);
    for (const row of rows) {
      if (!row || typeof row !== 'object' || typeof (row as { id?: unknown }).id !== 'string') {
        throw new BackupError(`Registro sem ID em ${name}.`);
      }
    }
  }
  const file = b as BackupFile;
  // Older backups: bring records up to the current schema before import.
  if (file.schemaVersion < 2 && file.tables.goals) {
    file.tables.goals = file.tables.goals.map((g) => migrateGoalV1(g as Record<string, unknown>));
  }
  return file;
}

/** Replaces ALL local data with the backup contents, atomically. */
export async function restoreBackup(backup: BackupFile): Promise<BackupStats> {
  await db.transaction('rw', TABLE_NAMES.map((t) => db.table(t)), async () => {
    for (const name of TABLE_NAMES) {
      const table = db.table(name);
      await table.clear();
      const rows = backup.tables[name];
      if (rows?.length) await table.bulkAdd(rows);
    }
  });
  return backupStats(backup);
}

/** Deletes all local data. */
export async function wipeAllData(): Promise<void> {
  await db.transaction('rw', TABLE_NAMES.map((t) => db.table(t)), async () => {
    for (const name of TABLE_NAMES) await db.table(name).clear();
  });
}

export function backupFileName(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `iron-track-backup-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}.json`;
}
