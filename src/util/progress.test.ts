import { describe, it, expect } from "vitest";
import type { Session } from "../types";
import {
  sessionStitches,
  sessionSpools,
  threadSpoolsUsed,
  threadProgress,
  isThreadComplete,
  streak,
  minutesThisMonth,
  episodesThisMonth,
  heatmap,
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

  it("suma minutos y episodios del mes", () => {
    const sessions = [
      s("2026-11-15T10:00:00Z", 45, [], { type: "serie", title: "Friends", episodes: 2 }),
      s("2026-11-05T10:00:00Z", 60, [], { type: "youtube" }),
      s("2026-10-30T10:00:00Z", 90, [], { type: "peli", title: "Amélie" }),
    ];
    expect(minutesThisMonth(sessions, today)).toBe(105);
    expect(episodesThisMonth(sessions, today)).toBe(2);
  });

  it("B2: el heatmap cubre 8 semanas alineadas en lunes con las puntadas por día", () => {
    const sessions = [
      s("2026-11-18T10:00:00Z", 20, [{ threadId: 1, stitches: 300 }]),
      s("2026-11-16T10:00:00Z", 10, [{ threadId: 1, stitches: 40 }]),
      s("2026-09-30T10:00:00Z", 15, [{ threadId: 1, stitches: 500 }]),
    ];
    const grid = heatmap(sessions, 8, today); // 2026-11-20 es viernes
    expect(grid.length).toBe(8);
    expect(grid.every((row) => row.length === 7)).toBe(true);
    expect(grid[0][0].date).toBe("2026-11-16"); // lunes de la semana actual
    expect(grid[0][2].stitches).toBe(300); // miércoles 18
    expect(grid[7][2].date).toBe("2026-09-30"); // 7 semanas antes
    expect(grid[7][2].stitches).toBe(500);
    const total = grid.reduce((sum, row) => sum + row.reduce((a, c) => a + c.stitches, 0), 0);
    expect(total).toBe(840);
  });
});
