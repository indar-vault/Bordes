import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../db";
import {
  addColorToProject,
  createProject,
  deleteSession,
  getProject,
  getProjectThreads,
  getSessions,
  localISO,
  saveSession,
  updateProject,
} from "./repo";
import { buildBackup, restoreBackup, SCHEMA_VERSION } from "./export";
import { projectStitchesDone, streak } from "./progress";

/**
 * Pruebas de la capa de datos con IndexedDB simulado (fake-indexeddb).
 * Comprueban la regla de integridad: el progreso solo se deriva de las sesiones.
 */
describe("repo (IndexedDB simulado)", () => {
  beforeEach(async () => {
    await db.projects.clear();
    await db.threads.clear();
    await db.projectThreads.clear();
    await db.sessions.clear();
  });

  it("crea un proyecto con colores y lo deriva de las sesiones", async () => {
    const id = await createProject({
      name: "Olivia Rodrigo",
      totalStitches: 3025,
      colors: [
        { color: "#9FA6B1", name: "Pearl Gray", dmc: "415", spools: 2, totalStitches: 2615 },
        { color: "#C7395E", name: "Shell Pink", dmc: "224", spools: 1, totalStitches: 145 },
      ],
    });
    const project = await getProject(id);
    expect(project?.status).toBe("activo");
    expect((await getProjectThreads(id)).length).toBe(2);

    await saveSession({ projectId: id, durationMin: 45, entries: [{ threadId: 1, stitches: 500 }] });
    await saveSession({ projectId: id, durationMin: 30, entries: [{ threadId: 1, stitches: 300 }, { threadId: 2, stitches: 145 }] });

    const threads = await getProjectThreads(id);
    expect(threads[0].done).toBe(800);
    expect(threads[0].complete).toBe(false);
    // El completado baja al final de la lista (menor prioridad).
    expect(threads[1].complete).toBe(true);
    expect(threads[threads.length - 1].thread.name).toBe("Shell Pink");
    expect(projectStitchesDone(await getSessions(id), id)).toBe(945);
  });

  it("ignora las entradas con 0 puntadas al guardar", async () => {
    const id = await createProject({ name: "Flor", totalStitches: 100, colors: [{ color: "#111", name: "Rojo", spools: 1, totalStitches: 100 }] });
    const session = await saveSession({ projectId: id, durationMin: 10, entries: [{ threadId: 1, stitches: 0 }] });
    expect(session.entries).toHaveLength(0);
  });

  it("actualiza la fecha del proyecto al guardar una sesión (para la home)", async () => {
    const id = await createProject({ name: "Osito", totalStitches: 100, colors: [] });
    const before = (await getProject(id))!.updatedAt;
    await saveSession({ projectId: id, durationMin: 5, entries: [] });
    expect((await getProject(id))!.updatedAt >= before);
  });

  it("permite borrar una sesión y el progreso vuelve a derivarse", async () => {
    const id = await createProject({ name: "Flor de lis", totalStitches: 100, colors: [{ color: "#222", name: "Azul", spools: 1, totalStitches: 100 }] });
    const s = await saveSession({ projectId: id, durationMin: 20, entries: [{ threadId: 1, stitches: 60 }] });
    await deleteSession(s.id!);
    expect((await getProjectThreads(id))[0].done).toBe(0);
  });

  it("la racha usa días locales con su desfase horario", async () => {
    const id = await createProject({ name: "Racha", totalStitches: 10, colors: [] });
    await saveSession({ projectId: id, durationMin: 10, entries: [], date: "2026-11-20T00:30:00+01:00" });
    await saveSession({ projectId: id, durationMin: 10, entries: [], date: "2026-11-19T23:50:00+01:00" });
    const sessions = await getSessions(id);
    expect(streak(sessions, new Date("2026-11-20T12:00:00Z"))).toBe(2);
  });

  it("si no se indica el total, lo deduce de la suma de colores", async () => {
    const id = await createProject({
      name: "Sin total",
      totalStitches: 0,
      colors: [
        { color: "#111", name: "A", spools: 1, totalStitches: 100 },
        { color: "#222", name: "B", spools: 1, totalStitches: 50 },
      ],
    });
    expect((await getProject(id))!.totalStitches).toBe(150);
  });

  it("un color sin puntadas previstas no se marca completado", async () => {
    const id = await createProject({ name: "Cero", totalStitches: 10, colors: [{ color: "#333", name: "Sin usar", spools: 1, totalStitches: 0 }] });
    expect((await getProjectThreads(id))[0].complete).toBe(false);
  });

  it("exportar y restaurar devuelve los mismos datos", async () => {
    const id = await createProject({ name: "Regalo", totalStitches: 50, giftTo: "Marta", colors: [{ color: "#333", name: "Verde", spools: 3, totalStitches: 50 }] });
    await saveSession({ projectId: id, durationMin: 30, entries: [{ threadId: 1, stitches: 25 }], media: { type: "serie", title: "Friends", episodes: 2 } });
    const backup = await buildBackup();
    expect(backup.schemaVersion).toBe(SCHEMA_VERSION);

    await db.projects.clear();
    await db.sessions.clear();
    await restoreBackup(JSON.stringify(backup));
    expect((await getSessions(id))[0].media?.title).toBe("Friends");
    expect((await getProject(id))?.giftTo).toBe("Marta");
    expect(await projectStitchesDone(await getSessions(id), id)).toBe(25);
  });

  it("rechaza una copia de una versión incompatible", async () => {
    const bad = JSON.stringify({ schemaVersion: 99, exportedAt: "", projects: [], threads: [], projectThreads: [], sessions: [] });
    await expect(restoreBackup(bad)).rejects.toThrow("versión 99");
  });

  it("localISO produce fecha local con desfase", () => {
    const iso = localISO(new Date("2026-11-20T08:00:00Z"));
    expect(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(iso)).toBe(true);
  });
});
