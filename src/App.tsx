import { useState } from "react";
import { Home } from "./screens/Home";
import { Project } from "./screens/Project";
import { Session } from "./screens/Session";
import { NewProject } from "./screens/NewProject";
import { Threads } from "./screens/Threads";
import { Summary } from "./screens/Summary";

type View = "home" | "project" | "session" | "new" | "threads" | "summary";

/**
 * Navegación mínima de la app (sin router): Inicio → Proyecto → Sesión.
 * Los datos vienen de IndexedDB (src/db.ts); la lógica derivada, de util/progress.ts.
 */
export function App() {
  const [view, setView] = useState<View>("home");
  const [projectId, setProjectId] = useState<number | null>(null);
  /** Último borrado suave (A3) y cómo deshacerlo. */
  const [undo, setUndo] = useState<{ label: string; run: () => Promise<void> } | null>(null);
  // Tras un deshacer, Home (ya montado) necesita volver a leer la base.
  const [nonce, setNonce] = useState(0);

  const onDeleted = (label: string, run: () => Promise<void>) => setUndo({ label, run });
  async function handleUndo() {
    if (!undo) return;
    await undo.run();
    setUndo(null);
    setNonce((n) => n + 1);
  }

  const openProject = (id: number) => {
    setProjectId(id);
    setView("project");
  };
  const startSession = (id: number) => {
    setProjectId(id);
    setView("session");
  };
  const openSummary = (id: number) => {
    setProjectId(id);
    setView("summary");
  };

  return (
    <div class="app">
      <nav class="nav" aria-label="Navegación">
        <button class={view === "home" ? "active" : ""} onClick={() => setView("home")}>Inicio</button>
        <button class={view === "new" ? "active" : ""} onClick={() => setView("new")}>Nuevo proyecto</button>
        <button class={view === "threads" ? "active" : ""} onClick={() => setView("threads")}>Hilos</button>
      </nav>
      {undo && (
        <div class="undo-banner" role="status">
          <span>Se ha eliminado {undo.label}</span>
          <button class="btn" onClick={handleUndo}>Deshacer</button>
        </div>
      )}
      {view === "home" && <Home onOpenProject={openProject} onNewProject={() => setView("new")} refreshKey={nonce} />}
      {view === "threads" && <Threads />}
      {view === "project" && projectId != null && (
        <Project projectId={projectId} onStartSession={startSession} onOpenSummary={openSummary} onBack={() => setView("home")} onDeleted={onDeleted} />
      )}
      {view === "summary" && projectId != null && <Summary projectId={projectId} onBack={() => setView("project")} />}
      {view === "session" && projectId != null && <Session projectId={projectId} onDone={() => setView("project")} />}
      {view === "new" && <NewProject onCreated={openProject} />}
    </div>
  );
}
