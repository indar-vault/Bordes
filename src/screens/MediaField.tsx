import type { MediaType } from "../types";
import { findMedia, titlesFor, type MediaSuggestion } from "../util/media";

/**
 * Campo de media (D1). El nombre se autocompleta con lo que ya se ha visto
 * en otras sesiones, y si la serie está repetida recuerda cuántos episodios
 * se vieron la última vez.
 */
export function MediaField({
  history,
  type,
  title,
  episodes,
  setType,
  setTitle,
  setEpisodes,
  datalistId,
  label = "¿Qué has visto mientras bordabas?",
}: {
  history: MediaSuggestion[];
  type: MediaType | "";
  title: string;
  episodes: number;
  setType: (t: MediaType | "") => void;
  setTitle: (t: string) => void;
  setEpisodes: (n: number) => void;
  datalistId: string;
  label?: string;
}) {
  const known = findMedia(history, type, title);
  const titles = titlesFor(history, type);

  return (
    <div class="media">
      <label>
        {label}
        <select value={type} onChange={(e) => setType(e.target.value as MediaType | "")}>
          <option value="">—</option>
          <option value="youtube">YouTube</option>
          <option value="peli">Película</option>
          <option value="serie">Serie</option>
        </select>
      </label>
      {type && (
        <>
          <input
            type="text"
            list={datalistId}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nombre"
          />
          {type === "serie" && (
            <label class="eps">
              <span>Episodios vistos</span>
              <input
                type="number"
                value={episodes}
                onChange={(e) => setEpisodes(Number(e.target.value))}
                min={0}
                placeholder={known?.lastEpisodes ? `última: ${known.lastEpisodes}` : "0"}
                style={{ width: 110 }}
              />
            </label>
          )}
          {known ? (
            <span class="media-hint">
              vista {known.count} {known.count === 1 ? "vez" : "veces"}
              {type === "serie" && known.lastEpisodes ? ` (última vez: ${known.lastEpisodes} eps)` : ""} ·
              última el {known.lastDate.slice(0, 10)}
            </span>
          ) : titles.length > 0 ? (
            <span class="media-hint">
              ya viste {titles.slice(0, 3).join(", ")}
              {titles.length > 3 ? "…" : ""}
            </span>
          ) : null}
        </>
      )}
      <datalist id={datalistId}>
        {titles.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </div>
  );
}
