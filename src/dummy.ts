// Datos falsos del wireframe, basados en el patrón real de Flosscross
// (docs/flosscross-ejemplo/exportacion/Olivia rodrigo_jpg.fcjson):
// grid 55x55 = 3025 puntadas, 6 colores DMC.

export interface DummyProject {
  name: string;
  totalStitches: number;
  doneStitches: number;
  threads: { color: string; name: string; dmc: string; total: number; done: number }[];
  streak: number;
  monthMinutes: number;
  monthEpisodes: number;
  monthSeries: string;
  sessions: {
    date: string;
    summary: string;
    detail: string;
  }[];
  miniProjects: { name: string; done: number; total: number }[];
}

export const DUMMY: DummyProject = {
  name: "Olivia Rodrigo",
  totalStitches: 3025,
  doneStitches: 861,
  threads: [
    { color: "#9FA6B1", name: "Pearl Gray", dmc: "415", total: 2615, done: 700 },
    { color: "#C7395E", name: "Shell Pink - Very Light", dmc: "224", total: 145, done: 145 },
    { color: "#7F7B7A", name: "Pewter Gray - Dark", dmc: "413", total: 132, done: 120 },
    { color: "#E1AFAC", name: "Desert Sand - Light", dmc: "950", total: 83, done: 30 },
    { color: "#F3DCDC", name: "Shell Pink - Ultra Very Light", dmc: "225", total: 37, done: 6 },
    { color: "#FCFDFD", name: "Snow White", dmc: "B5200", total: 13, done: 0 },
  ],
  streak: 4,
  monthMinutes: 495,
  monthEpisodes: 8,
  monthSeries: "Friends",
  sessions: [
    { date: "2026-11-20", summary: "150 puntadas · 45 min", detail: "Pearl Gray 150 · Serie: Friends (2 eps)" },
    { date: "2026-11-19", summary: "120 puntadas · 40 min", detail: "Pearl Gray 100 · Pewter Gray 20 · Película: Amélie" },
    { date: "2026-11-18", summary: "210 puntadas · 60 min", detail: "Pearl Gray 200 · Shell Pink 10 · Serie: Friends (3 eps)" },
    { date: "2026-11-16", summary: "381 puntadas · 80 min", detail: "Pearl Gray 250 · Pewter Gray 100 · Shell Pink 31 · YouTube" },
  ],
  miniProjects: [
    { name: "Flor de lis (regalo a Marta)", done: 980, total: 1800 },
    { name: "Osito de la guardería", done: 450, total: 1200 },
  ],
};
