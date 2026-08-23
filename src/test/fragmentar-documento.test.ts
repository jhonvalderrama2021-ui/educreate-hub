import { describe, it, expect } from "vitest";
import {
  partirEnFragmentos, TAMANO_FRAGMENTO, SOLAPE,
} from "../../supabase/functions/_compartido/fragmentar";

/**
 * Partición de documentos para los bots (último punto de la tarea 8).
 *
 * Esta función decide qué texto se convierte en cada vector. Si corta mal, el
 * bot responde mal y el fallo es dificilísimo de rastrear: los vectores no se
 * pueden leer a simple vista, así que el síntoma es solo "el bot contesta
 * cosas raras".
 *
 * Lo que más importa aquí es que el bucle **siempre avance**. Un corte
 * desafortunado que no avanzara dejaría la Edge Function girando hasta
 * agotarse, con la clave de OpenAI de por medio.
 */

const repetir = (frase: string, veces: number) => Array(veces).fill(frase).join(" ");

describe("Partición de un documento en fragmentos", () => {
  it("no parte lo que ya cabe en un fragmento", () => {
    const texto = "El área de Ciencias se organiza en cuatro periodos.";
    expect(partirEnFragmentos(texto)).toEqual([texto]);
  });

  it("normaliza los espacios y saltos de línea del PDF", () => {
    // pdf-extract entrega el texto con saltos y espacios irregulares
    expect(partirEnFragmentos("  El   agua\n\n  hierve.  ")).toEqual(["El agua hierve."]);
  });

  it("devuelve una lista vacía para un texto sin contenido", () => {
    expect(partirEnFragmentos("")).toEqual([]);
    expect(partirEnFragmentos("   \n\n  ")).toEqual([]);
    expect(partirEnFragmentos(null as any)).toEqual([]);
    expect(partirEnFragmentos(undefined as any)).toEqual([]);
  });

  it("parte un documento largo en varios fragmentos", () => {
    const texto = repetir("El río Mulato atraviesa el municipio de Mocoa.", 300);
    const fragmentos = partirEnFragmentos(texto);

    expect(fragmentos.length).toBeGreaterThan(1);
    for (const f of fragmentos) {
      expect(f.length).toBeGreaterThan(0);
      expect(f.length).toBeLessThanOrEqual(TAMANO_FRAGMENTO);
    }
  });

  it("corta al final de una frase cuando puede, no a mitad de palabra", () => {
    const texto = repetir("Los estudiantes miden la turbidez del agua del río.", 200);
    const fragmentos = partirEnFragmentos(texto);

    // Todos menos el último deben cerrar en punto
    for (const f of fragmentos.slice(0, -1)) {
      expect(f.endsWith(".")).toBe(true);
    }
  });

  it("solapa los fragmentos para no perder una idea partida por la mitad", () => {
    const texto = repetir("Cada periodo dura diez semanas en la institución.", 200);
    const fragmentos = partirEnFragmentos(texto);
    expect(fragmentos.length).toBeGreaterThan(1);

    // El final de un fragmento reaparece al comienzo del siguiente
    const colaPrimero = fragmentos[0].slice(-Math.floor(SOLAPE / 2));
    expect(fragmentos[1]).toContain(colaPrimero.trim().split(" ").slice(-3).join(" "));
  });

  it("cubre todo el documento sin dejar huecos", () => {
    const texto = repetir("La bitácora del naturalista es obligatoria.", 250);
    const fragmentos = partirEnFragmentos(texto);

    // Con solape, la suma de longitudes supera al original pero nunca es menor:
    // si fuera menor, parte del documento se habría perdido.
    const suma = fragmentos.reduce((a, f) => a + f.length, 0);
    expect(suma).toBeGreaterThanOrEqual(texto.replace(/\s+/g, " ").trim().length);
  });

  it("avanza siempre, aunque el texto no tenga ni un solo punto", () => {
    // Sin puntos no hay corte natural: es el caso que podría dejar el bucle
    // girando si el solape se comiera todo el avance.
    const texto = "palabra ".repeat(2000).trim();
    const fragmentos = partirEnFragmentos(texto);

    expect(fragmentos.length).toBeGreaterThan(1);
    expect(fragmentos.length).toBeLessThan(100);
  });

  it("no se atasca con un texto sin espacios", () => {
    const texto = "a".repeat(5000);
    const fragmentos = partirEnFragmentos(texto);

    expect(fragmentos.length).toBe(Math.ceil((5000 - SOLAPE) / (TAMANO_FRAGMENTO - SOLAPE)));
    expect(fragmentos.every((f) => f.length <= TAMANO_FRAGMENTO)).toBe(true);
  });

  it("conserva el contenido de un documento realista", () => {
    const plan = [
      "PLAN DE ÁREA DE CIENCIAS NATURALES.",
      repetir("El área se organiza en cuatro periodos académicos de diez semanas.", 30),
      "El proyecto transversal se llama Guardianes del Río Mulato.",
      repetir("Los estudiantes de octavo realizan tres salidas de campo al año.", 30),
      "El laboratorio cuenta con doce microscopios monoculares.",
    ].join(" ");

    const fragmentos = partirEnFragmentos(plan);
    const todo = fragmentos.join(" ");

    // Los datos concretos son justamente lo que el bot debe poder recuperar
    expect(todo).toContain("Guardianes del Río Mulato");
    expect(todo).toContain("doce microscopios monoculares");
    expect(todo).toContain("PLAN DE ÁREA DE CIENCIAS NATURALES");
  });
});
