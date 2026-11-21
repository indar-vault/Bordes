import type { Project, Session } from "../types";
import type { ThreadView } from "./repo";
import { sessionStitches } from "./progress";

/**
 * Cifras del resumen final de un proyecto. Todo se deriva de las sesiones
 * (decisión #3): aquí solo se agregan, nunca se almacenan.
 */
export interface SummaryData {
  sessions: number;
  totalMinutes: number;
  avgMinutes: number;
  firstDate?: string; // "AAAA-MM-DD" local
  lastDate?: string;
  days: number; // días distintos con alguna sesión
  stitchesDone: number;
  plannedStitches: number; // suma de las puntadas previstas por color
  totalStitches: number; // total del proyecto (la rejilla)
  pct: number;
  colors: number;
  colorsDone: number;
  spools: number; // bobinas de la biblioteca para los hilos de este proyecto
  episodes: number;
  movies: number;
  youtube: number;
}

export function computeSummary(project: Project, sessions: Session[], threads: ThreadView[]): SummaryData {
  const totalMinutes = sessions.reduce((sum, s) => sum + s.durationMin, 0);
  const days = new Set(sessions.map((s) => s.date.slice(0, 10)));
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));

  const plannedStitches = threads.reduce((sum, t) => sum + t.pt.totalStitches, 0);
  const stitchesDone = sessions.reduce((sum, s) => sum + sessionStitches(s), 0);

  let episodes = 0;
  let movies = 0;
  let youtube = 0;
  for (const s of sessions) {
    if (!s.media) continue;
    if (s.media.type === "serie") episodes += s.media.episodes ?? 0;
    else if (s.media.type === "peli") movies += 1;
    else youtube += 1;
  }

  return {
    sessions: sessions.length,
    totalMinutes,
    avgMinutes: sessions.length ? Math.round(totalMinutes / sessions.length) : 0,
    firstDate: sorted[0]?.date.slice(0, 10),
    lastDate: sorted[sorted.length - 1]?.date.slice(0, 10),
    days: days.size,
    stitchesDone,
    plannedStitches,
    totalStitches: project.totalStitches,
    pct: Math.min(100, Math.round((stitchesDone / Math.max(1, project.totalStitches)) * 100)),
    colors: threads.length,
    colorsDone: threads.filter((t) => t.complete).length,
    spools: threads.reduce((sum, t) => sum + (t.thread.spools ?? 0), 0),
    episodes,
    movies,
    youtube,
  };
}

/** "95 min" → "1 h 35 min"; menos de una hora, solo minutos. */
export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
