import { useState } from "react";
import { Home } from "./screens/Home";
import { Project } from "./screens/Project";
import { Session } from "./screens/Session";
import { NewProject } from "./screens/NewProject";
import { Threads } from "./screens/Threads";

type View = "home" | "project" | "session" | "new" | "threads";

/**
 * Navegación mínima de la app (sin router): Inicio → Proyecto → Sesión.
 * Los datos vienen de IndexedDB (src/db.ts); la lógica derivada, de util/progress.ts.
 */
export function App() {
  const [view, setView] = useState<View>("home");
  const [projectId, setProjectId] = useState<number | null>(null);

  const openProject = (id: number) => {
    setProjectId(id);
    setView("project");
  };
  const startSession = (id: number) => {
    setProjectId(id);
    setView("session");
  };

  return (
    <div class="app">
      <nav class="nav" aria-label="Navegación">
        <button class={view === "home" ? "active" : ""} onClick={() => setView("home")}>Inicio</button>
        <button class={view === "new" ? "active" : ""} onClick={() => setView("new")}>Nuevo proyecto</button>
        <button class={view === "threads" ? "active" : ""} onClick={() => setView("threads")}>Hilos</button>
      </nav>
      {view === "home" && <Home onOpenProject={openProject} onNewProject={() => setView("new")} />}
      {view === "threads" && <Threads />}
      {view === "project" && projectId != null && (
        <Project projectId={projectId} onStartSession={startSession} onBack={() => setView("home")} />
      )}
      {view === "session" && projectId != null && <Session projectId={projectId} onDone={() => setView("project")} />}
      {view === "new" && <NewProject onCreated={openProject} />}
    </div>
  );
}
