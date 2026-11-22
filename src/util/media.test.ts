import { describe, it, expect } from "vitest";
import type { Session } from "../types";
import { findMedia, mediaSuggestions, titlesFor } from "./media";

const s = (date: string, media?: Session["media"]): Session => ({
  projectId: 1,
  date,
  durationMin: 10,
  entries: [],
  media,
});

describe("historial de media (D1)", () => {
  const sessions = [
    s("2026-11-18T10:00:00+01:00", { type: "serie", title: "Friends", episodes: 2 }),
    s("2026-11-19T10:00:00+01:00", { type: "serie", title: "friends", episodes: 3 }),
    s("2026-11-20T10:00:00+01:00", { type: "youtube", title: "Charli XCX" }),
    s("2026-11-21T10:00:00+01:00", { type: "serie" }),
    s("2026-11-22T10:00:00+01:00", { type: "peli", title: "   " }),
  ];

  it("une títulos repetidos ignorando mayúsculas y espacios", () => {
    const hist = mediaSuggestions(sessions);
    const friends = hist.find((m) => m.type === "serie" && m.title.toLowerCase() === "friends");
    expect(friends?.count).toBe(2);
    expect(hist.length).toBe(2); // solo Friends y Charli XCX tienen nombre
  });

  it("ordena por uso más reciente y guarda los episodios de la última vez", () => {
    const hist = mediaSuggestions(sessions);
    expect(hist[0].title).toBe("Charli XCX");
    const friends = hist[1];
    expect(friends.lastDate).toBe("2026-11-19T10:00:00+01:00");
    expect(friends.lastEpisodes).toBe(3);
  });

  it("titlesFor filtra por tipo", () => {
    expect(titlesFor(mediaSuggestions(sessions), "serie")).toEqual(["Friends"]);
    expect(titlesFor(mediaSuggestions(sessions), "youtube")).toEqual(["Charli XCX"]);
  });

  it("findMedia busca sin importar mayúsculas y no inventa nada", () => {
    const hist = mediaSuggestions(sessions);
    expect(findMedia(hist, "serie", "  FRIENDS ")?.lastEpisodes).toBe(3);
    expect(findMedia(hist, "serie", "Friends")?.count).toBe(2);
    expect(findMedia(hist, "serie", "")).toBeUndefined();
    expect(findMedia(hist, "peli", "Friends")).toBeUndefined();
  });
});
