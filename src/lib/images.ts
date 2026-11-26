/** Resizes an image file on-device to a JPEG (longest side ≤ max). Nothing leaves the device. */
export async function resizeImage(file: Blob, max = 1280, quality = 0.82): Promise<{ data: ArrayBuffer; mime: string; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Imagem inválida.'));
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao processar a imagem.'))), 'image/jpeg', quality));
    return { data: await blob.arrayBuffer(), mime: 'image/jpeg', width: canvas.width, height: canvas.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
