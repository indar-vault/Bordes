import { useEffect, useState } from "react";
import type { AppSettings, Project, Session } from "../types";
import { listProjects, liveSessions, getSettings, markBackup, setSettings } from "../util/repo";
import {
  episodesThisMonth,
  heatmap,
  localDay,
  minutesThisMonth,
  projectStitchesDone,
  streak,
} from "../util/progress";
import { buildBackup, restoreBackup } from "../util/export";

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
  const [settings, setSettings] = useState<AppSettings | undefined>();
  const [msg, setMsg] = useState("");
  const [query, setQuery] = useState("");

  async function refresh() {
    setProjects(await listProjects());
    setSessions(await liveSessions());
    setSettings(await getSettings());
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
  function mini(p: Project) {
    const done = projectStitchesDone(sessions, p.id!);
    const pct = Math.round((done / Math.max(1, p.totalStitches)) * 100);
    return (
      <button class="mini" key={p.id} onClick={() => onOpenProject(p.id!)}>
        <span class="mini-name">{p.name}</span>
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
  const freezeDays = settings?.freezeDays ?? 0;

  // B2: calendario de racha de las últimas 8 semanas.
  const heat = heatmap(sessions, 8);

  async function exportJson() {
    const backup = await buildBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bordes-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    await markBackup();
    setSettings(await getSettings());
    setMsg("Copia de seguridad descargada.");
  }

  async function importJson(file: File) {
    try {
      const text = await file.text();
      const data = await restoreBackup(text);
      await refresh();
      setMsg(`Copia restaurada: ${data.projects.length} proyecto(s), ${data.sessions.length} sesión(es).`);
    } catch (err) {
      setMsg(`No se pudo restaurar: ${(err as Error).message}`);
    }
  }

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
              <span class="widget-num">🔥 {streak(sessions, new Date(), freezeDays)}</span>
              <span class="widget-label">días de racha</span>
            </div>
            <div class="widget freeze-widget">
              <label class="freeze-label">
                🧊
                <select class="freeze-select" value={freezeDays} onChange={async (e) => { await setSettings({ freezeDays: Number(e.target.value) }); refresh(); }} aria-label="Días de descanso por semana">
                  <option value="0">0 descansos</option>
                  <option value="1">1 descanso</option>
                  <option value="2">2 descansos</option>
                </select>
              </label>
              <span class="widget-label">por semana</span>
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

          <div class="heatmap" aria-label="Calendario de las últimas 8 semanas">
            {heat.map((week, wi) => (
              <div class="heat-row" key={wi}>
                {week.map((cell) => (
                  <span
                    class={`heat ${cell.stitches >= 200 ? "heat-3" : cell.stitches >= 80 ? "heat-2" : cell.stitches > 0 ? "heat-1" : ""}`}
                    title={`${cell.date}: ${cell.stitches} puntadas`}
                  />
                ))}
              </div>
            ))}
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
              <div class="minis">{finished.map(mini)}</div>
            </>
          )}
        </>
      )}

      <div class="backup">
        <button class="btn ghost" onClick={onNewProject}>+ Nuevo proyecto</button>
        <button class="btn ghost" onClick={exportJson}>Exportar copia (JSON)</button>
        <label class="import">
          Importar copia
          <input type="file" accept="application/json" onChange={(e) => e.target.files && importJson(e.target.files[0])} />
        </label>
      </div>
      {backupStale && (
        <p class="backup-reminder">
          {settings?.lastBackupAt
            ? `La última copia de seguridad es de hace ${daysSince} días: exporta una para no perder datos.`
            : "Todavía no has exportado ninguna copia de seguridad. Descarga una de vez en cuando: los datos solo viven en este navegador."}
        </p>
      )}
      {msg && <p class="msg">{msg}</p>}
    </section>
  );
}
