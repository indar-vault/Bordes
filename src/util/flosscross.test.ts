import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { parseFlosscross } from "./flosscross";

/**
 * Fixtures sintéticos que replican la estructura real de .fcjson
 * (los archivos reales son privados y no se commitean, decisión #7).
 * Convención verificada: 0 = celda vacía; k>0 = índice directo en flossIndexes.
 */
const fixture = {
  info: { title: "Flor de lis" },
  model: {
    images: [
      {
        width: 2,
        height: 2,
        // El índice 0 queda reservado por la celda vacía: en Flosscross el
        // primer color declarado nunca aparece en la rejilla.
        flossIndexes: [
          { rgb: [255, 255, 255], id: "0", name: "Blank" },
          { rgb: [255, 0, 0], id: "03", name: "Red" },
          { rgb: [0, 0, 255], id: "BLANC", name: "Blue" },
          { rgb: [0, 255, 0], id: "745", name: "Unused green" },
        ],
        sources: [{ id: "img1", pos: [0, 0], size: [2, 2], visible: true }],
        layers: [{ width: 2, height: 2, cross: [0, 1, 1, 2], backstitch: [] }],
      },
    ],
  },
  srcs: [{ id: "img1", src: "data:image/png;base64,AAAA" }],
};

describe("parseFlosscross", () => {
  it("extrae nombre, rejilla, total y puntadas por color", () => {
    const p = parseFlosscross(JSON.stringify(fixture));
    expect(p.name).toBe("Flor de lis");
    expect(p.width).toBe(2);
    expect(p.height).toBe(2);
    expect(p.totalStitches).toBe(3); // 4 celdas - 1 vacía
    expect(p.colors.length).toBe(2); // el verde declarado pero sin puntadas se descarta
    expect(p.colors[0]).toEqual({ color: "#ff0000", name: "Red", dmc: "03", totalStitches: 2 });
    expect(p.colors[1]).toEqual({ color: "#0000ff", name: "Blue", dmc: "BLANC", totalStitches: 1 });
  });

  it("conserva DMC raros como '03' o 'BLANC'", () => {
    const p = parseFlosscross(JSON.stringify(fixture));
    expect(p.colors.map((c) => c.dmc)).toEqual(["03", "BLANC"]);
  });

  it("incluye la imagen embebida cuando viene", () => {
    const p = parseFlosscross(JSON.stringify(fixture));
    expect(p.image).toBe("data:image/png;base64,AAAA");
  });

  it("no falla si el archivo no trae imagen (srcs vacío)", () => {
    const sinSrcs = structuredClone(fixture);
    sinSrcs.srcs = [];
    const p = parseFlosscross(JSON.stringify(sinSrcs));
    expect(p.image).toBeUndefined();
    expect(p.totalStitches).toBe(3);
  });

  it("un patrón totalmente vacío da 0 puntadas y 0 colores", () => {
    const vacio = structuredClone(fixture);
    vacio.model.images[0].layers[0].cross = [0, 0, 0, 0];
    const p = parseFlosscross(JSON.stringify(vacio));
    expect(p.totalStitches).toBe(0);
    expect(p.colors.length).toBe(0);
  });

  it("lanza errores claros para archivos inválidos", () => {
    expect(() => parseFlosscross("hola")).toThrow("no es un JSON válido");
    expect(() => parseFlosscross("{}")).toThrow("No parece un patrón Flosscross");
    expect(() => parseFlosscross('{"model":{"images":[{}]}}')).toThrow("No parece un patrón Flosscross");
  });
});

/**
 * Verificación contra exportaciones REALES (privadas). No se ejecutan en CI:
 * solo si BORES_REAL_FCJSON apunta a un directorio local con archivos .fcjson.
 */
const realDir = process.env.BORES_REAL_FCJSON;
if (realDir) {
  describe("parseFlosscross (archivos reales locales)", () => {
    for (const name of readdirSync(realDir)) {
      if (!name.endsWith(".fcjson")) continue;
      it(`importa ${name} sin romper la coherencia interna`, () => {
        const p = parseFlosscross(readFileSync(`${realDir}/${name}`, "utf8"));
        const sum = p.colors.reduce((a, c) => a + c.totalStitches, 0);
        expect(p.totalStitches).toBe(sum);
        expect(p.colors.length).toBeGreaterThan(0);
        expect(p.width * p.height).toBeGreaterThanOrEqual(p.totalStitches);
      });
    }
  });
}
