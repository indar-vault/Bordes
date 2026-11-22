import { describe, it, expect } from "vitest";
import { computeSummary, formatMinutes } from "./summary";
import type { Project, Session } from "../types";
import type { ThreadView } from "./repo";

/**
 * El resumen se deriva siempre de las sesiones (decisión #3): aquí se comprueba
 * la agregación con datos de mano.
 */
const project: Project = {
  id: 1,
  name: "Flor de lis",
  totalStitches: 12,
  status: "activo",
  notes: "",
  createdAt: "2026-11-19T10:00:00+01:00",
  updatedAt: "2026-11-20T10:00:00+01:00",
};

const views: ThreadView[] = [
  { pt: { projectId: 1, threadId: 1, plannedName: "Rojo", totalStitches: 4, order: 0, isReplacement: false }, thread: { color: "#f00", name: "Rojo", spools: 2 }, done: 4, complete: true },
  { pt: { projectId: 1, threadId: 2, plannedName: "Naranja", totalStitches: 3, order: 1, isReplacement: false }, thread: { color: "#f80", name: "Naranja", spools: 1 }, done: 0, complete: false },
];

const sessions: Session[] = [
  { projectId: 1, date: "2026-11-19T20:10:00+01:00", durationMin: 45, entries: [{ threadId: 1, stitches: 40, spoolsUsed: 1 }], media: { type: "serie", title: "Friends", episodes: 2 } },
  { projectId: 1, date: "2026-11-20T09:00:00+01:00", durationMin: 15, entries: [], media: { type: "peli" } },
  { projectId: 1, date: "2026-11-20T21:00:00+01:00", durationMin: 30, entries: [{ threadId: 1, stitches: 10, spoolsUsed: 1 }], media: { type: "youtube" } },
];

describe("computeSummary", () => {
  it("agrega sesiones, tiempo, días y puntadas", () => {
    const s = computeSummary(project, sessions, views);
    expect(s.sessions).toBe(3);
    expect(s.totalMinutes).toBe(90);
    expect(s.avgMinutes).toBe(30);
    expect(s.days).toBe(2); // el 19 y el 20
    expect(s.stitchesDone).toBe(50);
    expect(s.plannedStitches).toBe(7);
    expect(s.pct).toBe(100); // las puntadas registradas no pueden pasar de la rejilla
    expect(s.colors).toBe(2);
    expect(s.colorsDone).toBe(1);
    expect(s.spools).toBe(3);
    expect(s.spoolsUsed).toBe(2);
    expect(s.firstDate).toBe("2026-11-19");
    expect(s.lastDate).toBe("2026-11-20");
  });

  it("cuenta episodios, películas y sesiones de YouTube por separado", () => {
    const s = computeSummary(project, sessions, views);
    expect(s.episodes).toBe(2);
    expect(s.movies).toBe(1);
    expect(s.youtube).toBe(1);
  });

  it("un proyecto sin sesiones no divide por cero", () => {
    const s = computeSummary(project, [], []);
    expect(s.sessions).toBe(0);
    expect(s.avgMinutes).toBe(0);
    expect(s.firstDate).toBeUndefined();
    expect(s.pct).toBe(0);
  });
});

describe("formatMinutes", () => {
  it("pasa de minutos a horas y minutos", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(60)).toBe("1 h");
    expect(formatMinutes(95)).toBe("1 h 35 min");
    expect(formatMinutes(0)).toBe("0 min");
  });
});
