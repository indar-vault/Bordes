import { useEffect, useRef, useState } from "react";
import type { Project, MediaType } from "../types";
import { getProject, getProjectThreads, saveSession, mediaHistory as loadMediaHistory, type ThreadView } from "../util/repo";
import type { MediaSuggestion } from "../util/media";
import { MediaField } from "./MediaField";

export function Session({
  projectId,
  onDone,
}: {
  projectId: number;
  onDone: () => void;
}) {
  const [project, setProject] = useState<Project | undefined>();
  const [threads, setThreads] = useState<ThreadView[]>([]);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [manualMin, setManualMin] = useState(0);
  const [stitches, setStitches] = useState<Record<number, number>>({});
  const [spoolsUsed, setSpoolsUsed] = useState<Record<number, number>>({});
  const [mediaType, setMediaType] = useState<MediaType | "">("");
  const [mediaTitle, setMediaTitle] = useState("");
  const [episodes, setEpisodes] = useState(0);
  const [saved, setSaved] = useState(false);
  const [mediaHistory, setMediaHistory] = useState<MediaSuggestion[]>([]);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    getProject(projectId).then(setProject);
    getProjectThreads(projectId).then(setThreads);
    loadMediaHistory().then(setMediaHistory);
    return () => clearInterval(timer.current);
  }, [projectId]);

  function start() {
    setRunning(true);
    setElapsed(0);
    timer.current = window.setInterval(() => setElapsed((e) => e + 1), 1000);
  }
  function stop() {
    setRunning(false);
    clearInterval(timer.current);
  }

  const totalStitches = Object.values(stitches).reduce((a, b) => a + b, 0);
  const durationMin = running || elapsed > 0 ? Math.max(1, Math.round(elapsed / 60)) : manualMin;

  async function save() {
    await saveSession({
      projectId,
      durationMin,
      entries: threads
        .filter((t) => t.pt.threadId)
        .map((t) => ({
          threadId: t.pt.threadId,
          stitches: stitches[t.pt.threadId] ?? 0,
          spoolsUsed: spoolsUsed[t.pt.threadId] ?? 0,
        })),
      media: mediaType ? { type: mediaType, title: mediaTitle || undefined, episodes: episodes || undefined } : undefined,
    });
    setSaved(true);
    onDone();
  }

  return (
    <section class="screen">
      <h1>Sesión — {project?.name ?? ""}</h1>

      <div class="timer">
        {running ? (
          <>
            <span class="timer-num">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span>
            <button class="btn" onClick={stop}>Detener</button>
          </>
        ) : elapsed > 0 ? (
          <span class="timer-num">{Math.floor(elapsed / 60)} min</span>
        ) : (
          <>
            <button class="btn" onClick={start}>▶ Empezar temporizador</button>
            <label>
              o sin temporizador:
              <input type="number" value={manualMin} onChange={(e) => setManualMin(Number(e.target.value))} min={0} style={{ width: 70 }} />
              <span>min</span>
            </label>
          </>
        )}
      </div>

      <div class="counter">
        <h2>Puntadas por color</h2>
        {threads.length === 0 && <p class="empty">Este proyecto no tiene colores todavía.</p>}
        {threads.map((t) => (
          <div class="counter-row" style={{ "--c": t.thread.color } as React.CSSProperties}>
            <span class="spool" aria-hidden="true">●</span>
            <span class="thread-name">{t.thread.name}</span>
            <input
              type="number"
              value={stitches[t.pt.threadId] ?? 0}
              onChange={(e) => setStitches((s) => ({ ...s, [t.pt.threadId]: Number(e.target.value) }))}
              min={0}
            />
            <small>{t.done} / {t.pt.totalStitches}</small>
            {t.spoolsLeft > 0 && (
              <label class="spool-used">
                <input
                  type="checkbox"
                  checked={(spoolsUsed[t.pt.threadId] ?? 0) > 0}
                  onChange={(e) =>
                    setSpoolsUsed((s) => ({
                      ...s,
                      [t.pt.threadId]: e.target.checked ? 1 : 0,
                    }))
                  }
                />
                <span>¿Se ha gastado alguna bobina?</span>
                {(spoolsUsed[t.pt.threadId] ?? 0) > 0 && (
                  <select
                    value={spoolsUsed[t.pt.threadId] ?? 1}
                    onChange={(e) =>
                      setSpoolsUsed((s) => ({ ...s, [t.pt.threadId]: Number(e.target.value) }))
                    }
                  >
                    {Array.from({ length: t.spoolsLeft }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            )}
            {t.complete && <span class="done-tag">Completado</span>}
          </div>
        ))}
        <p>Total puntadas: <strong>{totalStitches}</strong></p>
      </div>

      <MediaField
        history={mediaHistory}
        type={mediaType}
        title={mediaTitle}
        episodes={episodes}
        setType={setMediaType}
        setTitle={setMediaTitle}
        setEpisodes={setEpisodes}
        datalistId="media-titles-session"
      />

      <button class="btn" onClick={save} disabled={saved}>Guardar sesión</button>
    </section>
  );
}
