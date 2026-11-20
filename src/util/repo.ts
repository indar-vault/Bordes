import { db } from "../db";
import type { MediaLog, Project, ProjectThread, Session, SessionEntry, Thread } from "../types";
import { threadProgress } from "./progress";

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
  spools: number;
  totalStitches: number;
}

export interface NewProjectInput {
  name: string;
  image?: string;
  totalStitches: number;
  giftTo?: string;
  notes?: string;
  colors: NewColorInput[];
}

export async function createProject(input: NewProjectInput): Promise<number> {
  const now = localISO();
  const projectId = await db.projects.add({
    name: input.name.trim(),
    image: input.image,
    totalStitches: input.totalStitches,
    status: "activo",
    giftTo: input.giftTo?.trim() || undefined,
    notes: input.notes?.trim() ?? "",
    createdAt: now,
    updatedAt: now,
  });

  let order = 0;
  for (const c of input.colors) {
    if (!c.name.trim() && !c.color) continue;
    const threadId = await db.threads.add({
      color: c.color || "#000000",
      name: c.name.trim() || "Color sin nombre",
      dmc: c.dmc?.trim() || undefined,
      spools: c.spools,
    });
    await db.projectThreads.add({
      projectId,
      threadId,
      plannedName: c.name.trim(),
      isReplacement: false,
      totalStitches: c.totalStitches,
      order: order++,
    });
  }
  return projectId;
}

export async function listProjects(): Promise<Project[]> {
  return db.projects.orderBy("updatedAt").reverse().toArray();
}

export async function getProject(id: number): Promise<Project | undefined> {
  return db.projects.get(id);
}

export async function updateProject(id: number, patch: Partial<Project>): Promise<void> {
  await db.projects.update(id, { ...patch, updatedAt: localISO() });
}

export async function deleteProject(id: number): Promise<void> {
  await db.sessions.where({ projectId: id }).delete();
  await db.projectThreads.where({ projectId: id }).delete();
  await db.projects.delete(id);
}

/** Hilo tal como participa en un proyecto, con su progreso derivado. */
export interface ThreadView {
  pt: ProjectThread;
  thread: Thread;
  done: number;
  complete: boolean;
}

export async function getProjectThreads(projectId: number): Promise<ThreadView[]> {
  const pts = await db.projectThreads.where({ projectId }).sortBy("order");
  const sessions = await db.sessions.where({ projectId }).toArray();
  const views: ThreadView[] = [];
  for (const pt of pts) {
    const thread = await db.threads.get(pt.threadId);
    if (!thread) continue;
    const done = threadProgress(sessions, pt.threadId);
    views.push({ pt, thread, done, complete: done >= pt.totalStitches });
  }
  // Los completados bajan al final (menor prioridad), como pide el ticket.
  return views.sort((a, b) => Number(a.complete) - Number(b.complete) || a.pt.order - b.pt.order);
}

export async function addColorToProject(projectId: number, input: NewColorInput): Promise<number> {
  const pts = await db.projectThreads.where({ projectId }).toArray();
  const order = pts.length;
  const threadId = await db.threads.add({
    color: input.color || "#000000",
    name: input.name.trim() || "Color sin nombre",
    dmc: input.dmc?.trim() || undefined,
    spools: input.spools,
  });
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
    entries: input.entries.filter((e) => e.stitches > 0),
    media: input.media && (input.media.type || input.media.title) ? input.media : undefined,
  };
  await db.sessions.add(session);
  await db.projects.update(input.projectId, { updatedAt: localISO() });
  return session;
}

export async function deleteSession(id: number): Promise<void> {
  await db.sessions.delete(id);
}

export async function getSessions(projectId: number): Promise<Session[]> {
  return db.sessions.where({ projectId }).sortBy("date");
}
