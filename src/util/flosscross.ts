/**
 * Importación de patrones Flosscross (.fcjson).
 *
 * Formato (verificado empíricamente contra exportaciones reales):
 * - `model.images[0].layers[0].cross`: array plano `w*h`; 0 = celda sin
 *   puntada, k > 0 = índice DIRECTO en `flossIndexes`. Como 0 se reserva
 *   para la celda vacía, el color de `flossIndexes[0]` nunca aparece en la
 *   rejilla (confirmado en las exportaciones reales).
 * - `layers[0].backstitch`: rejilla de puntadas de atrás, mismo codificado.
 * - `model.images[0].flossIndexes`: colores (rgb, id DMC, nombre).
 * - `srcs`: imagen original embebida como data-URL; `images[0].sources[0].id`
 *   identifica cuál corresponde al patrón.
 * - `info.title`: nombre del diseño.
 *
 * `totalStitches` es la rejilla COMPLETA (width × height), que es como la
 * usuaria cuenta el tamaño del patrón (decisión #10). El número de puntadas
 * realmente bordadas se devuelve aparte (`crossStitches` + `backstitchStitches`)
 * para poder mostrar el desglose.
 *
 * Los carretes NO se derivan del patrón: son una decisión manual de la
 * usuaria (decisión #9). Aquí solo se devuelven las puntadas por color.
 */

export interface ImportedColor {
  color: string; // "#rrggbb"
  name: string;
  dmc: string; // se conserva tal cual: "03", "BLANC", "B5200"
  totalStitches: number; // puntadas de cruz de este color
  backstitchStitches: number; // puntadas de atrás de este color
}

export interface ImportedPattern {
  name: string;
  width: number;
  height: number;
  totalStitches: number; // rejilla completa: width * height
  crossStitches: number; // celdas con puntada de cruz
  backstitchStitches: number; // celdas con puntada de atrás
  image?: string; // data-URL de la imagen original, si viene embebida
  colors: ImportedColor[];
}

function rgbToHex(rgb: number[]): string {
  return "#" + rgb.map((n) => n.toString(16).padStart(2, "0")).join("");
}

function countCells(grid: unknown): Map<number, number> {
  const counts = new Map<number, number>();
  if (!Array.isArray(grid)) return counts;
  for (const v of grid) {
    if (typeof v === "number" && v > 0) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return counts;
}

export function parseFlosscross(text: string): ImportedPattern {
  let doc: any;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new Error("El archivo no es un JSON válido.");
  }
  const img = doc?.model?.images?.[0];
  const layer = img?.layers?.[0];
  if (!img || !layer || !Array.isArray(layer.cross) || !Array.isArray(img.flossIndexes)) {
    throw new Error("No parece un patrón Flosscross: falta la rejilla de puntadas o la lista de colores.");
  }

  const width = img.width ?? layer.width ?? 0;
  const height = img.height ?? layer.height ?? 0;

  // Contar puntadas por índice de color. Valor 0 = celda vacía.
  const crossCounts = countCells(layer.cross);
  const backCounts = countCells(layer.backstitch);

  const crossStitches = [...crossCounts.values()].reduce((a, b) => a + b, 0);
  const backstitchStitches = [...backCounts.values()].reduce((a, b) => a + b, 0);

  // Solo los colores que realmente se usan en la rejilla.
  const colors: ImportedColor[] = img.flossIndexes
    .map((f: any, i: number) => ({
      color: rgbToHex(f.rgb ?? [0, 0, 0]),
      name: String(f.name ?? ""),
      dmc: String(f.id ?? ""),
      totalStitches: crossCounts.get(i) ?? 0,
      backstitchStitches: backCounts.get(i) ?? 0,
    }))
    .filter((c) => c.totalStitches > 0 || c.backstitchStitches > 0);

  // Imagen embebida, si la hay.
  let image: string | undefined;
  const srcId = img.sources?.[0]?.id;
  if (srcId && Array.isArray(doc.srcs)) {
    const found = doc.srcs.find((s: any) => s?.id === srcId);
    if (found?.src) image = found.src;
  }

  return {
    name: String(doc.info?.title || "Patrón importado"),
    width,
    height,
    totalStitches: width * height,
    crossStitches,
    backstitchStitches,
    image,
    colors,
  };
}
