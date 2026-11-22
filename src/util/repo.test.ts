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
  setReplacement,
  swapProjectThread,
  threadUsage,
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

  it("registra el gasto manual de bobinas y lo deriva de las sesiones", async () => {
    const id = await createProject({ name: "Bobinas", totalStitches: 100, colors: [{ color: "#333", name: "Verde", spools: 3, totalStitches: 100 }] });
    const tid = (await getProjectThreads(id))[0].pt.threadId;
    await saveSession({ projectId: id, durationMin: 10, entries: [{ threadId: tid, stitches: 50, spoolsUsed: 1 }] });
    await saveSession({ projectId: id, durationMin: 10, entries: [{ threadId: tid, stitches: 0, spoolsUsed: 2 }] });
    const view = (await getProjectThreads(id))[0];
    expect(view.spoolsUsed).toBe(3);
    expect(view.spoolsLeft).toBe(0);
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

  it("reutiliza el hilo de la biblioteca cuando el DMC coincide", async () => {
    const a = await createProject({ name: "A", totalStitches: 100, colors: [{ color: "#9FA6B1", name: "Pearl Gray", dmc: "415", spools: 2, totalStitches: 100 }] });
    const b = await createProject({ name: "B", totalStitches: 50, colors: [{ color: "#9FA6B1", name: "Griso", dmc: "415", spools: 1, totalStitches: 50 }] });
    const ta = await getProjectThreads(a);
    const tb = await getProjectThreads(b);
    expect(tb[0].pt.threadId).toBe(ta[0].pt.threadId); // mismo hilo global
    const usage = await threadUsage();
    expect(usage[ta[0].pt.threadId]!.length).toBe(2);
  });

  it("el toggle de reemplazo recuerda el hilo teórico del patrón", async () => {
    const id = await createProject({ name: "Re", totalStitches: 10, colors: [{ color: "#eee", name: "Blanco", dmc: "White", spools: 1, totalStitches: 10 }] });
    const pt = (await getProjectThreads(id))[0].pt;
    expect(pt.isReplacement).toBe(false);
    await setReplacement(pt.id!, "Crema 752");
    const again = (await getProjectThreads(id))[0].pt;
    expect(again.isReplacement).toBe(true);
    expect(again.plannedName).toBe("Crema 752");
    await setReplacement(pt.id!, null);
    expect((await getProjectThreads(id))[0].pt.isReplacement).toBe(false);
  });

  it("un color importado puede asignarse a un hilo existente de la biblioteca", async () => {
    const lib = await db.threads.add({ color: "#F2C94C", name: "Girasol", dmc: "752", spools: 4 });
    const id = await createProject({
      name: "Importado",
      totalStitches: 12,
      colors: [{ color: "#ff0000", name: "Rojo", dmc: "03", spools: 1, totalStitches: 4, threadId: lib }],
    });
    const pt = (await getProjectThreads(id))[0];
    expect(pt.thread.id).toBe(lib);          // se borda el hilo de la biblioteca
    expect(pt.pt.plannedName).toBe("Rojo");  // pero se conserva la sugerencia del patrón
    expect(pt.pt.plannedDmc).toBe("03");
  });

  it("cambiar el hilo a mitad de proyecto traspasa las puntadas registradas", async () => {
    const id = await createProject({
      name: "Cambio",
      totalStitches: 100,
      colors: [{ color: "#111", name: "Gris", dmc: "415", spools: 1, totalStitches: 100 }],
    });
    const first = (await getProjectThreads(id))[0];
    await saveSession({ projectId: id, durationMin: 30, entries: [{ threadId: first.pt.threadId, stitches: 40 }] });
    const other = await db.threads.add({ color: "#eee", name: "Blanco", dmc: "White", spools: 2 });
    await swapProjectThread(first.pt.id!, other);

    const after = await getProjectThreads(id);
    expect(after[0].pt.threadId).toBe(other);
    expect(after[0].pt.plannedName).toBe("Gris");
    expect(after[0].done).toBe(40); // el progreso no se pierde al cambiar de hilo
    expect((await getSessions(id))[0].entries[0].threadId).toBe(other);
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
