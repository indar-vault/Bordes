import { useEffect, useState } from "react";
import type { MediaLog, MediaType, Project, SessionEntry, Thread } from "../types";
import {
  addColorToProject,
  addProjectPhoto,
  deleteProject,
  deleteSession,
  getProject,
  getProjectThreads,
  getSessions,
  insertProjectPhoto,
  listThreads,
  removeProjectPhoto,
  restoreProject,
  restoreSession,
  saveSession,
  setReplacement,
  swapProjectThread,
  updateProject,
  updateSession,
  type ThreadView,
} from "../util/repo";
import { projectStitchesDone, sessionSpools, sessionsByDate } from "../util/progress";
import { resizeDataUrl } from "../util/images";
import type { Session } from "../types";

export function Project({
  projectId,
  onStartSession,
  onOpenSummary,
  onBack,
  onDeleted,
}: {
  projectId: number;
  onStartSession: (id: number) => void;
  onOpenSummary: (id: number) => void;
  onBack: () => void;
  /** A3: registrar un borrado suave y su acción de deshacer. */
  onDeleted: (label: string, run: () => Promise<void>) => void;
}) {
  const [project, setProject] = useState<Project | undefined>();
  const [threads, setThreads] = useState<ThreadView[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [newColor, setNewColor] = useState({ color: "#ffffff", name: "", dmc: "", spools: 1, totalStitches: 0 });
  const [library, setLibrary] = useState<Thread[]>([]);
  const [editingReplace, setEditingReplace] = useState<number | null>(null);
  const [plannedName, setPlannedName] = useState("");
  const [notes, setNotes] = useState("");
  const [giftTo, setGiftTo] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);

  async function refresh() {
    const p = await getProject(projectId);
    setProject(p);
    setNotes(p?.notes ?? "");
    setGiftTo(p?.giftTo ?? "");
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

  async function saveNotes(e: React.FormEvent) {
    e.preventDefault();
    await updateProject(projectId, { notes: notes.trim(), giftTo: giftTo.trim() || undefined });
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
    await refresh();
  }

  async function addPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    for (const f of files) {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(f);
      });
      await addProjectPhoto(projectId, await resizeDataUrl(dataUrl));
    }
    e.target.value = "";
    await refresh();
  }

  async function saveSessionEdit(
    s: Session,
    durationMin: number,
    media: MediaLog | null,
    entries: SessionEntry[]
  ) {
    await updateSession(s.id!, { durationMin, entries, media });
    setEditingSession(null);
    await refresh();
  }

  // B1: sesión rápida — minutos + puntadas por hilo + bobina gastada,
  // sin salir de la página del proyecto (reutiliza saveSession).
  const [quick, setQuick] = useState({ minutes: "", stitches: {} as Record<number, string>, spool: {} as Record<number, boolean> });

  async function saveQuickSession() {
    const entries: SessionEntry[] = threads
      .map((t) => ({
        threadId: t.pt.threadId,
        stitches: Number(quick.stitches[t.pt.threadId] ?? 0) || 0,
        spoolsUsed: quick.spool[t.pt.threadId] ? 1 : 0,
      }))
      .filter((e) => e.stitches > 0 || e.spoolsUsed > 0);
    if (entries.length === 0) return;
    await saveSession({ projectId: projectId, durationMin: Math.max(0, Number(quick.minutes) || 0), entries });
    setQuick({ minutes: "", stitches: {}, spool: {} });
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
            <button class="btn ghost" onClick={() => onOpenSummary(projectId)}>Ver resumen</button>
            <button class="btn ghost" onClick={toggleStatus}>
              {project?.status === "activo" ? "Marcar terminado" : "Reabrir"}
            </button>
            <button class="btn ghost" onClick={onBack}>← Inicio</button>
            <button
              class="btn ghost danger"
              onClick={async () => {
                const name = project?.name ?? "Proyecto";
                await deleteProject(projectId);
                onDeleted(`el proyecto “${name}”`, () => restoreProject(projectId));
                onBack();
              }}
            >
              Eliminar proyecto
            </button>
          </div>
        </div>
      </div>

      <div class="progress"><div class="progress-fill" style={{ width: `${pct}%` }} /></div>

      <form class="quick-session" onSubmit={(e) => { e.preventDefault(); saveQuickSession(); }}>
        <h2>Sesión rápida</h2>
        <label>
          Minutos
          <input class="quick-minutes" type="number" min="0" value={quick.minutes} onChange={(e) => setQuick({ ...quick, minutes: e.target.value })} />
        </label>
        <div class="quick-rows">
          {threads.map((t) => (
            <div class="quick-row" key={t.pt.threadId}>
              <span class="swatch" style={{ background: t.thread.color }} aria-hidden="true" />
              <span class="quick-name">{t.thread.name}</span>
              <input
                class="quick-stitches"
                type="number"
                min="0"
                placeholder="puntadas"
                value={quick.stitches[t.pt.threadId] ?? ""}
                onChange={(e) => setQuick({ ...quick, stitches: { ...quick.stitches, [t.pt.threadId]: e.target.value } })}
              />
              <label class="quick-spool">
                <input
                  type="checkbox"
                  checked={!!quick.spool[t.pt.threadId]}
                  onChange={(e) => setQuick({ ...quick, spool: { ...quick.spool, [t.pt.threadId]: e.target.checked } })}
                />
                −1 bobina
              </label>
            </div>
          ))}
        </div>
        <button class="btn" type="submit">Guardar sesión rápida</button>
      </form>

      <form class="form meta" onSubmit={saveNotes}>
        <label>
          Apuntes del proyecto
          <textarea
            class="project-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Notas: cómo lo bordas, trucos, qué aprendiste…"
          />
        </label>
        <label>
          ¿Es un regalo?
          <input type="text" value={giftTo} onChange={(e) => setGiftTo(e.target.value)} placeholder="Para regalar a…" />
        </label>
        <button class="btn ghost" type="submit">Guardar apuntes</button>
        {notesSaved && <span class="saved">Guardado</span>}
      </form>

      <h2>Fotos del proceso</h2>
      {project?.photos?.length ? (
        <div class="gallery">
          {project.photos.map((src, i) => (
            <figure class="photo">
              <img src={src} alt={`Foto ${i + 1} del proceso`} />
              <button
                class="linklike"
                onClick={async () => {
                  const photo = src;
                  await removeProjectPhoto(projectId, i);
                  onDeleted("la foto", async () => {
                    await insertProjectPhoto(projectId, photo, i);
                    await refresh();
                  });
                  await refresh();
                }}
              >
                quitar
              </button>
            </figure>
          ))}
        </div>
      ) : (
        <p class="empty">Todavía no hay fotos del proceso.</p>
      )}
      <input class="photo-input" type="file" accept="image/*" multiple onChange={addPhotos} />

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
              {t.thread.name} <small>DMC {t.thread.dmc || "—"} · {t.spoolsLeft} {t.spoolsLeft === 1 ? "bobina" : "bobinas"}{t.spoolsUsed > 0 ? ` · ${t.spoolsUsed} gast${t.spoolsUsed === 1 ? "ada" : "adas"}` : ""}</small>
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
                  Guardar reemplazo
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
            {group.sessions.map((s) =>
              editingSession?.id === s.id ? (
                <SessionEditor
                  key={s.id}
                  session={s}
                  threads={threads}
                  onSave={(durationMin, media, entries) => saveSessionEdit(s, durationMin, media, entries)}
                  onCancel={() => setEditingSession(null)}
                />
              ) : (
                <p key={s.id}>
                  {s.entries.reduce((a, e) => a + e.stitches, 0)} puntadas · {s.durationMin} min
                  {sessionSpools(s) > 0 ? ` · ${sessionSpools(s)} ${sessionSpools(s) === 1 ? "bobina gastada" : "bobinas gastadas"}` : ""}
                  {s.media ? ` · ${s.media.type}${s.media.title ? ": " + s.media.title : ""}${s.media.episodes ? ` (${s.media.episodes} eps)` : ""}` : ""}
                  <button class="linklike" onClick={() => setEditingSession(s)}>editar</button>
                  <button class="linklike" onClick={async () => {
                    await deleteSession(s.id!);
                    onDeleted(`la sesión del ${s.date.slice(0, 10)}`, async () => {
                      await restoreSession(s.id!);
                      await refresh();
                    });
                    await refresh();
                  }}>borrar</button>
                </p>
              )
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Edición inline de una sesión guardada: duración, puntadas por hilo, bobinas
 * gastadas y lo que se vio. Misma estructura que la pantalla de sesión.
 */
function SessionEditor({
  session,
  threads,
  onSave,
  onCancel,
}: {
  session: Session;
  threads: ThreadView[];
  onSave: (durationMin: number, media: MediaLog | null, entries: SessionEntry[]) => void;
  onCancel: () => void;
}) {
  const previous = new Map(session.entries.map((e) => [e.threadId, e]));
  const [duration, setDuration] = useState(session.durationMin);
  const [stitches, setStitches] = useState<Record<number, number>>(
    Object.fromEntries(session.entries.map((e) => [e.threadId, e.stitches]))
  );
  const [spools, setSpools] = useState<Record<number, number>>(
    Object.fromEntries(session.entries.map((e) => [e.threadId, e.spoolsUsed ?? 0]))
  );
  const [mediaType, setMediaType] = useState<MediaType | "">(session.media?.type ?? "");
  const [mediaTitle, setMediaTitle] = useState(session.media?.title ?? "");
  const [episodes, setEpisodes] = useState(session.media?.episodes ?? 0);

  const active = threads.filter((t) => t.pt.threadId);
  const total = active.reduce((a, t) => a + (stitches[t.pt.threadId] ?? 0), 0);

  return (
    <div class="session-edit">
      <div class="counter-row">
        <input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} min={0} style={{ width: 70 }} />
        <span>min</span>
      </div>
      {active.map((t) => {
        const id = t.pt.threadId;
        // Las bobinas que esta sesión ya contaba vuelven a estar disponibles
        // al re-editarla: el máximo es lo que queda + lo que gastó esta sesión.
        const maxSpools = t.spoolsLeft + (previous.get(id)?.spoolsUsed ?? 0);
        return (
          <div class="counter-row" style={{ "--c": t.thread.color } as React.CSSProperties}>
            <span class="spool" aria-hidden="true">●</span>
            <span class="thread-name">{t.thread.name}</span>
            <input
              type="number"
              value={stitches[id] ?? 0}
              onChange={(e) => setStitches((s) => ({ ...s, [id]: Number(e.target.value) }))}
              min={0}
            />
            {maxSpools > 0 && (
              <label class="spool-used">
                <input
                  type="checkbox"
                  checked={(spools[id] ?? 0) > 0}
                  onChange={(e) => setSpools((s) => ({ ...s, [id]: e.target.checked ? 1 : 0 }))}
                />
                <span>¿Se gastó una bobina?</span>
                {(spools[id] ?? 0) > 0 && (
                  <select
                    value={spools[id] ?? 1}
                    onChange={(e) => setSpools((s) => ({ ...s, [id]: Number(e.target.value) }))}
                  >
                    {Array.from({ length: maxSpools }, (_, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1}</option>
                    ))}
                  </select>
                )}
              </label>
            )}
          </div>
        );
      })}
      <div class="media">
        <label>
          ¿Qué has visto?
          <select value={mediaType} onChange={(e) => setMediaType(e.target.value as MediaType | "")}>
            <option value="">—</option>
            <option value="youtube">YouTube</option>
            <option value="peli">Película</option>
            <option value="serie">Serie</option>
          </select>
        </label>
        {mediaType && (
          <>
            <input type="text" value={mediaTitle} onChange={(e) => setMediaTitle(e.target.value)} placeholder="Nombre" />
            {mediaType === "serie" && (
              <input type="number" value={episodes} onChange={(e) => setEpisodes(Number(e.target.value))} min={0} placeholder="Episodios" style={{ width: 80 }} />
            )}
          </>
        )}
      </div>
      <p class="hint">Total de esta sesión: <strong>{total}</strong> puntadas</p>
      <div class="row">
        <button
          class="btn"
          onClick={() =>
            onSave(
              duration,
              mediaType ? { type: mediaType, title: mediaTitle || undefined, episodes: episodes || undefined } : null,
              active.map((t) => ({
                threadId: t.pt.threadId,
                stitches: stitches[t.pt.threadId] ?? 0,
                spoolsUsed: spools[t.pt.threadId] ?? 0,
              }))
            )
          }
        >
          Guardar cambios
        </button>
        <button class="linklike" onClick={onCancel}>cancelar</button>
      </div>
    </div>
  );
}
