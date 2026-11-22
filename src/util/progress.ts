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
 * Las sesiones de hoy cuentan; un día sin sesión la rompe, salvo que queden
 * días de descanso: máximo `freezeDays` por semana ISO (lunes a domingo).
 */
function mondayOf(d: Date): string {
  const m = new Date(d);
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return localDay(m);
}
/**
 * Igual que `streak`, pero también devuelve qué días vacíos se "congelaron"
 * (los que el calendario marca con ❄).
 */
export function streakInfo(
  sessions: Session[],
  today = new Date(),
  freezeDays = 0
): { count: number; frozen: Set<string> } {
  const days = new Set(sessions.map((s) => s.date.slice(0, 10)));
  let count = 0;
  let used = 0;
  let week = mondayOf(today);
  const frozen = new Set<string>();
  const cursor = new Date(today);
  for (;;) {
    const key = localDay(cursor);
    const w = mondayOf(cursor);
    if (w !== week) {
      week = w;
      used = 0; // el presupuesto de congelación se renueva cada semana
    }
    if (days.has(key)) {
      count += 1;
    } else if (used < freezeDays) {
      used += 1; // día de descanso: no rompe la racha
      frozen.add(key);
    } else {
      break;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return { count, frozen };
}

export function streak(sessions: Session[], today = new Date(), freezeDays = 0): number {
  return streakInfo(sessions, today, freezeDays).count;
}

/**
 * Congelados que QUEDAN esta semana (lunes–domingo): el presupuesto semanal
 * menos los días ya transcurridos de la semana sin sesión. Al empezar una
 * semana nueva vuelve a estar completo.
 */
export function freezeLeft(sessions: Session[], freezeDays = 0, today = new Date()): number {
  const days = new Set(sessions.map((s) => s.date.slice(0, 10)));
  const monday = new Date(today);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const todayKey = localDay(today);
  let empty = 0;
  const cursor = new Date(monday);
  while (localDay(cursor) <= todayKey) {
    if (!days.has(localDay(cursor))) empty += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return Math.max(0, freezeDays - empty);
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

/** Minutos bordados por día local. */
export function minutesByDay(sessions: Session[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of sessions) {
    const key = s.date.slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + s.durationMin);
  }
  return map;
}

export interface HeatCell {
  date: string;
  stitches: number;
  minutes: number;
  /** Día sin sesión que la racha "congeló" (C2): el calendario lo pinta con ❄. */
  frozen: boolean;
}

/** Nivel de intensidad (0–4) de una celda según la métrica elegida. */
export function heatLevel(cell: HeatCell, metric: "puntadas" | "minutos"): number {
  if (metric === "minutos") {
    const v = cell.minutes;
    return v >= 90 ? 4 : v >= 45 ? 3 : v >= 20 ? 2 : v > 0 ? 1 : 0;
  }
  const v = cell.stitches;
  return v >= 300 ? 4 : v >= 150 ? 3 : v >= 50 ? 2 : v > 0 ? 1 : 0;
}

/**
 * B2: calendario de las últimas `weeks` semanas alineadas en lunes.
 * grid[0] es la semana actual; cada celda { date, stitches, minutes, frozen }.
 */
export function heatmap(
  sessions: Session[],
  weeks = 8,
  today = new Date(),
  freezeDays = 0
): HeatCell[] {
  const byStitches = stitchesByDay(sessions);
  const byMinutes = minutesByDay(sessions);
  const frozen = streakInfo(sessions, today, freezeDays).frozen;
  const monday = new Date(today);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7)); // lunes de esta semana
  const grid: HeatCell[] = [];
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const day = new Date(monday);
      day.setDate(day.getDate() - w * 7 + d);
      const date = localDay(day);
      grid.push({
        date,
        stitches: byStitches.get(date) ?? 0,
        minutes: byMinutes.get(date) ?? 0,
        frozen: frozen.has(date),
      });
    }
  }
  return grid;
}
