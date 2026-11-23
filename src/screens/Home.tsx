import { useEffect, useState } from "react";
import type { AppSettings, Project, Session } from "../types";
import { listProjects, liveSessions, getSettings, setSettings } from "../util/repo";
import { Heatmap } from "../components/Heatmap";
import {
  episodesThisMonth,
  freezeLeft,
  localDay,
  minutesThisMonth,
  projectStitchesDone,
  streakInfo,
} from "../util/progress";

export function Home({
  onOpenProject,
  onNewProject,
  refreshKey = 0,
}: {
  onOpenProject: (id: number) => void;
  onNewProject: () => void;
  /** Cambia cuando se deshace un borrado (A3) para volver a leer la base. */
  refreshKey?: number;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [settings, setShown] = useState<AppSettings | undefined>();
  const [msg, setMsg] = useState("");
  const [query, setQuery] = useState("");

  async function refresh() {
    setProjects(await listProjects());
    setSessions(await liveSessions());
    setShown(await getSettings());
  }
  useEffect(() => {
    refresh();
  }, [refreshKey]);

  const active = projects.filter((p) => p.status === "activo");
  const hero = active[0];
  const others = active.slice(1);
  const finished = projects.filter((p) => p.status === "terminado");
  const q = query.trim().toLowerCase();
  const results = q ? projects.filter((p) => p.name.toLowerCase().includes(q)) : [];

  /** Miniatura de proyecto (usada en "activos", "terminados" y resultados). */
  function mini(p: Project, finished = false) {
    const done = projectStitchesDone(sessions, p.id!);
    const pct = Math.round((done / Math.max(1, p.totalStitches)) * 100);
    // Miniatura de terminados: foto del proceso, foto del patrón, o la última
    // foto de alguna sesión del proyecto.
    const lastSessionPhoto = sessions
      .filter((s) => s.projectId === p.id && s.photos?.length)
      .sort((a, b) => b.date.localeCompare(a.date))[0]?.photos?.[0];
    const thumb = finished ? p.photos?.[0] ?? p.image ?? lastSessionPhoto : null;
    return (
      <button class="mini" key={p.id} onClick={() => onOpenProject(p.id!)} title={p.name}>
        {thumb ? (
          <span class="mini-thumb"><img src={thumb} alt={p.name} /></span>
        ) : (
          <span class="mini-name">{p.name}</span>
        )}
        <span class="mini-num">{done} / {p.totalStitches}</span>
        <div class="progress"><div class="progress-fill" style={{ width: `${pct}%` }} /></div>
      </button>
    );
  }

  // Serie más vista este mes (para el widget).
  const seriesCount = new Map<string, number>();
  for (const s of sessions) {
    if (s.media?.type === "serie" && s.date.slice(0, 7) === localDay(new Date())) {
      const title = s.media.title || "Serie";
      seriesCount.set(title, (seriesCount.get(title) ?? 0) + (s.media.episodes ?? 0));
    }
  }
  const topSeries = [...seriesCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  // A4: aviso si la copia de seguridad no existe o es de hace más de 14 días.
  const daysSince = settings?.lastBackupAt
    ? Math.floor((Date.now() - Date.parse(settings.lastBackupAt)) / 86400000)
    : 0;
  const backupStale = !settings?.lastBackupAt || daysSince > 14;

  // C2: días de descanso por semana (0 = comportamiento clásico).
  const freezeDays = settings?.freezeDays ?? 1;
  const racha = streakInfo(sessions, new Date(), freezeDays);
  const freezesLeft = freezeLeft(sessions, freezeDays, new Date());

  // B2: calendario de racha (Heat.js, tres meses naturales).
  const metric = settings?.heatMetric ?? "puntadas";

  if (projects.length === 0) {
    return (
      <section class="screen">
        <h1>Bordes</h1>
        <p class="empty">
          Aún no hay proyectos. Crea el primero: nombre, foto del patrón, puntadas
          totales y colores. Después registra tus sesiones y el progreso se calcula solo.
        </p>
        <button class="btn" onClick={onNewProject}>+ Nuevo proyecto</button>
      </section>
    );
  }

  return (
    <section class="screen">
      <h1>Bordes</h1>

      <div class="search">
        <input
          id="project-search"
          type="search"
          placeholder="Buscar proyectos…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar proyectos"
        />
      </div>

      {q ? (
        results.length > 0 ? (
          <>
            <h3>{results.length} resultado(s) para “{query.trim()}”</h3>
            <div class="minis">{results.map(mini)}</div>
          </>
        ) : (
          <p class="empty">Ningún proyecto contiene “{query.trim()}”.</p>
        )
      ) : (
        <>
          {hero && (
            <article class="hero-card" onClick={() => onOpenProject(hero.id!)}>
              <div class="hero-pattern" aria-hidden="true">
                {hero.image ? <img src={hero.image} alt="" /> : "▢"}
              </div>
              <div class="hero-info">
                <h2>{hero.name}</h2>
                <p>
                  {projectStitchesDone(sessions, hero.id!)} / {hero.totalStitches} puntadas ·{" "}
                  {Math.round((projectStitchesDone(sessions, hero.id!) / Math.max(1, hero.totalStitches)) * 100)}%
                </p>
                <div class="progress">
                  <div
                    class="progress-fill"
                    style={{ width: `${Math.round((projectStitchesDone(sessions, hero.id!) / Math.max(1, hero.totalStitches)) * 100)}%` }}
                  />
                </div>
              </div>
            </article>
          )}

          <div class="widgets">
            <div class="widget">
              <span class="widget-num">🔥 {racha.count}</span>
              <span class="widget-label">
                días de racha{racha.frozen.size > 0 ? ` · 🧊 ${racha.frozen.size} congelados` : ""}
              </span>
            </div>
            <div class="widget">
              <span class="widget-num">
                {Math.floor(minutesThisMonth(sessions) / 60)} h {minutesThisMonth(sessions) % 60} min
              </span>
              <span class="widget-label">bordado este mes</span>
            </div>
            <div class="widget">
              <span class="widget-num">{episodesThisMonth(sessions)}</span>
              <span class="widget-label">episodios este mes{topSeries ? ` · ${topSeries}` : ""}</span>
            </div>
          </div>

          <div class="calendar">
            <div class="calendar-head">
              <h2>Calendario de racha</h2>
              {freezeDays > 0 && (
                <span class="freeze-left" title={`Descansos semanales: puedes fallar ${freezeDays} día(s) sin romper la racha`}>
                  ❄ {freezesLeft} de {freezeDays} quedan esta semana
                </span>
              )}
              <label class="metric">
                color según
                <select
                  class="metric-select"
                  value={metric}
                  onChange={async (e) => {
                    await setSettings({ heatMetric: e.target.value as "puntadas" | "minutos" });
                    refresh();
                  }}
                  aria-label="Métrica de color del calendario"
                >
                  <option value="puntadas">puntadas</option>
                  <option value="minutos">minutos</option>
                </select>
              </label>
            </div>
            <Heatmap sessions={sessions} metric={metric} freezeDays={freezeDays} />
            <div class="heat-legend">
              <span class="swatch sw-1" aria-hidden="true"></span>
              <span class="swatch sw-2" aria-hidden="true"></span>
              <span class="swatch sw-3" aria-hidden="true"></span>
              <span class="swatch sw-4" aria-hidden="true"></span>
              <span>de menos a más {metric}</span>
              <span class="swatch sw-empty" aria-hidden="true">✗</span> sin sesión
              <span class="swatch sw-frozen" aria-hidden="true">❄</span> día congelado
            </div>
          </div>

          {others.length > 0 && (
            <>
              <h3>Proyectos activos</h3>
              <div class="minis">{others.map(mini)}</div>
            </>
          )}

          {finished.length > 0 && (
            <>
              <h3>Terminados</h3>
              <div class="minis">{finished.map((p) => mini(p, true))}</div>
            </>
          )}
        </>
      )}

      <div class="backup">
        <button class="btn ghost" onClick={onNewProject}>+ Nuevo proyecto</button>
      </div>
      {backupStale && (
        <p class="backup-reminder">
          {settings?.lastBackupAt
            ? `La última copia de seguridad es de hace ${daysSince} días: exporta otra desde Configuración para no perder datos.`
            : "Todavía no has exportado ninguna copia de seguridad. Descarga una desde Configuración de vez en cuando: los datos solo viven en este navegador."}
        </p>
      )}
      {msg && <p class="msg">{msg}</p>}
    </section>
  );
}
