import React from "react";
import type { DummyProject } from "../dummy";

export function Project({ dummy, onStartSession }: { dummy: DummyProject; onStartSession: () => void }) {
  const pct = Math.round((dummy.doneStitches / dummy.totalStitches) * 100);
  const colorsDone = dummy.threads.filter((t) => t.done >= t.total).length;
  // Los completados bajan al final (menor prioridad), como pide el ticket.
  const threads = [...dummy.threads].sort((a, b) => (a.done >= a.total ? 1 : 0) - (b.done >= b.total ? 1 : 0));

  return (
    <section class="screen">
      <div class="project-head">
        <div class="cover" aria-hidden="true">▢</div>
        <div>
          <h1>{dummy.name}</h1>
          <p>{dummy.doneStitches} / {dummy.totalStitches} puntadas ({pct}%)</p>
          <p>{colorsDone} / {dummy.threads.length} colores completados</p>
          <button class="btn" onClick={onStartSession}>▶ Empezar sesión</button>
          <button class="btn ghost" onClick={onStartSession}>+ Sesión manual</button>
        </div>
      </div>

      <div class="progress"><div class="progress-fill" style={{ width: `${pct}%` }} /></div>

      <h2>Hilos del proyecto</h2>
      <ul class="threads">
        {threads.map((t) => {
          const done = t.done >= t.total;
          return (
            <li class={done ? "thread done" : "thread"} style={{ "--c": t.color } as React.CSSProperties}>
              <span class="spool" aria-hidden="true">●</span>
              <span class="thread-name">{t.name} <small>DMC {t.dmc}</small></span>
              <span class="thread-num">{t.done} / {t.total}</span>
              {done && <span class="done-tag">Completado</span>}
            </li>
          );
        })}
      </ul>

      <h2>Registro de sesiones</h2>
      <ul class="log">
        {dummy.sessions.map((s) => (
          <li key={s.date}>
            <strong>{s.date}</strong> — {s.summary}
            <br />
            <small>{s.detail}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}

