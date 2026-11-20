import type { Session, ProjectThread } from "../types";

/** Puntadas dadas en una sesión (suma de entradas por color). */
export function sessionStitches(session: Session): number {
  return session.entries.reduce((sum, e) => sum + e.stitches, 0);
}

/** Puntadas dadas de un proyecto, derivadas de todas sus sesiones. */
export function projectStitchesDone(sessions: Session[], projectId: number): number {
  return sessions
    .filter((s) => s.projectId === projectId)
    .reduce((sum, s) => sum + sessionStitches(s), 0);
}

/** Sesiones agrupadas por día, más reciente primero. */
export function sessionsByDate(sessions: Session[]): { date: string; sessions: Session[] }[] {
  const map = new Map<string, Session[]>();
  for (const s of sessions) {
    const key = s.date.slice(0, 10);
    const list = map.get(key);
    if (list) list.push(s);
    else map.set(key, [s]);
  }
  return [...map.entries()]
    .map(([date, list]) => ({ date, sessions: list }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Puntadas dadas de un color, derivadas de todas las sesiones del proyecto. */
export function threadProgress(sessions: Session[], threadId: number): number {
  return sessions.reduce(
    (sum, s) => sum + (s.entries.find((e) => e.threadId === threadId)?.stitches ?? 0),
    0
  );
}

/** ¿Está completado un hilo del proyecto? */
export function isThreadComplete(
  sessions: Session[],
  pt: ProjectThread
): boolean {
  return threadProgress(sessions, pt.threadId) >= pt.totalStitches;
}

/** Día local de una fecha, en "AAAA-MM-DD" (la racha se cuenta en hora local). */
export function localDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Racha = días consecutivos (hasta hoy) con al menos una sesión.
 * Las sesiones de hoy cuentan; un día sin sesión la rompe.
 */
export function streak(sessions: Session[], today = new Date()): number {
  const days = new Set(sessions.map((s) => s.date.slice(0, 10)));
  let count = 0;
  const cursor = new Date(today);
  for (;;) {
    const key = localDay(cursor);
    if (days.has(key)) {
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return count;
}

/** Minutos bordados en el mes natural actual. */
export function minutesThisMonth(sessions: Session[], today = new Date()): number {
  const prefix = localDay(today).slice(0, 7);
  return sessions
    .filter((s) => s.date.slice(0, 7) === prefix)
    .reduce((sum, s) => sum + s.durationMin, 0);
}

/** Episodios vistos en el mes natural actual. */
export function episodesThisMonth(sessions: Session[], today = new Date()): number {
  const prefix = localDay(today).slice(0, 7);
  return sessions
    .filter((s) => s.date.slice(0, 7) === prefix && s.media?.type === "serie")
    .reduce((sum, s) => sum + (s.media?.episodes ?? 0), 0);
}
