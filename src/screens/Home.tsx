import { useEffect, useState } from "react";
import { db } from "../db";
import type { Project, Session } from "../types";
import { listProjects } from "../util/repo";
import {
  episodesThisMonth,
  localDay,
  minutesThisMonth,
  projectStitchesDone,
  streak,
} from "../util/progress";
import { buildBackup, restoreBackup } from "../util/export";

export function Home({
  onOpenProject,
  onNewProject,
}: {
  onOpenProject: (id: number) => void;
  onNewProject: () => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [msg, setMsg] = useState("");
  const [query, setQuery] = useState("");

  async function refresh() {
    setProjects(await listProjects());
    setSessions(await db.sessions.toArray());
  }
  useEffect(() => {
    refresh();
  }, []);

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

  async function exportJson() {
    const backup = await buildBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bordes-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
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
              <span class="widget-num">🔥 {streak(sessions)}</span>
              <span class="widget-label">días de racha</span>
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
      {msg && <p class="msg">{msg}</p>}
    </section>
  );
}
