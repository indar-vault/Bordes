/**
 * Redimensiona una data-URL a máx. `max` px (JPEG 0.85) para no llenar
 * IndexedDB ni la copia de seguridad JSON. Usado por la foto del patrón y
 * por las fotos del proceso.
 */
export async function resizeDataUrl(url: string, max = 800): Promise<string> {
  const img = new Image();
  await new Promise((resolve) => {
    img.onload = resolve;
    img.src = url;
  });
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}
