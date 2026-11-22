import { db } from "../db";
import type { AppSettings, MediaLog, Project, ProjectThread, Session, SessionEntry, Thread } from "../types";
import { isThreadComplete, threadProgress, threadSpoolsUsed } from "./progress";
import { mediaSuggestions, type MediaSuggestion } from "./media";

/**
 * Fecha/hora en hora LOCAL con su desfase (p. ej. "2026-11-20T09:30:00+01:00").
 * Guardamos así para que `date.slice(0, 10)` sea el día local de la usuaria
 * (Madrid), no el día UTC, que cambiaría de día en sesiones de madrugada.
 */
export function localISO(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const abs = Math.abs(off);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

export interface NewColorInput {
  color: string;
  name: string;
  dmc?: string;
  spools?: number;
  totalStitches: number;
  /** Hilo ya existente de la biblioteca; si no se indica, se crea uno nuevo. */
  threadId?: number;
}

export interface NewProjectInput {
  name: string;
  image?: string;
  totalStitches: number;
  giftTo?: string;
  notes?: string;
  colors: NewColorInput[];
}

/**
 * Buscar en la biblioteca un hilo equivalente: primero por código DMC,
 * si no, por nombre+color. Evita duplicados cuando dos proyectos usan el mismo hilo.
 */
export async function findThreadMatch(color: string, name: string, dmc?: string): Promise<Thread | undefined> {
  const threads = await db.threads.toArray();
  const d = (dmc || "").trim().toLowerCase();
  if (d) {
    const byDmc = threads.find((t) => (t.dmc || "").trim().toLowerCase() === d);
    if (byDmc) return byDmc;
  }
  const n = name.trim().toLowerCase();
  const c = color.trim().toLowerCase();
  return threads.find((t) => t.name.trim().toLowerCase() === n && t.color.toLowerCase() === c);
}

export async function createProject(input: NewProjectInput): Promise<number> {
  const now = localISO();
  const colorsTotal = input.colors.reduce((sum, c) => sum + (c.totalStitches || 0), 0);
  const projectId = await db.projects.add({
    name: input.name.trim(),
    image: input.image,
    totalStitches: input.totalStitches || colorsTotal,
    status: "activo",
    giftTo: input.giftTo?.trim() || undefined,
    notes: input.notes?.trim() ?? "",
    createdAt: now,
    updatedAt: now,
    startDate: now,
  });

  let order = 0;
  for (const c of input.colors) {
    if (!c.name.trim() && !c.color) continue;
    const colorHex = c.color || "#000000";
    const plannedName = c.name.trim();
    const plannedDmc = c.dmc?.trim() || undefined;
    // El hilo que se bordará de verdad: el elegido a mano (importación), el que
    // ya está en la biblioteca, o uno nuevo creado a partir de la sugerencia.
    const existing = c.threadId ? await db.threads.get(c.threadId) : await findThreadMatch(colorHex, c.name, c.dmc);
    const threadId =
      existing?.id ??
      (await db.threads.add({
        color: colorHex,
        name: plannedName || "Color sin nombre",
        dmc: plannedDmc,
        spools: c.spools ?? 1,
      }));
    await db.projectThreads.add({
      projectId,
      threadId,
      plannedName,
      plannedDmc,
      isReplacement: false,
      totalStitches: c.totalStitches,
      order: order++,
    });
  }
  return projectId;
}

export async function listProjects(): Promise<Project[]> {
  return (await db.projects.orderBy("updatedAt").reverse().toArray()).filter((p) => !p.deletedAt);
}

/** Sesiones vivas (sin borrado suave) de proyectos vivos, para los widgets. */
export async function liveSessions(): Promise<Session[]> {
  const liveIds = new Set((await listProjects()).map((p) => p.id!));
  return (await db.sessions.toArray()).filter((s) => !s.deletedAt && liveIds.has(s.projectId));
}

/** Series, películas y vídeos ya apuntados, para autocompletar (D1). */
export async function mediaHistory(): Promise<MediaSuggestion[]> {
  return mediaSuggestions(await liveSessions());
}

/** Ajustes globales (A4): una única fila con clave "app". Los descansos
 * por semana (C2) defaultan a 1; se cambian en Configuración. */
export const DEFAULT_SETTINGS: AppSettings = { key: "app", freezeDays: 1 };

export async function getSettings(): Promise<AppSettings> {
  const s = await db.settings.get("app");
  return s ? { ...DEFAULT_SETTINGS, ...s } : DEFAULT_SETTINGS;
}

/** Registrar que se ha exportado una copia de seguridad (A4). */
export async function markBackup(): Promise<AppSettings> {
  const s: AppSettings = { key: "app", ...(await getSettings()), lastBackupAt: localISO() };
  await db.settings.put(s);
  return s;
}

/** Cambiar ajustes globales (C2): fusiona el parche sobre la fila "app". */
export async function setSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const s: AppSettings = { key: "app", ...(await getSettings()), ...patch };
  await db.settings.put(s);
  return s;
}

export async function getProject(id: number): Promise<Project | undefined> {
  return db.projects.get(id);
}

export async function updateProject(id: number, patch: Partial<Project>): Promise<void> {
  await db.projects.update(id, { ...patch, updatedAt: localISO() });
}

/**
 * Borrado suave (A3): la sesión y el proyecto se marcan con `deletedAt` y
 * siguen en la base hasta la purga (exportar una copia). Así se pueden
 * deshacer desde el banner.
 */
export async function deleteProject(id: number): Promise<void> {
  await db.projects.update(id, { deletedAt: localISO() });
}

export async function restoreProject(id: number): Promise<void> {
  await db.projects.update(id, { deletedAt: undefined });
}

/** Hilo tal como participa en un proyecto, con su progreso derivado. */
export interface ThreadView {
  pt: ProjectThread;
  thread: Thread;
  done: number;
  complete: boolean;
  /** Bobinas gastadas por este hilo (en cualquier proyecto), derivadas de las sesiones. */
  spoolsUsed: number;
  /** Bobinas que quedan: las registradas menos las gastadas. */
  spoolsLeft: number;
}

export async function getProjectThreads(projectId: number): Promise<ThreadView[]> {
  const pts = await db.projectThreads.where({ projectId }).sortBy("order");
  const sessions = (await db.sessions.where({ projectId }).toArray()).filter((s) => !s.deletedAt);
  // El gasto de bobinas es global: un mismo hilo puede gastarse en varios proyectos.
  const allSessions = (await db.sessions.toArray()).filter((s) => !s.deletedAt);
  const views: ThreadView[] = [];
  for (const pt of pts) {
    const thread = await db.threads.get(pt.threadId);
    if (!thread) continue;
    const done = threadProgress(sessions, pt.threadId);
    const spoolsUsed = threadSpoolsUsed(allSessions, pt.threadId);
    views.push({
      pt,
      thread,
      done,
      complete: isThreadComplete(sessions, pt),
      spoolsUsed,
      spoolsLeft: Math.max(0, (thread.spools ?? 0) - spoolsUsed),
    });
  }
  // Los completados bajan al final (menor prioridad), como pide el ticket.
  return views.sort((a, b) => Number(a.complete) - Number(b.complete) || a.pt.order - b.pt.order);
}

export async function addColorToProject(projectId: number, input: NewColorInput): Promise<number> {
  const pts = await db.projectThreads.where({ projectId }).toArray();
  const order = pts.length;
  const colorHex = input.color || "#000000";
  const existing = await findThreadMatch(colorHex, input.name, input.dmc);
  const threadId = existing?.id ?? (await db.threads.add({
    color: colorHex,
    name: input.name.trim() || "Color sin nombre",
    dmc: input.dmc?.trim() || undefined,
    spools: input.spools ?? 1,
  }));
  const ptId = await db.projectThreads.add({
    projectId,
    threadId,
    plannedName: input.name.trim(),
    isReplacement: false,
    totalStitches: input.totalStitches,
    order,
  });
  await db.projects.update(projectId, { updatedAt: localISO() });
  return ptId;
}

export async function saveSession(input: {
  projectId: number;
  durationMin: number;
  entries: SessionEntry[];
  media?: MediaLog;
  date?: string;
}): Promise<Session> {
  const session: Session = {
    projectId: input.projectId,
    date: input.date ?? localISO(),
    durationMin: Math.max(0, Math.round(input.durationMin)),
    entries: input.entries
      .map((e) => ({ threadId: e.threadId, stitches: e.stitches, spoolsUsed: Math.max(0, Math.round(e.spoolsUsed ?? 0)) }))
      .filter((e) => e.stitches > 0 || e.spoolsUsed > 0),
    media: input.media && (input.media.type || input.media.title) ? input.media : undefined,
  };
  await db.sessions.add(session);
  await db.projects.update(input.projectId, { updatedAt: localISO() });
  return session;
}

export async function deleteSession(id: number): Promise<void> {
  await db.sessions.update(id, { deletedAt: localISO() });
}

export async function restoreSession(id: number): Promise<void> {
  await db.sessions.update(id, { deletedAt: undefined });
}

/** Editar una sesión ya guardada (duración, entradas o media). */
export async function updateSession(
  id: number,
  patch: { durationMin?: number; entries?: SessionEntry[]; media?: MediaLog | null; photos?: string[]; notes?: string }
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.durationMin !== undefined) update.durationMin = Math.max(0, Math.round(patch.durationMin));
  if (patch.entries !== undefined) {
    update.entries = patch.entries
      .map((e) => ({
        threadId: e.threadId,
        stitches: Math.max(0, Math.round(e.stitches)),
        spoolsUsed: Math.max(0, Math.round(e.spoolsUsed ?? 0)),
      }))
      .filter((e) => e.stitches > 0 || e.spoolsUsed > 0);
  }
  if (patch.media !== undefined) update.media = patch.media ?? undefined;
  if (patch.photos !== undefined) update.photos = patch.photos;
  if (patch.notes !== undefined) update.notes = patch.notes;
  await db.sessions.update(id, update);
  const s = await db.sessions.get(id);
  if (s) await db.projects.update(s.projectId, { updatedAt: localISO() });
}

/**
 * Fotos del proceso (decisión #12): se guardan redimensionadas dentro del
 * proyecto, y como el export vuelca los proyectos completos, viajan en la
 * copia de seguridad JSON.
 */
export async function addProjectPhoto(projectId: number, dataUrl: string): Promise<void> {
  const p = await db.projects.get(projectId);
  if (!p) return;
  await db.projects.update(projectId, {
    photos: [...(p.photos ?? []), dataUrl],
    updatedAt: localISO(),
  });
}

export async function removeProjectPhoto(projectId: number, index: number): Promise<void> {
  const p = await db.projects.get(projectId);
  if (!p) return;
  const photos = (p.photos ?? []).filter((_, i) => i !== index);
  await db.projects.update(projectId, { photos, updatedAt: localISO() });
}

/** Reinsertar una foto eliminada en su posición original (deshacer, A3). */
export async function insertProjectPhoto(projectId: number, dataUrl: string, index: number): Promise<void> {
  const p = await db.projects.get(projectId);
  if (!p) return;
  const photos = [...(p.photos ?? [])];
  photos.splice(index, 0, dataUrl);
  await db.projects.update(projectId, { photos, updatedAt: localISO() });
}

export async function getSessions(projectId: number): Promise<Session[]> {
  const sessions = await db.sessions.where({ projectId }).sortBy("date");
  return sessions.filter((s) => !s.deletedAt);
}

/** Biblioteca global de hilos. */
export async function listThreads(): Promise<Thread[]> {
  return db.threads.toArray();
}

export async function updateThread(id: number, patch: Partial<Thread>): Promise<void> {
  await db.threads.update(id, patch);
}

/** Editar datos del hilo dentro de un proyecto (puntadas previstas, orden...). */
export async function updateProjectThread(ptId: number, patch: Partial<ProjectThread>): Promise<void> {
  await db.projectThreads.update(ptId, patch);
  const pt = await db.projectThreads.get(ptId);
  if (pt) await db.projects.update(pt.projectId, { updatedAt: localISO() });
}

/** En un proyecto, un hilo puede ser un sustituto del color teórico del patrón. */
export async function setReplacement(ptId: number, plannedName: string | null, plannedDmc?: string): Promise<void> {
  const name = (plannedName ?? "").trim();
  await db.projectThreads.update(ptId, {
    isReplacement: name !== "",
    plannedName: name,
    plannedDmc: (plannedDmc ?? "").trim() || undefined,
  });
}

/**
 * Cambiar el hilo REAL de un color del proyecto (por ejemplo, el que Flosscross
 * sugería por uno que ya tenemos en la biblioteca). Conserva la identidad
 * sugerida (nombre, DMC) y las puntadas previstas.
 */
export async function swapProjectThread(ptId: number, threadId: number): Promise<void> {
  const pt = await db.projectThreads.get(ptId);
  if (!pt || pt.threadId === threadId) return;
  const newThread = await db.threads.get(threadId);
  // Si el hilo elegido no coincide con el que sugería el patrón, se marca
  // automáticamente como sustituto ("reemplaza a…").
  const differs =
    newThread &&
    (newThread.name.trim().toLowerCase() !== (pt.plannedName || "").trim().toLowerCase() ||
      (newThread.dmc || "").trim() !== (pt.plannedDmc || "").trim());
  await db.projectThreads.update(ptId, { threadId, isReplacement: differs });

  // Las puntadas ya bordadas quedan registradas contra el hilo antiguo;
  // se traspasan al nuevo para no perder el progreso si el cambio se hace
  // a mitad de proyecto.
  const sessions = (await db.sessions.where({ projectId: pt.projectId }).toArray()).filter((s) => !s.deletedAt);
  for (const s of sessions) {
    if (!s.entries.some((e) => e.threadId === pt.threadId)) continue;
    const merged: SessionEntry[] = [];
    for (const e of s.entries) {
      const tid = e.threadId === pt.threadId ? threadId : e.threadId;
      const dup = merged.find((m) => m.threadId === tid);
      if (dup) {
        dup.stitches += e.stitches;
        dup.spoolsUsed = (dup.spoolsUsed ?? 0) + (e.spoolsUsed ?? 0);
      } else merged.push({ threadId: tid, stitches: e.stitches, spoolsUsed: e.spoolsUsed });
    }
    await db.sessions.update(s.id!, { entries: merged });
  }
  await db.projects.update(pt.projectId, { updatedAt: localISO() });
}

/** Carretes que usan cada hilo (para la pantalla de biblioteca). */
export async function threadUsage(): Promise<Record<number, string[]>> {
  const pts = await db.projectThreads.toArray();
  const projects = await listProjects();
  const names = new Map<number, string>(projects.map((p) => [p.id!, p.name]));
  const usage: Record<number, string[]> = {};
  for (const pt of pts) {
    const name = names.get(pt.projectId);
    if (name) (usage[pt.threadId] ??= []).push(name);
  }
  return usage;
}
