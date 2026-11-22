import type { MediaType, Session } from "../types";

/**
 * Una serie/película/YouTube ya apuntada en alguna sesión.
 * Se usa para autocompletar el nombre cuando se vuelve a ver la misma.
 */
export interface MediaSuggestion {
  type: MediaType;
  title: string;
  count: number;
  lastDate: string; // ISO de la sesión más reciente
  lastEpisodes?: number; // episodios vistos la última vez
}

/**
 * Historial de media, sin duplicados (la comparación ignora mayúsculas).
 * Orden: la más reciente primero.
 */
export function mediaSuggestions(sessions: Session[]): MediaSuggestion[] {
  const map = new Map<string, MediaSuggestion>();
  for (const s of sessions) {
    const m = s.media;
    if (!m?.title) continue;
    const title = m.title.trim();
    if (!title) continue;
    const key = `${m.type}|${title.toLowerCase()}`;
    const prev = map.get(key);
    if (prev) {
      prev.count += 1;
      if (s.date >= prev.lastDate) {
        prev.lastDate = s.date;
        prev.lastEpisodes = m.episodes;
      }
    } else {
      map.set(key, { type: m.type, title, count: 1, lastDate: s.date, lastEpisodes: m.episodes });
    }
  }
  return [...map.values()].sort(
    (a, b) => b.lastDate.localeCompare(a.lastDate) || a.title.localeCompare(b.title),
  );
}

/** Títulos ya vistos del tipo indicado (para el `<datalist>`). */
export function titlesFor(suggestions: MediaSuggestion[], type: MediaType): string[] {
  return suggestions.filter((s) => s.type === type).map((s) => s.title);
}

/** Busca un título exacto (ignorando mayúsculas) dentro de un tipo. */
export function findMedia(
  suggestions: MediaSuggestion[],
  type: MediaType,
  title: string,
): MediaSuggestion | undefined {
  const t = title.trim().toLowerCase();
  if (!t) return undefined;
  return suggestions.find((s) => s.type === type && s.title.toLowerCase() === t);
}
