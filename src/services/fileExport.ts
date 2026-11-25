import { Capacitor } from '@capacitor/core';

export type SaveResult = 'shared' | 'downloaded' | 'cancelled';

/**
 * Saves a text file for the user. On Android (Capacitor) the file is written
 * to app cache and handed to the system share sheet (Drive, Files, e-mail…),
 * since WebView blob downloads are not supported. On web it downloads.
 */
export async function saveTextFile(fileName: string, contents: string, mimeType = 'application/json'): Promise<SaveResult> {
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);
    const written = await Filesystem.writeFile({
      path: fileName,
      data: contents,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    try {
      await Share.share({ title: fileName, files: [written.uri], dialogTitle: 'Salvar backup' });
      return 'shared';
    } catch (err) {
      if (err instanceof Error && /cancel/i.test(err.message)) return 'cancelled';
      throw err;
    }
  }

  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}

export function readFileAsText(file: File): Promise<string> {
  return file.text();
}
