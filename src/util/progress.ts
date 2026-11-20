import type { Session, ProjectThread } from "../types";

/** Puntadas dadas en una sesión (suma de entradas por color). */
export function sessionStitches(session: Session): number {
  return session.entries.reduce((sum, e) => sum + e.stitches, 0);
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

/**
 * Racha = días consecutivos (hasta hoy) con al menos una sesión.
 * Las sesiones de hoy cuentan; un día sin sesión la rompe.
 */
export function streak(sessions: Session[], today = new Date()): number {
  const days = new Set(sessions.map((s) => s.date.slice(0, 10)));
  let count = 0;
  const cursor = new Date(today);
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
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
  const prefix = today.toISOString().slice(0, 7);
  return sessions
    .filter((s) => s.date.slice(0, 7) === prefix)
    .reduce((sum, s) => sum + s.durationMin, 0);
}

/** Episodios vistos en el mes natural actual. */
export function episodesThisMonth(sessions: Session[], today = new Date()): number {
  const prefix = today.toISOString().slice(0, 7);
  return sessions
    .filter((s) => s.date.slice(0, 7) === prefix && s.media?.type === "serie")
    .reduce((sum, s) => sum + (s.media?.episodes ?? 0), 0);
}
