import { describe, it, expect } from "vitest";
import { DMC, findDmc, dmcAutoFill } from "./dmc";

describe("catálogo DMC", () => {
  it("contiene los 489 colores", () => {
    expect(DMC.length).toBe(489);
  });

  it("resuelve el código y devuelve nombre y hex", () => {
    const d = findDmc("415");
    expect(d?.name).toBe("Pearl Gray");
    expect(d?.hex).toBe("#D3D3D6");
  });

  it("admite ceros a la izquierda y el prefijo DMC", () => {
    expect(findDmc("03")?.name).toBe("Tin Medium");
    expect(findDmc("DMC 743")?.name).toBe("Yellow Medium");
  });

  it("no encuentra códigos inexistentes o no numéricos", () => {
    expect(findDmc("BLANC")).toBeUndefined();
    expect(findDmc("9999")).toBeUndefined();
    expect(findDmc("")).toBeUndefined();
  });

  it("autocompleta nombre y color, respetando nombres escritos a mano", () => {
    expect(dmcAutoFill("", "415")).toEqual({ color: "#D3D3D6", name: "Pearl Gray" });
    // Un nombre que ya es de un color DMC se refresca al cambiar el código.
    expect(dmcAutoFill("Pearl Gray", "743")).toEqual({ color: "#FED376", name: "Yellow Medium" });
    // Un nombre personal no se toca, pero el color sí.
    expect(dmcAutoFill("Mi gris", "415")).toEqual({ color: "#D3D3D6", name: "Mi gris" });
    expect(dmcAutoFill("Mi gris", "BLANC")).toEqual({});
  });
});
