import { describe, it, expect } from "vitest";
import { normalizarTipo } from "@/pages/resources/GenerateResource";

/**
 * El tipo de recurso que llega por la dirección.
 *
 * `/resources/generate?type=constructor` dejaba la pantalla en blanco. La
 * tabla que decide qué campos mostrar es un objeto corriente, y un objeto
 * hereda las claves de Object.prototype: `RESOURCE_FIELDS["constructor"]`
 * devuelve una función, no undefined. El `|| []` no saltaba y la línea
 * siguiente llamaba a `.includes()` sobre una función.
 *
 * No hacía falta mala intención: un enlace mal copiado bastaba.
 */
describe("normalizar el tipo que viene en la dirección", () => {
  const validos = ["icfes", "workshop", "slides", "lesson_plan", "rubric"];

  for (const t of validos) {
    it(`respeta "${t}"`, () => expect(normalizarTipo(t)).toBe(t));
  }

  const peligrosas = ["constructor", "toString", "valueOf", "hasOwnProperty", "__proto__"];
  for (const t of peligrosas) {
    it(`"${t}" no pasa por tipo válido`, () => {
      expect(normalizarTipo(t)).toBe("icfes");
      expect(validos).toContain(normalizarTipo(t));
    });
  }

  it("un tipo inventado cae en el de por defecto", () => {
    expect(normalizarTipo("no_existe")).toBe("icfes");
  });

  it("sin tipo, el de por defecto", () => {
    expect(normalizarTipo(null)).toBe("icfes");
    expect(normalizarTipo(undefined)).toBe("icfes");
    expect(normalizarTipo("")).toBe("icfes");
  });
});
