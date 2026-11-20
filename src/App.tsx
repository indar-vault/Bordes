import { useState } from "react";
import { Home } from "./screens/Home";
import { Project } from "./screens/Project";
import { Session } from "./screens/Session";
import { DUMMY } from "./dummy";

type View = "home" | "project" | "session";

/**
 * Wireframe de las tres pantallas (Fase 0/1). Los datos son falsos (src/dummy.ts);
 * en la Fase 1 se sustituyen por la base real (db.ts) con alta manual.
 */
export function App() {
  const [view, setView] = useState<View>("home");

  return (
    <div class="app">
      <nav class="nav" aria-label="Navegación">
        <button class={view === "home" ? "active" : ""} onClick={() => setView("home")}>Inicio</button>
        <button class={view === "project" ? "active" : ""} onClick={() => setView("project")}>Proyecto</button>
        <button class={view === "session" ? "active" : ""} onClick={() => setView("session")}>Sesión</button>
      </nav>
      {view === "home" && <Home dummy={DUMMY} onOpenProject={() => setView("project")} />}
      {view === "project" && <Project dummy={DUMMY} onStartSession={() => setView("session")} />}
      {view === "session" && <Session dummy={DUMMY} />}
    </div>
  );
}
