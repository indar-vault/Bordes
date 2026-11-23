import { describe, it, expect } from "vitest";
import type { Session } from "../types";
import {
  sessionStitches,
  sessionSpools,
  threadSpoolsUsed,
  threadProgress,
  isThreadComplete,
  streak,
  streakInfo,
  minutesThisMonth,
  episodesThisMonth,
  HEAT_MINIMA,
  heatWindow,
  freezeLeft,
} from "./progress";

const s = (date: string, durationMin: number, entries: { threadId: number; stitches: number; spoolsUsed?: number }[], media?: Session["media"]): Session =>
  ({ projectId: 1, date, durationMin, entries, media });

const today = new Date("2026-11-20T12:00:00Z");

describe("progress", () => {
  it("suma las puntadas de una sesión", () => {
    expect(sessionStitches(s("2026-11-20T10:00:00Z", 30, [{ threadId: 1, stitches: 100 }, { threadId: 2, stitches: 50 }]))).toBe(150);
  });

  it("deriva el progreso de un color de varias sesiones", () => {
    const sessions = [
      s("2026-11-18T10:00:00Z", 20, [{ threadId: 1, stitches: 300 }]),
      s("2026-11-19T10:00:00Z", 25, [{ threadId: 1, stitches: 400 }, { threadId: 2, stitches: 12 }]),
    ];
    expect(threadProgress(sessions, 1)).toBe(700);
    expect(threadProgress(sessions, 2)).toBe(12);
  });

  it("suma las bobinas gastadas de una sesión y de un hilo", () => {
    expect(sessionSpools(s("2026-11-20T10:00:00Z", 30, [{ threadId: 1, stitches: 100, spoolsUsed: 1 }, { threadId: 2, stitches: 50 }]))).toBe(1);
    const sessions = [
      s("2026-11-18T10:00:00Z", 20, [{ threadId: 1, stitches: 300, spoolsUsed: 2 }]),
      s("2026-11-19T10:00:00Z", 25, [{ threadId: 1, stitches: 400, spoolsUsed: 1 }, { threadId: 2, stitches: 12, spoolsUsed: 1 }]),
    ];
    expect(threadSpoolsUsed(sessions, 1)).toBe(3);
    expect(threadSpoolsUsed(sessions, 2)).toBe(1);
    expect(threadSpoolsUsed(sessions, 3)).toBe(0);
  });

  it("marca un hilo como completado al llegar al total", () => {
    const sessions = [s("2026-11-19T10:00:00Z", 25, [{ threadId: 2, stitches: 13 }])];
    expect(isThreadComplete(sessions, { projectId: 1, threadId: 2, plannedName: "", isReplacement: false, totalStitches: 13, order: 0 })).toBe(true);
    expect(isThreadComplete(sessions, { projectId: 1, threadId: 2, plannedName: "", isReplacement: false, totalStitches: 14, order: 0 })).toBe(false);
  });

  it("cuenta días consecutivos con sesión", () => {
    const sessions = [
      s("2026-11-20T10:00:00Z", 30, []),
      s("2026-11-19T10:00:00Z", 30, []),
      s("2026-11-18T10:00:00Z", 30, []),
      s("2026-11-16T10:00:00Z", 30, []), // hueco el 17
    ];
    expect(streak(sessions, today)).toBe(3);
  });

  it("la racha es 0 si hoy no hay sesión", () => {
    expect(streak([s("2026-11-19T10:00:00Z", 30, [])], today)).toBe(0);
  });

  it("C2: los días de descanso no rompen la racha, con tope semanal", () => {
    const sessions = [
      s("2026-11-20T10:00:00Z", 20, [{ threadId: 1, stitches: 100 }]),
      s("2026-11-18T10:00:00Z", 20, [{ threadId: 1, stitches: 100 }]),
      s("2026-11-16T10:00:00Z", 20, [{ threadId: 1, stitches: 100 }]),
    ];
    expect(streak(sessions, today, 0)).toBe(1); // sin descansos: jueves rompe
    expect(streak(sessions, today, 1)).toBe(2); // jueves congelado, martes agota
    expect(streak(sessions, today, 2)).toBe(3); // jueves y martes, llega al lunes
  });

  it("C2: el presupuesto de descansos se renueva cada semana ISO", () => {
    const sessions = [
      s("2026-11-20T10:00:00Z", 20, [{ threadId: 1, stitches: 10 }]),
      s("2026-11-18T10:00:00Z", 20, [{ threadId: 1, stitches: 10 }]),
      s("2026-11-16T10:00:00Z", 20, [{ threadId: 1, stitches: 10 }]),
      s("2026-11-14T10:00:00Z", 20, [{ threadId: 1, stitches: 10 }]),
    ];
    // 20 ✓, 19 ❄, 18 ✓, 17 ❄, 16 ✓ | 15 ❄ (nueva semana), 14 ✓
    expect(streak(sessions, today, 2)).toBe(4);
  });

  it("suma minutos y episodios del mes", () => {
    const sessions = [
      s("2026-11-15T10:00:00Z", 45, [], { type: "serie", title: "Friends", episodes: 2 }),
      s("2026-11-05T10:00:00Z", 60, [], { type: "youtube" }),
      s("2026-10-30T10:00:00Z", 90, [], { type: "peli", title: "Amélie" }),
    ];
    expect(minutesThisMonth(sessions, today)).toBe(105);
    expect(episodesThisMonth(sessions, today)).toBe(2);
  });

  it("B2: heatWindow da las puntadas y minutos de cada día de los tres meses", () => {
    const sessions = [
      s("2026-11-18T10:00:00Z", 20, [{ threadId: 1, stitches: 300 }]),
      s("2026-11-18T18:00:00Z", 30, [{ threadId: 1, stitches: 5 }]),
      s("2026-11-16T10:00:00Z", 10, [{ threadId: 1, stitches: 40 }]),
      s("2026-09-30T10:00:00Z", 15, [{ threadId: 1, stitches: 500 }]),
    ];
    const cells = heatWindow(sessions, 0, today).cells;
    const byDate = new Map(cells.map((c) => [c.date, c]));
    expect(byDate.get("2026-11-18")?.stitches).toBe(305);
    expect(byDate.get("2026-11-18")?.minutes).toBe(50);
    expect(byDate.get("2026-09-30")?.stitches).toBe(500);
    const total = cells.reduce((sum, c) => sum + c.stitches, 0);
    expect(total).toBe(845);
  });

  it("C2: heatWindow marca como congelados los días que salva la racha", () => {
    const sessions = [
      s("2026-11-20T10:00:00Z", 20, [{ threadId: 1, stitches: 100 }]),
      s("2026-11-18T10:00:00Z", 20, [{ threadId: 1, stitches: 100 }]),
    ];
    const frozen = heatWindow(sessions, 1, today).cells.filter((c) => c.frozen).map((c) => c.date);
    expect(frozen).toEqual(["2026-11-19"]);
    expect(heatWindow(sessions, 0, today).cells.some((c) => c.frozen)).toBe(false);
  });

  it("las gamas del calendario tienen umbrales coherentes (nunca 0)", () => {
    // Heat.js necesita un nombre de clase por gama; los mínimos 1..4 evitan
    // que un día vacío se confunda con una gama.
    expect(HEAT_MINIMA.puntadas).toEqual([1, 50, 150, 300]);
    expect(HEAT_MINIMA.minutos).toEqual([1, 20, 45, 90]);
    for (const minima of Object.values(HEAT_MINIMA)) {
      expect(minima.length).toBe(4);
      expect(minima[0]).toBeGreaterThan(0);
      expect(minima.every((v, i) => i === 0 || v > minima[i - 1])).toBe(true);
    }
  });

  it("heatWindow cubre los tres meses naturales terminados en el mes actual", () => {
    const win = heatWindow([], 0, today); // 2026-11-20
    expect(win.year).toBe(2026);
    expect(win.startMonth).toBe(8); // septiembre, 0-based
    expect(win.months).toEqual([9, 10, 11]);
    expect(win.cells.length).toBe(30 + 31 + 30);
    expect(win.cells[0].date).toBe("2026-09-01");
    expect(win.cells[win.cells.length - 1].date).toBe("2026-11-30");
  });

  it("heatWindow cruza el fin de año sin perder el mes actual", () => {
    const enero = heatWindow([], 0, new Date(2026, 0, 15));
    expect([enero.year, enero.startMonth, enero.months].join("|")).toBe("2025|10|11,12,1");
    const febrero = heatWindow([], 0, new Date(2026, 1, 3));
    expect([febrero.year, febrero.startMonth, febrero.months].join("|")).toBe("2025|11|12,1,2");
    expect(febrero.cells[0].date).toBe("2025-12-01");
  });

  it("freezeLeft cuenta los descansos que quedan de la semana en curso", () => {
    // Semana 16–22 de noviembre de 2026 (lunes a domingo). Hoy: 22 (domingo).
    const today = new Date("2026-11-22T12:00:00");
    const everyDay = ["16", "17", "18", "19", "20", "21", "22"].map((d) =>
      s(`2026-11-${d}T10:00:00Z`, 10, [{ threadId: 1, stitches: 50 }])
    );
    expect(freezeLeft(everyDay, 2, today)).toBe(2);
    const oneGap = everyDay.filter((x) => x.date.slice(0, 10) !== "2026-11-19");
    expect(freezeLeft(oneGap, 2, today)).toBe(1);
    const threeGaps = everyDay.filter((x) => !["2026-11-18", "2026-11-19", "2026-11-20"].includes(x.date.slice(0, 10)));
    expect(freezeLeft(threeGaps, 2, today)).toBe(0);
    expect(freezeLeft(oneGap, 0, today)).toBe(0);
  });
});
