import { useState } from "react";
import type { DummyProject } from "../dummy";

type Thread = DummyProject["threads"][number];

export function Session({ dummy }: { dummy: DummyProject }) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [stitches, setStitches] = useState(0);
  const [thread, setThread] = useState<DummyProject["threads"][0]>(dummy.threads[0]);
  const [mediaType, setMediaType] = useState<"youtube" | "peli" | "serie" | "">("");
  const [mediaTitle, setMediaTitle] = useState("");
  const [episodes, setEpisodes] = useState(0);

  function start() {
    setRunning(true);
    setElapsed(0);
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    (window as any).__bordesTimer = t;
  }
  function stop() {
    setRunning(false);
    clearInterval((window as any).__bordesTimer);
  }

  return (
    <section class="screen">
      <h1>Nueva sesión — {dummy.name}</h1>

      <div class="timer">
        {running ? (
          <>
            <span class="timer-num">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span>
            <button class="btn" onClick={stop}>Finalizar</button>
          </>
        ) : (
          <button class="btn" onClick={start}>▶ Empezar temporizador</button>
        )}
      </div>

      <div class="counter">
        <label>
          Color:
          <select value={thread.name} onChange={(e) => setThread(dummy.threads.find((t) => t.name === e.target.value)!)}>
            {dummy.threads.map((t) => <option key={t.name}>{t.name}</option>)}
          </select>
        </label>
        <input type="number" value={stitches} onChange={(e) => setStitches(Number(e.target.value))} placeholder="Puntadas" />
        <button class="btn">Guardar puntadas</button>
      </div>

      <div class="media">
        <label>Registrar lo que se ha visto</label>
        <select value={mediaType} onChange={(e) => setMediaType(e.target.value as any)}>
          <option value="">—</option>
          <option value="youtube">YouTube</option>
          <option value="peli">Película</option>
          <option value="serie">Serie</option>
        </select>
        {mediaType && (
          <>
            <input type="text" value={mediaTitle} onChange={(e) => setMediaTitle(e.target.value)} placeholder={`Nombre (${mediaType})`} />
            {mediaType === "serie" && (
              <input type="number" value={episodes} onChange={(e) => setEpisodes(Number(e.target.value))} placeholder="Episodios" />
            )}
          </>
        )}
      </div>
    </section>
  );
}
