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
  heatmap,
  heatLevel,
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

  it("B2: el calendario cubre 8 semanas alineadas en lunes con las puntadas por día", () => {
    const sessions = [
      s("2026-11-18T10:00:00Z", 20, [{ threadId: 1, stitches: 300 }]),
      s("2026-11-16T10:00:00Z", 10, [{ threadId: 1, stitches: 40 }]),
      s("2026-09-30T10:00:00Z", 15, [{ threadId: 1, stitches: 500 }]),
    ];
    const grid = heatmap(sessions, 8, today); // 2026-11-20 es viernes
    expect(grid.length).toBe(56);
    expect(grid[0].date).toBe("2026-11-16"); // lunes de la semana actual
    expect(grid[2].stitches).toBe(300); // miércoles 18
    expect(grid[7 * 7 + 2].date).toBe("2026-09-30"); // 7 semanas antes
    expect(grid[7 * 7 + 2].stitches).toBe(500);
    const total = grid.reduce((sum, c) => sum + c.stitches, 0);
    expect(total).toBe(840);
  });

  it("el calendario acumula también los minutos por día", () => {
    const sessions = [
      s("2026-11-18T10:00:00Z", 45, [{ threadId: 1, stitches: 10 }]),
      s("2026-11-18T18:00:00Z", 30, [{ threadId: 1, stitches: 5 }]),
    ];
    const cell = heatmap(sessions, 8, today).find((c) => c.date === "2026-11-18");
    expect(cell?.minutes).toBe(75);
  });

  it("C2: el calendario marca con ❄ los días congelados de la racha", () => {
    const sessions = [
      s("2026-11-20T10:00:00Z", 20, [{ threadId: 1, stitches: 100 }]),
      s("2026-11-18T10:00:00Z", 20, [{ threadId: 1, stitches: 100 }]),
    ];
    const info = streakInfo(sessions, today, 1);
    expect(info.count).toBe(2);
    expect(info.frozen.has("2026-11-19")).toBe(true);
    const grid = heatmap(sessions, 8, today, 1);
    expect(grid.some((c) => c.frozen && c.date === "2026-11-19")).toBe(true);
    expect(grid.some((c) => c.frozen && c.date === "2026-11-17")).toBe(false); // ya agotó el descanso
    expect(heatmap(sessions, 8, today, 0).some((c) => c.frozen)).toBe(false);
  });

  it("heatLevel traduce puntadas o minutos a 4 niveles", () => {
    const punt = (n: number) => ({ date: "x", stitches: n, minutes: 0, frozen: false });
    const min = (n: number) => ({ date: "x", stitches: 0, minutes: n, frozen: false });
    expect([0, 10, 60, 200, 400].map((v) => heatLevel(punt(v), "puntadas"))).toEqual([0, 1, 2, 3, 4]);
    expect([0, 30, 50, 100].map((v) => heatLevel(min(v), "minutos"))).toEqual([0, 2, 3, 4]);
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
