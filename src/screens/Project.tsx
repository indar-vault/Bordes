import { useEffect, useState } from "react";
import type { Project, Thread } from "../types";
import {
  addColorToProject,
  deleteSession,
  getProject,
  getProjectThreads,
  getSessions,
  listThreads,
  setReplacement,
  swapProjectThread,
  updateProject,
  type ThreadView,
} from "../util/repo";
import { projectStitchesDone, sessionsByDate } from "../util/progress";
import type { Session } from "../types";

export function Project({
  projectId,
  onStartSession,
  onBack,
}: {
  projectId: number;
  onStartSession: (id: number) => void;
  onBack: () => void;
}) {
  const [project, setProject] = useState<Project | undefined>();
  const [threads, setThreads] = useState<ThreadView[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [newColor, setNewColor] = useState({ color: "#ffffff", name: "", dmc: "", spools: 1, totalStitches: 0 });
  const [library, setLibrary] = useState<Thread[]>([]);
  const [editingReplace, setEditingReplace] = useState<number | null>(null);
  const [plannedName, setPlannedName] = useState("");

  async function refresh() {
    setProject(await getProject(projectId));
    setThreads(await getProjectThreads(projectId));
    setSessions(await getSessions(projectId));
    setLibrary(await listThreads());
  }
  useEffect(() => {
    refresh();
  }, [projectId]);

  const done = projectStitchesDone(sessions, projectId);
  const pct = Math.round((done / Math.max(1, project?.totalStitches ?? 0)) * 100);
  const colorsDone = threads.filter((t) => t.complete).length;

  async function addColor(e: React.FormEvent) {
    e.preventDefault();
    if (!newColor.name.trim()) return;
    await addColorToProject(projectId, newColor);
    setNewColor({ color: "#ffffff", name: "", dmc: "", spools: 1, totalStitches: 0 });
    await refresh();
  }

  async function toggleStatus() {
    await updateProject(projectId, { status: project?.status === "activo" ? "terminado" : "activo" });
    await refresh();
  }

  return (
    <section class="screen">
      <div class="project-head">
        <div class="cover" aria-hidden="true">
          {project?.image ? <img src={project.image} alt="" /> : "▢"}
        </div>
        <div>
          <h1>{project?.name ?? "Proyecto"}</h1>
          <p>{done} / {project?.totalStitches ?? 0} puntadas ({pct}%)</p>
          <p>{colorsDone} / {threads.length} colores completados</p>
          {project?.giftTo && <p class="gift">Para regalar a {project.giftTo}</p>}
          <div class="row">
            <button class="btn" onClick={() => onStartSession(projectId)}>▶ Empezar sesión</button>
            <button class="btn ghost" onClick={toggleStatus}>
              {project?.status === "activo" ? "Marcar terminado" : "Reabrir"}
            </button>
            <button class="btn ghost" onClick={onBack}>← Inicio</button>
          </div>
        </div>
      </div>

      <div class="progress"><div class="progress-fill" style={{ width: `${pct}%` }} /></div>

      <h2>Hilos del proyecto</h2>
      <ul class="threads">
        {threads.map((t) => (
          <li
            key={t.pt.id}
            class={t.complete ? "thread done" : "thread"}
            style={{ "--c": t.thread.color } as React.CSSProperties}
          >
            <span class="spool" aria-hidden="true">●</span>
            <span class="thread-name">
              {t.thread.name} <small>DMC {t.thread.dmc || "—"} · {t.thread.spools} {t.thread.spools === 1 ? "bobina" : "bobinas"}</small>
              {t.pt.plannedName && t.pt.plannedName !== t.thread.name && (
                <small class="planned">
                  (el patrón sugería “{t.pt.plannedName}”{t.pt.plannedDmc ? ` · DMC ${t.pt.plannedDmc}` : ""})
                </small>
              )}
            </span>
            <span class="thread-num">{t.done} / {t.pt.totalStitches}</span>
            {t.complete && <span class="done-tag">Completado</span>}
            <label class="thread-swap">
              <span class="usage">hilo usado</span>
              <select
                value={t.pt.threadId}
                onChange={async (e) => {
                  await swapProjectThread(t.pt.id!, Number(e.target.value));
                  await refresh();
                }}
              >
                {library.map((th) => (
                  <option key={th.id} value={th.id}>
                    {th.name}
                    {th.dmc ? ` (${th.dmc})` : ""} — {th.spools} bob.
                  </option>
                ))}
              </select>
            </label>
            <button
              class="linklike"
              onClick={() => {
                setEditingReplace(t.pt.id!);
                setPlannedName(t.pt.isReplacement ? t.pt.plannedName : t.thread.name);
              }}
            >
              {t.pt.isReplacement ? `reemplaza a “${t.pt.plannedName}”` : "¿reemplaza a…?"}
            </button>
            {editingReplace === t.pt.id && (
              <span class="replace-edit">
                <input
                  type="text"
                  value={plannedName}
                  onChange={(e) => setPlannedName(e.target.value)}
                  placeholder="Hilo teórico del patrón"
                />
                <button
                  class="btn ghost"
                  onClick={async () => {
                    await setReplacement(t.pt.id!, plannedName.trim() === t.thread.name ? null : plannedName);
                    setEditingReplace(null);
                    await refresh();
                  }}
                >
                  Guardar
                </button>
                <button class="linklike" onClick={() => setEditingReplace(null)}>cancelar</button>
              </span>
            )}
          </li>
        ))}
      </ul>

      <form class="form inline" onSubmit={addColor}>
        <input type="color" value={newColor.color} onChange={(e) => setNewColor({ ...newColor, color: e.target.value })} />
        <input type="text" value={newColor.name} onChange={(e) => setNewColor({ ...newColor, name: e.target.value })} placeholder="Nuevo color" />
        <input type="text" value={newColor.dmc} onChange={(e) => setNewColor({ ...newColor, dmc: e.target.value })} placeholder="DMC" style={{ width: 70 }} />
        <input type="number" value={newColor.spools} onChange={(e) => setNewColor({ ...newColor, spools: Number(e.target.value) })} min={0} style={{ width: 60 }} />
        <input type="number" value={newColor.totalStitches} onChange={(e) => setNewColor({ ...newColor, totalStitches: Number(e.target.value) })} min={0} style={{ width: 80 }} />
        <button class="btn ghost" type="submit">+ Añadir hilo</button>
      </form>

      <h2>Registro de sesiones</h2>
      {sessions.length === 0 && <p class="empty">Todavía no hay sesiones. Empieza una para registrar puntadas.</p>}
      <ul class="log">
        {sessionsByDate(sessions).map((group) => (
          <li key={group.date}>
            <strong>{group.date}</strong>
            {group.sessions.map((s) => (
              <p key={s.id}>
                {s.entries.reduce((a, e) => a + e.stitches, 0)} puntadas · {s.durationMin} min
                {s.media ? ` · ${s.media.type}${s.media.title ? ": " + s.media.title : ""}${s.media.episodes ? ` (${s.media.episodes} eps)` : ""}` : ""}
                <button class="linklike" onClick={async () => { await deleteSession(s.id!); await refresh(); }}>borrar</button>
              </p>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}
