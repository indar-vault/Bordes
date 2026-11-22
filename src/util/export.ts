import { db } from "../db";

/**
 * Copia de seguridad JSON. El `schemaVersion` es el contrato de actualización:
 * si el esquema cambia, se escribe una migración y se suben las versiones
 * (decisión #2 en 20-decisiones.md).
 */
export const SCHEMA_VERSION = 2;

export interface Backup {
  schemaVersion: number;
  exportedAt: string;
  projects: unknown[];
  threads: unknown[];
  projectThreads: unknown[];
  sessions: unknown[];
  settings?: unknown[]; // v2 (A3/A4)
}

export async function buildBackup(): Promise<Backup> {
  // A3: la copia purge lo borrado suavemente; es la purga definitiva.
  const projects = (await db.projects.toArray()).filter((p) => !p.deletedAt);
  const liveIds = new Set(projects.map((p) => p.id!));
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    projects,
    threads: await db.threads.toArray(),
    projectThreads: (await db.projectThreads.toArray()).filter((pt) => liveIds.has(pt.projectId)),
    sessions: (await db.sessions.toArray()).filter((s) => !s.deletedAt && liveIds.has(s.projectId)),
    settings: await db.settings.toArray(),
  };
}

export async function restoreBackup(json: string): Promise<Backup> {
  const data = JSON.parse(json) as Backup;
  // Compatibilidad hacia atrás (decisión #16): los cambios de v2 son solo
  // aditivos, así que una copia de v1 se puede restaurar sin migrar nada.
  if (data.schemaVersion > SCHEMA_VERSION) {
    throw new Error(
      `Copia de la versión ${data.schemaVersion}, la app es la versión ${SCHEMA_VERSION}. ` +
      "Actualiza la app o usa una copia compatible."
    );
  }
  await db.projects.clear();
  await db.threads.clear();
  await db.projectThreads.clear();
  await db.sessions.clear();
  await db.settings.clear();
  await db.projects.bulkAdd((data.projects ?? []) as never[]);
  await db.threads.bulkAdd((data.threads ?? []) as never[]);
  await db.projectThreads.bulkAdd((data.projectThreads ?? []) as never[]);
  await db.sessions.bulkAdd((data.sessions ?? []) as never[]);
  if (data.settings?.length) await db.settings.bulkAdd(data.settings as never[]);
  return data;
}
