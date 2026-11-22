import { useEffect, useState } from "react";
import type { Project, Session } from "../types";
import { getProject, getProjectThreads, getSessions, type ThreadView } from "../util/repo";
import { computeSummary, formatMinutes } from "../util/summary";

/**
 * Resumen final de un proyecto: tiempo, sesiones, puntadas, colores y episodios.
 * Todas las cifras se derivan de las sesiones registradas (decisión #3).
 */
export function Summary({
  projectId,
  onBack,
}: {
  projectId: number;
  onBack: () => void;
}) {
  const [project, setProject] = useState<Project | undefined>();
  const [threads, setThreads] = useState<ThreadView[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    (async () => {
      setProject(await getProject(projectId));
      setThreads(await getProjectThreads(projectId));
      setSessions(await getSessions(projectId));
    })();
  }, [projectId]);

  const s = computeSummary(project ?? { totalStitches: 0 } as Project, sessions, threads);

  return (
    <section class="screen">
      <div class="project-head">
        <div class="cover" aria-hidden="true">
          {project?.image ? <img src={project.image} alt="" /> : "▢"}
        </div>
        <div>
          <h1>Resumen de {project?.name ?? "Proyecto"}</h1>
          <p class="hint">
            {project?.status === "terminado" ? "Terminado" : "En marcha"}
            {s.firstDate ? ` · del ${s.firstDate} al ${s.lastDate}` : ""}
            {project?.giftTo ? ` · para regalar a ${project.giftTo}` : ""}
          </p>
          <div class="row">
            <button class="btn ghost" onClick={onBack}>← Volver al proyecto</button>
          </div>
        </div>
      </div>

      <div class="widgets">
        <div class="widget">
          <span class="widget-num">{formatMinutes(s.totalMinutes)}</span>
          <span class="widget-label">bordado en total</span>
        </div>
        <div class="widget">
          <span class="widget-num">{s.sessions}</span>
          <span class="widget-label">{s.sessions === 1 ? "sesión" : "sesiones"} ({s.days} {s.days === 1 ? "día" : "días"}) · media {formatMinutes(s.avgMinutes)}</span>
        </div>
        <div class="widget">
          <span class="widget-num">{s.stitchesDone} / {s.totalStitches}</span>
          <span class="widget-label">puntadas de la rejilla ({s.pct}%)</span>
        </div>
        <div class="widget">
          <span class="widget-num">{s.colorsDone} / {s.colors}</span>
          <span class="widget-label">colores completados · {s.spoolsUsed > 0 ? `${s.spoolsUsed} ${s.spoolsUsed === 1 ? "bobina gastada" : "bobinas gastadas"}` : `${s.spools} ${s.spools === 1 ? "bobina" : "bobinas"}`}</span>
        </div>
      </div>

      {s.episodes + s.movies + s.youtube > 0 && (
        <p class="hint">
          Mientras bordabas: {s.episodes} episodios, {s.movies} películas, {s.youtube} sesiones de YouTube.
        </p>
      )}

      <h2>Colores</h2>
      {threads.length === 0 && <p class="empty">Este proyecto todavía no tiene colores.</p>}
      <table class="colors">
        <thead>
          <tr>
            <th class="col-hex"></th>
            <th class="col-name">Color</th>
            <th class="col-dmc">DMC</th>
            <th class="col-total">Previstas</th>
            <th class="col-total">Bordadas</th>
            <th class="col-spools">Bobinas</th>
            <th class="col-spools">Gastadas</th>
          </tr>
        </thead>
        <tbody>
          {threads.map((t) => (
            <tr key={t.pt.id} style={{ "--c": t.thread.color } as React.CSSProperties}>
              <td class="col-hex"><span class="spool" aria-hidden="true">●</span></td>
              <td class="col-name">{t.thread.name}</td>
              <td class="col-dmc">{t.thread.dmc || "—"}</td>
              <td class="col-total">{t.pt.totalStitches}</td>
              <td class="col-total">{t.done}</td>
              <td class="col-spools">{t.thread.spools}</td>
              <td class="col-spools">{t.spoolsUsed}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {s.sessions === 0 && (
        <p class="empty">Aún no hay sesiones: el resumen se llena cuando registres la primera.</p>
      )}
    </section>
  );
}
