import type { Project, Session } from "../types";
import type { ThreadView } from "./repo";
import { sessionSpools, sessionStitches } from "./progress";

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
  spoolsUsed: number; // bobinas gastadas, derivadas de las sesiones
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
  const spoolsUsed = sessions.reduce((sum, s) => sum + sessionSpools(s), 0);

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
    spoolsUsed,
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

/**
 * CSV de sesiones (A2): una fila por sesión con fecha, minutos, puntadas,
 * bobinas gastadas, media vista y detalle por hilo. Escapa comillas y comas
 * según el estándar RFC 4180.
 */
export function buildSessionsCsv(project: Project, sessions: Session[], threads: ThreadView[]): string {
  const nameOf = new Map<number, string>();
  for (const t of threads) {
    nameOf.set(t.thread.id!, `${t.thread.name}${t.thread.dmc ? ` (DMC ${t.thread.dmc})` : ""}`);
  }
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows: (string | number)[][] = [["fecha", "minutos", "puntadas", "bobinas", "media", "hilos"]];
  for (const s of [...sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    const hilos = s.entries
      .map((e) => {
        const name = nameOf.get(e.threadId) ?? `hilo ${e.threadId}`;
        return `${name}: ${e.stitches}${e.spoolsUsed ? ` (−${e.spoolsUsed} bobina${e.spoolsUsed > 1 ? "s" : ""})` : ""}`;
      })
      .join("; ");
    const media = s.media
      ? `${s.media.type}${s.media.title ? `: ${s.media.title}` : ""}${s.media.episodes ? ` (${s.media.episodes} ep.)` : ""}`
      : "";
    rows.push([s.date.slice(0, 10), s.durationMin, sessionStitches(s), sessionSpools(s), media, hilos]);
  }
  return rows.map((r) => r.map(esc).join(",")).join("\n");
}

/** Nombre de archivo seguro para el CSV (minúsculas, sin espacios). */
export function csvFileName(project: Project): string {
  const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "proyecto";
  return `bordes-sesiones-${slug}.csv`;
}
