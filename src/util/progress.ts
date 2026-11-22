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

/** Bobinas gastadas en una sesión (suma de entradas por color). */
export function sessionSpools(session: Session): number {
  return session.entries.reduce((sum, e) => sum + (e.spoolsUsed ?? 0), 0);
}

/** Bobinas gastadas de un hilo, derivadas de todas las sesiones pasadas. */
export function threadSpoolsUsed(sessions: Session[], threadId: number): number {
  return sessions.reduce(
    (sum, s) =>
      sum + s.entries.filter((e) => e.threadId === threadId).reduce((a, e) => a + (e.spoolsUsed ?? 0), 0),
    0
  );
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

/** ¿Está completado un hilo del proyecto? Un color sin puntadas previstas no cuenta. */
export function isThreadComplete(
  sessions: Session[],
  pt: ProjectThread
): boolean {
  return pt.totalStitches > 0 && threadProgress(sessions, pt.threadId) >= pt.totalStitches;
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

/** Puntadas dadas por día local (para el calendario de racha). */
export function stitchesByDay(sessions: Session[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of sessions) {
    const key = s.date.slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + sessionStitches(s));
  }
  return map;
}

/**
 * B2: calendario de las últimas `weeks` semanas alineadas en lunes.
 * grid[0] es la semana actual; cada celda { date, stitches }.
 */
export function heatmap(
  sessions: Session[],
  weeks = 8,
  today = new Date()
): { date: string; stitches: number }[][] {
  const byDay = stitchesByDay(sessions);
  const monday = new Date(today);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7)); // lunes de esta semana
  const grid: { date: string; stitches: number }[][] = [];
  for (let w = 0; w < weeks; w++) {
    const row: { date: string; stitches: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(monday);
      day.setDate(day.getDate() - w * 7 + d);
      const date = localDay(day);
      row.push({ date, stitches: byDay.get(date) ?? 0 });
    }
    grid.push(row);
  }
  return grid;
}
