import { useState } from "react";
import { createProject, type NewColorInput } from "../util/repo";
import { parseFlosscross } from "../util/flosscross";

/** Redimensiona una data-URL a máx. 800 px para no llenar IndexedDB. */
async function resizeDataUrl(url: string): Promise<string> {
  const img = new Image();
  await new Promise((resolve) => {
    img.onload = resolve;
    img.src = url;
  });
  const scale = Math.min(1, 800 / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

/**
 * Alta de un proyecto: manual o importando un patrón Flosscross (.fcjson),
 * que rellena este mismo formulario.
 */
export function NewProject({ onCreated }: { onCreated: (id: number) => void }) {
  const [name, setName] = useState("");
  const [total, setTotal] = useState(0);
  const [giftTo, setGiftTo] = useState("");
  const [notes, setNotes] = useState("");
  const [image, setImage] = useState<string | undefined>();
  const [colors, setColors] = useState<NewColorInput[]>([
    { color: "#9FA6B1", name: "Pearl Gray", dmc: "415", spools: 1, totalStitches: 0 },
  ]);
  const [importInfo, setImportInfo] = useState<string>("");

  function setColor(i: number, patch: Partial<NewColorInput>) {
    setColors((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  }

  async function importFcjson(file: File) {
    try {
      const p = parseFlosscross(await file.text());
      setName(p.name);
      setTotal(p.totalStitches);
      // Los carretes no se calculan: se editan a mano (decisión #9).
      setColors(p.colors.map((c) => ({ ...c, spools: 1 })));
      if (p.image) setImage(await resizeDataUrl(p.image));
      setImportInfo(
        `Importado: ${p.totalStitches} puntadas, ${p.colors.length} colores, rejilla ${p.width}×${p.height}${p.image ? ", imagen incluida" : ""}.`
      );
    } catch (err) {
      setImportInfo(`No se pudo importar: ${(err as Error).message}`);
    }
  }

  async function readImage(file: File) {
    const url = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    setImage(await resizeDataUrl(url));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const id = await createProject({ name, totalStitches: total, giftTo, notes, image, colors });
    onCreated(id);
  }

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
        <label>
          Nombre
          <input id="project-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Flor de lis" />
        </label>
        <label>
          Puntadas totales
          <input id="project-total" type="number" value={total} onChange={(e) => setTotal(Number(e.target.value))} min={0} />
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
            <tr><th>Color</th><th>Nombre</th><th>DMC</th><th>Carretes</th><th>Puntadas</th></tr>
          </thead>
          <tbody>
            {colors.map((c, i) => (
              <tr key={i}>
                <td><input class="color-hex" type="color" value={c.color} onChange={(e) => setColor(i, { color: e.target.value })} /></td>
                <td><input class="color-name" type="text" value={c.name} onChange={(e) => setColor(i, { name: e.target.value })} /></td>
                <td><input class="color-dmc" type="text" value={c.dmc ?? ""} onChange={(e) => setColor(i, { dmc: e.target.value })} /></td>
                <td><input class="color-spools" type="number" value={c.spools} onChange={(e) => setColor(i, { spools: Number(e.target.value) })} min={0} /></td>
                <td><input class="color-total" type="number" value={c.totalStitches} onChange={(e) => setColor(i, { totalStitches: Number(e.target.value) })} min={0} /></td>
                <td><button type="button" class="btn ghost" onClick={() => setColors((cs) => cs.filter((_, j) => j !== i))}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p class="hint">
          Suma de colores: {colors.reduce((a, c) => a + (c.totalStitches || 0), 0)} puntadas
          {total > 0 && total !== colors.reduce((a, c) => a + (c.totalStitches || 0), 0) ? " ≠ total indicado" : ""}
        </p>
        <button type="button" class="btn ghost" onClick={() => setColors((cs) => [...cs, { color: "#ffffff", name: "", dmc: "", spools: 1, totalStitches: 0 }])}>
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
