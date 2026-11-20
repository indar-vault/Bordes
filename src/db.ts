import Dexie, { type Table } from "dexie";
import type { Project, Thread, ProjectThread, Session } from "./types";

/**
 * Base de datos local (IndexedDB). El progreso nunca se guarda como contador
 * suelto: se deriva de las sesiones (regla de integridad, ver 20-decisiones.md).
 * Cada cambio de esquema se hace subiendo `version` con una migración.
 */
export class BordesDB extends Dexie {
  projects!: Table<Project, number>;
  threads!: Table<Thread, number>;
  projectThreads!: Table<ProjectThread, number>;
  sessions!: Table<Session, number>;

  constructor() {
    super("bordes");
    this.version(1).stores({
      projects: "++id, name, status, updatedAt",
      threads: "++id, color, name, dmc",
      projectThreads: "++id, projectId, threadId, order",
      sessions: "++id, projectId, date",
    });
  }
}

export const db = new BordesDB();
