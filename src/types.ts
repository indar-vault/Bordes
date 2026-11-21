// Modelo de datos de Bordes (v1). Ver 30-arquitectura.md en la memoria del proyecto.

export type MediaType = "youtube" | "peli" | "serie";

export interface MediaLog {
  type: MediaType;
  title?: string; // vacío = genérico ("YouTube", "Película", "Serie")
  episodes?: number; // solo para series
  notes?: string;
}

/** Hilo global de la biblioteca: un color con sus carretes. */
export interface Thread {
  id?: number;
  color: string; // hex, p. ej. "#9FA6B1"
  name: string;
  dmc?: string; // código DMC si viene de Flosscross
  spools: number; // carretes disponibles
}

/** Hilo tal y como participa en un proyecto concreto. */
export interface ProjectThread {
  id?: number;
  projectId: number;
  threadId: number; // el hilo REAL que se va a bordar
  plannedName: string; // el color que el patrón sugiere (nombre original)
  plannedDmc?: string; // su código DMC, si venía del patrón
  isReplacement: boolean; // este hilo reemplaza al teórico
  totalStitches: number; // puntadas previstas para este color en el patrón
  order: number; // prioridad de trabajo
}

export interface Project {
  id?: number;
  name: string;
  image?: string; // data-URL de la foto del patrón
  totalStitches: number;
  status: "activo" | "terminado";
  giftTo?: string; // "pensado para regalar a X"
  notes: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface SessionEntry {
  threadId: number;
  stitches: number;
}

export interface Session {
  id?: number;
  projectId: number;
  date: string; // ISO (fecha de la sesión)
  durationMin: number;
  entries: SessionEntry[]; // puntadas por color — única fuente de verdad del progreso
  media?: MediaLog;
}
