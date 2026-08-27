import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  TIPOS_SOLO_DOCENTE,
  TIPOS_ABIERTOS,
  esSoloDeDocente,
  puedeGenerar,
  NOMBRE_DEL_TIPO,
} from "@/lib/permisos";

/**
 * Quien puede generar que.
 *
 * La lista existe dos veces a proposito: una para el navegador, que decide
 * que botones pintar, y otra en la funcion de servidor, que es la que de
 * verdad manda. Duplicar es el precio de que el servidor no dependa del
 * codigo del cliente, pero el riesgo es evidente: alguien agrega un tipo
 * nuevo en un lado y se olvida del otro.
 *
 * Si eso pasara, el fallo seria silencioso y de los peores: un modulo que no
 * aparece en el menu pero que si se puede usar escribiendo la direccion.
 * Estas pruebas lo convierten en un fallo ruidoso.
 */

const RUTA_SERVIDOR = resolve(__dirname, "../../supabase/functions/_compartido/permisos.ts");

function tiposDelServidor(): string[] {
  const fuente = readFileSync(RUTA_SERVIDOR, "utf8");
  const bloque = fuente.match(/TIPOS_SOLO_DOCENTE = new Set\(\[([\s\S]*?)\]\)/);
  if (!bloque) throw new Error("No se encontro TIPOS_SOLO_DOCENTE en el modulo del servidor");
  return [...bloque[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

describe("permisos de generacion", () => {
  it("el navegador y el servidor prohiben exactamente lo mismo", () => {
    // Ordenados: lo que importa es el conjunto, no en que orden se escribio.
    expect([...tiposDelServidor()].sort()).toEqual([...TIPOS_SOLO_DOCENTE].sort());
  });

  it("ningun tipo esta a la vez abierto y reservado", () => {
    const reservados = new Set<string>(TIPOS_SOLO_DOCENTE);
    const solapados = TIPOS_ABIERTOS.filter((t) => reservados.has(t));
    expect(solapados).toEqual([]);
  });

  it("cada tipo tiene nombre en español para poder explicar la negativa", () => {
    // Sin esto la pantalla diria "lesson_plan: solo para docentes", que no
    // le dice nada a un estudiante.
    const sinNombre = [...TIPOS_SOLO_DOCENTE, ...TIPOS_ABIERTOS].filter((t) => !NOMBRE_DEL_TIPO[t]);
    expect(sinNombre).toEqual([]);
  });

  it("lo que el docente encontro abierto sigue cerrado para el estudiante", () => {
    // Los cuatro casos concretos del reporte: el panel principal se los
    // ofrecia y el servidor los generaba.
    for (const tipo of ["icfes", "lesson_plan", "workshop", "rubric"]) {
      expect(esSoloDeDocente(tipo), tipo).toBe(true);
      expect(puedeGenerar(tipo, false), tipo).toBe(false);
      expect(puedeGenerar(tipo, true), tipo).toBe(true);
    }
  });

  it("el estudiante conserva lo suyo", () => {
    // El docente fue explicito: diapositivas, bots, crucigramas y cuentos
    // "eso esta bien". Cerrarlos de mas seria romper lo que ya funcionaba.
    for (const tipo of ["slides", "crossword", "story"]) {
      expect(esSoloDeDocente(tipo), tipo).toBe(false);
      expect(puedeGenerar(tipo, false), tipo).toBe(true);
    }
  });

  it("un tipo desconocido no queda abierto por descuido", () => {
    // Si mañana llega un tipo nuevo sin clasificar, es preferible que quede
    // permitido y falle en el servidor a que rompa la pantalla; pero la
    // prueba de sincronia de arriba obliga a clasificarlo igual.
    expect(esSoloDeDocente("tipo_que_no_existe")).toBe(false);
    expect(esSoloDeDocente(null)).toBe(false);
    expect(esSoloDeDocente(undefined)).toBe(false);
  });
});
