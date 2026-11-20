import { describe, it, expect } from "vitest";
import type { Session } from "../types";
import {
  sessionStitches,
  threadProgress,
  isThreadComplete,
  streak,
  minutesThisMonth,
  episodesThisMonth,
} from "./progress";

const s = (date: string, durationMin: number, entries: { threadId: number; stitches: number }[], media?: Session["media"]): Session =>
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
});
