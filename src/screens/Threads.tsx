import { useEffect, useState } from "react";
import { db } from "../db";
import type { Thread } from "../types";
import { findThreadMatch, listThreads, threadUsage, updateThread } from "../util/repo";

/**
 * Biblioteca global de hilos: color, nombre, DMC y bobinas disponibles.
 * Un mismo hilo puede participar en varios proyectos.
 */
export function Threads() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [usage, setUsage] = useState<Record<number, string[]>>({});
  const [form, setForm] = useState({ color: "#ffffff", name: "", dmc: "", spools: 1 });
  const [msg, setMsg] = useState("");

  async function refresh() {
    setThreads(await listThreads());
    setUsage(await threadUsage());
  }
  useEffect(() => {
    refresh();
  }, []);

  async function addThread(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() && !form.dmc.trim()) return;
    const match = await findThreadMatch(form.color, form.name, form.dmc);
    if (match) {
      setMsg(`Ya existe un hilo equivalente (${match.name}). Las bobinas se gestionan en su fila.`);
      return;
    }
    await db.threads.add({
      color: form.color || "#000000",
      name: form.name.trim() || `DMC ${form.dmc.trim()}`,
      dmc: form.dmc.trim() || undefined,
      spools: form.spools,
    });
    setForm({ color: "#ffffff", name: "", dmc: "", spools: 1 });
    setMsg("");
    await refresh();
  }

  async function saveSpools(t: Thread) {
    await updateThread(t.id!, { spools: Math.max(0, Number(t.spools)) });
    await refresh();
  }

  return (
    <section class="screen">
      <h1>Biblioteca de hilos</h1>
      <p class="hint">
        Los hilos se crean al dar de alta proyectos (o aquí). Si dos proyectos usan el mismo
        DMC, comparten el hilo de la biblioteca.
      </p>

      <form class="form inline" onSubmit={addThread}>
        <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
        <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre del hilo" />
        <input type="text" value={form.dmc} onChange={(e) => setForm({ ...form, dmc: e.target.value })} placeholder="DMC" style={{ width: 70 }} />
        <input type="number" value={form.spools} onChange={(e) => setForm({ ...form, spools: Number(e.target.value) })} min={0} style={{ width: 60 }} />
        <button class="btn ghost" type="submit">+ Añadir hilo</button>
      </form>
      {msg && <p class="msg">{msg}</p>}

      {threads.length === 0 && <p class="empty">La biblioteca está vacía. Añade hilos o crea un proyecto.</p>}
      <ul class="threads">
        {threads.map((t) => (
          <li key={t.id} class="thread" style={{ "--c": t.color } as React.CSSProperties}>
            <span class="spool" aria-hidden="true">●</span>
            <span class="thread-name">
              {t.name} <small>DMC {t.dmc || "—"}</small>
            </span>
            <label class="spools">
              Bobinas
              <input
                class="lib-spools"
                type="number"
                value={t.spools}
                min={0}
                style={{ width: 60 }}
                onChange={(e) => setThreads((ts) => ts.map((x) => (x.id === t.id ? { ...x, spools: Number(e.target.value) } : x)))}
              />
            </label>
            <button class="btn ghost lib-save" onClick={() => saveSpools(t)}>Guardar</button>
            <small class="usage">{(usage[t.id!] ?? []).join(", ") || "sin uso"}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}
