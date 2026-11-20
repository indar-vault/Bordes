import type { DummyProject } from "../dummy";

export function Home({ dummy, onOpenProject }: { dummy: DummyProject; onOpenProject: () => void }) {
  const pct = Math.round((dummy.doneStitches / dummy.totalStitches) * 100);
  return (
    <section class="screen">
      <h1>Bordes</h1>

      <article class="hero-card" onClick={onOpenProject}>
        <div class="hero-pattern" aria-hidden="true">▢</div>
        <div class="hero-info">
          <h2>{dummy.name}</h2>
          <p>{dummy.doneStitches} / {dummy.totalStitches} puntadas · {pct}%</p>
          <div class="progress"><div class="progress-fill" style={{ width: `${pct}%` }} /></div>
        </div>
      </article>

      <div class="widgets">
        <div class="widget">
          <span class="widget-num">🔥 {dummy.streak}</span>
          <span class="widget-label">días de racha</span>
        </div>
        <div class="widget">
          <span class="widget-num">{Math.floor(dummy.monthMinutes / 60)} h {dummy.monthMinutes % 60} min</span>
          <span class="widget-label">bordado este mes</span>
        </div>
        <div class="widget">
          <span class="widget-num">{dummy.monthEpisodes}</span>
          <span class="widget-label">episodios este mes · {dummy.monthSeries}</span>
        </div>
      </div>

      <h3>Proyectos activos</h3>
      <div class="minis">
        {dummy.miniProjects.map((p) => (
          <button class="mini" key={p.name} onClick={onOpenProject}>
            <span class="mini-name">{p.name}</span>
            <span class="mini-num">{p.done} / {p.total}</span>
            <div class="progress"><div class="progress-fill" style={{ width: `${Math.round((p.done / p.total) * 100)}%` }} /></div>
          </button>
        ))}
      </div>
    </section>
  );
}
