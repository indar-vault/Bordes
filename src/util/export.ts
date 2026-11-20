import { db } from "../db";

/**
 * Copia de seguridad JSON. El `schemaVersion` es el contrato de actualización:
 * si el esquema cambia, se escribe una migración y se suben las versiones
 * (decisión #2 en 20-decisiones.md).
 */
export const SCHEMA_VERSION = 1;

export interface Backup {
  schemaVersion: number;
  exportedAt: string;
  projects: unknown[];
  threads: unknown[];
  projectThreads: unknown[];
  sessions: unknown[];
}

export async function buildBackup(): Promise<Backup> {
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    projects: await db.projects.toArray(),
    threads: await db.threads.toArray(),
    projectThreads: await db.projectThreads.toArray(),
    sessions: await db.sessions.toArray(),
  };
}

export async function restoreBackup(json: string): Promise<Backup> {
  const data = JSON.parse(json) as Backup;
  if (data.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `Copia de la versión ${data.schemaVersion}, la app es la versión ${SCHEMA_VERSION}. ` +
      "Actualiza la app o usa una copia compatible."
    );
  }
  await db.projects.clear();
  await db.threads.clear();
  await db.projectThreads.clear();
  await db.sessions.clear();
  await db.projects.bulkAdd((data.projects ?? []) as never[]);
  await db.threads.bulkAdd((data.threads ?? []) as never[]);
  await db.projectThreads.bulkAdd((data.projectThreads ?? []) as never[]);
  await db.sessions.bulkAdd((data.sessions ?? []) as never[]);
  return data;
}
