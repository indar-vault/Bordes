import { useState } from "react";
import { createProject, listThreads, findThreadMatch, type NewColorInput } from "../util/repo";
import { parseFlosscross } from "../util/flosscross";
import { resizeDataUrl } from "../util/images";
import { dmcAutoFill } from "../data/dmc";
import type { Thread } from "../types";

/**
 * Color del formulario. `threadId` es el hilo REAL que se va a bordar:
 * 0 = se creará uno nuevo en la biblioteca al guardar el proyecto.
 */
interface ColorRow extends NewColorInput {
  threadId: number;
}

/**
 * Alta de un proyecto: manual o importando un patrón Flosscross (.fcjson),
 * que rellena este mismo formulario. Los colores importados son solo
 * SUGERENCIAS: cada uno se puede cambiar por un hilo de la biblioteca.
 */
export function NewProject({ onCreated }: { onCreated: (id: number) => void }) {
  const [name, setName] = useState("");
  const [total, setTotal] = useState(0);
  const [giftTo, setGiftTo] = useState("");
  const [notes, setNotes] = useState("");
  const [image, setImage] = useState<string | undefined>();
  const [colors, setColors] = useState<ColorRow[]>([
    { color: "#9FA6B1", name: "Pearl Gray", dmc: "415", spools: 1, totalStitches: 0, threadId: 0 },
  ]);
  const [grid, setGrid] = useState<{ w: number; h: number; cross: number; back: number } | null>(null);
  const [library, setLibrary] = useState<Thread[]>([]);
  const [importInfo, setImportInfo] = useState("");
  const [error, setError] = useState("");

  async function importFcjson(file: File) {
    setError("");
    try {
      const pattern = parseFlosscross(await file.text());
      const lib = await listThreads();
      setLibrary(lib);
      setName(pattern.name);
      setTotal(pattern.totalStitches);
      setGrid({ w: pattern.width, h: pattern.height, cross: pattern.crossStitches, back: pattern.backstitchStitches });

      const rows: ColorRow[] = [];
      for (const c of pattern.colors) {
        // Si ese DMC ya está en la biblioteca, se usa ese hilo directamente.
        const match = await findThreadMatch(c.color, c.name, c.dmc);
        rows.push({
          color: c.color,
          name: c.name,
          dmc: c.dmc,
          spools: 1,
          totalStitches: c.totalStitches,
          threadId: match?.id ?? 0,
        });
      }
      setColors(rows);
      setImportInfo(
        `Importado: rejilla ${pattern.width}×${pattern.height} = ${pattern.totalStitches} celdas ` +
          `(${pattern.crossStitches} puntadas${pattern.backstitchStitches ? ` + ${pattern.backstitchStitches} de atrás` : ""}), ` +
          `${rows.length} colores${pattern.image ? ", imagen incluida" : ""}.`
      );
      if (pattern.image) setImage(await resizeDataUrl(pattern.image));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo leer el archivo.");
    }
  }

  async function readImage(file: File) {
    const url = URL.createObjectURL(file);
    setImage(await resizeDataUrl(url));
  }

  function setColor(i: number, patch: Partial<ColorRow>) {
    setColors((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("El proyecto necesita un nombre.");
      return;
    }
    const id = await createProject({
      name,
      totalStitches: total,
      giftTo,
      notes,
      image,
      colors: colors.map((c) => ({
        color: c.color,
        name: c.name,
        dmc: c.dmc,
        spools: c.spools,
        totalStitches: c.totalStitches,
        threadId: c.threadId || undefined,
      })),
    });
    onCreated(id);
  }

  const colorSum = colors.reduce((a, c) => a + (c.totalStitches || 0), 0);

  return (
    <section class="screen">
      <h1>Nuevo proyecto</h1>
      <form class="form" onSubmit={submit}>
        <label>
          Importar patrón Flosscross (.fcjson)
          <input
            class="fcjson-input"
            type="file"
            accept=".fcjson,.json"
            onChange={(e) => e.target.files && importFcjson(e.target.files[0])}
          />
        </label>
        {importInfo && <p class="hint">{importInfo}</p>}
        {error && <p class="error">{error}</p>}

        <label>
          Nombre
          <input id="project-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Flor de lis" />
        </label>

        <label>
          Puntadas totales
          <input id="project-total" type="number" value={total} onChange={(e) => setTotal(Number(e.target.value))} min={0} />
          {grid && (
            <span class="total-hint">
              <button type="button" class="chip" onClick={() => setTotal(grid.w * grid.h)}>
                rejilla {grid.w}×{grid.h} = {grid.w * grid.h}
              </button>
              <button type="button" class="chip" onClick={() => setTotal(grid.cross + grid.back)}>
                solo puntadas {grid.cross + grid.back}
              </button>
            </span>
          )}
        </label>

        <label>
          Regalo a (opcional)
          <input type="text" value={giftTo} onChange={(e) => setGiftTo(e.target.value)} placeholder="Marta" />
        </label>

        <label>
          Foto del patrón
          <input type="file" accept="image/*" onChange={(e) => e.target.files && readImage(e.target.files[0])} />
        </label>
        {image && <img class="thumb" src={image} alt="Foto del patrón" />}

        <h2>Colores</h2>
        <table class="colors">
          <thead>
            <tr>
              <th class="col-hex">Color</th>
              <th class="col-name">Nombre</th>
              <th class="col-dmc">DMC</th>
              <th class="col-spools">Bob.</th>
              <th class="col-total">Punt.</th>
              <th class="col-thread">Hilo a usar</th>
              <th class="col-del"></th>
            </tr>
          </thead>
          <tbody>
            {colors.map((c, i) => (
              <tr key={i}>
                <td><input class="color-hex" type="color" value={c.color} onChange={(e) => setColor(i, { color: e.target.value })} /></td>
                <td><input class="color-name" type="text" value={c.name} onChange={(e) => setColor(i, { name: e.target.value })} /></td>
                <td>
                  <input
                    class="color-dmc"
                    type="text"
                    value={c.dmc ?? ""}
                    onChange={(e) => {
                      setColor(i, { dmc: e.target.value, ...dmcAutoFill(c.name, e.target.value) });
                    }}
                  />
                </td>
                <td><input class="color-spools" type="number" value={c.spools ?? 1} onChange={(e) => setColor(i, { spools: Number(e.target.value) })} min={0} max={99} /></td>
                <td><input class="color-total" type="number" value={c.totalStitches} onChange={(e) => setColor(i, { totalStitches: Number(e.target.value) })} min={0} max={9999} /></td>
                <td>
                  <select
                    class="color-thread"
                    value={c.threadId}
                    onChange={(e) => setColor(i, { threadId: Number(e.target.value) })}
                    title="Hilo real que se usará para este color del patrón"
                  >
                    <option value={0}>Nuevo: {c.name || "sin nombre"}</option>
                    {library.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                        {t.dmc ? ` (${t.dmc})` : ""} — {t.spools} bob.
                      </option>
                    ))}
                  </select>
                </td>
                <td><button type="button" class="btn ghost" onClick={() => setColors((cs) => cs.filter((_, j) => j !== i))}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p class="hint">
          Suma de puntadas por color: {colorSum}
          {total > 0 && total !== colorSum ? " ≠ total del proyecto (la rejilla completa)" : ""}
        </p>
        <button type="button" class="btn ghost" onClick={() => setColors((cs) => [...cs, { color: "#ffffff", name: "", dmc: "", spools: 1, totalStitches: 0, threadId: 0 }])}>
          + Añadir color
        </button>

        <label>
          Notas
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </label>
        <button type="submit" class="btn">Crear proyecto</button>
      </form>
    </section>
  );
}
