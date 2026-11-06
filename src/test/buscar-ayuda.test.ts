import { describe, it, expect } from "vitest";
import {
  normalizar, coincide, textoDelModulo, buscarEnAyuda,
  type ModuloAyuda, type ProblemaAyuda,
} from "@/lib/buscar-ayuda";

/**
 * Busqueda del centro de ayuda.
 *
 * La guia existia pero habia que recorrer trece secciones desplegables a ojo.
 * Lo que estas pruebas protegen es que la busqueda sirva a quien no conoce el
 * vocabulario de la plataforma: alguien que escribe "rubrica" sin tilde, o que
 * busca por el problema que tiene ("pdf no funciona") en vez de por el nombre
 * del modulo, tiene que encontrar el apartado igual.
 */

const MODULOS: ModuloAyuda[] = [
  {
    id: "examenes",
    titulo: "Exámenes",
    paraQue: "Genera exámenes de selección múltiple tipo ICFES.",
    campos: [{ nombre: "Número de preguntas", explicacion: "Cuántas preguntas tendrá la evaluación." }],
    ejemploBien: "Competencias ciudadanas para grado 9",
    consejo: "Revisa siempre las respuestas marcadas como correctas.",
  },
  {
    id: "rubricas",
    titulo: "Rúbricas",
    paraQue: "Crea rúbricas de evaluación por criterios y niveles de desempeño.",
  },
  {
    id: "pdf",
    titulo: "Usar tu propio documento como base",
    paraQue: "Sube un PDF o un Word y la plataforma saca el contenido de ahí.",
  },
];

const PRIMEROS: ModuloAyuda[] = [
  { id: "generar", titulo: "Cómo crear tu primer recurso", paraQue: "Todos los módulos funcionan igual." },
];

const PROBLEMAS: ProblemaAyuda[] = [
  { p: "Dice que el archivo tiene 0 caracteres", r: "Tu PDF es una imagen o un escaneo, no tiene texto seleccionable." },
  { p: "La generación tarda mucho", r: "Los recursos extensos pueden tardar cerca de un minuto." },
];

const buscar = (q: string) => buscarEnAyuda(q, PRIMEROS, MODULOS, PROBLEMAS);

describe("Normalización", () => {
  it("quita tildes y mayúsculas", () => {
    expect(normalizar("Rúbricas")).toBe("rubricas");
    expect(normalizar("EXÁMENES")).toBe("examenes");
    expect(normalizar("Evaluación")).toBe("evaluacion");
  });

  it("también deshace la eñe, para que «nino» encuentre «niño»", () => {
    // Efecto de descomponer en Unicode: la ñ se separa en n + tilde y la
    // tilde se descarta. Conviene en una búsqueda, porque en el teclado del
    // aula la ñ se escribe mal a menudo. El precio es que «año» y «ano» se
    // confunden, algo inocuo en un buscador de ayuda.
    expect(normalizar("Año")).toBe("ano");
    expect(normalizar("Niño")).toBe("nino");
  });
});

describe("Coincidencia", () => {
  it("exige todas las palabras, no una cualquiera", () => {
    const texto = normalizar("Genera exámenes de selección múltiple tipo ICFES");
    expect(coincide(texto, "examen icfes")).toBe(true);
    expect(coincide(texto, "examen rubrica")).toBe(false);
  });

  it("una consulta vacía no filtra nada", () => {
    expect(coincide("lo que sea", "")).toBe(true);
    expect(coincide("lo que sea", "   ")).toBe(true);
  });
});

describe("Búsqueda en la ayuda", () => {
  it("sin consulta devuelve la ayuda completa y no se declara filtrando", () => {
    const r = buscar("");
    expect(r.filtrando).toBe(false);
    expect(r.modulos).toHaveLength(3);
    expect(r.problemas).toHaveLength(2);
    expect(r.total).toBe(6);
  });

  it("encuentra el módulo aunque se escriba sin tilde", () => {
    expect(buscar("rubrica").modulos.map((m) => m.id)).toEqual(["rubricas"]);
    expect(buscar("examenes").modulos.map((m) => m.id)).toEqual(["examenes"]);
  });

  it("busca dentro de los campos y los consejos, no solo en el título", () => {
    expect(buscar("número de preguntas").modulos.map((m) => m.id)).toEqual(["examenes"]);
    expect(buscar("respuestas correctas").modulos.map((m) => m.id)).toEqual(["examenes"]);
  });

  it("encuentra la pregunta frecuente por el problema, no por su nombre", () => {
    const r = buscar("escaneo");
    expect(r.problemas).toHaveLength(1);
    expect(r.problemas[0].p).toMatch(/0 caracteres/);
  });

  it("una misma consulta puede traer resultados de varias secciones", () => {
    const r = buscar("pdf");
    expect(r.modulos.length).toBeGreaterThan(0);
    expect(r.problemas.length).toBeGreaterThan(0);
    expect(r.total).toBe(r.primerosPasos.length + r.modulos.length + r.problemas.length);
  });

  it("informa cero cuando nada coincide, en vez de devolver todo", () => {
    const r = buscar("fotosíntesis");
    expect(r.total).toBe(0);
    expect(r.filtrando).toBe(true);
    expect(r.modulos).toHaveLength(0);
  });

  it("los espacios de más no cambian el resultado", () => {
    expect(buscar("  rubrica  ").total).toBe(buscar("rubrica").total);
  });
});

describe("Texto consultable del módulo", () => {
  it("incluye todas las partes, no solo el título", () => {
    const texto = textoDelModulo(MODULOS[0]);
    expect(texto).toContain("examenes");
    expect(texto).toContain("icfes");
    expect(texto).toContain("numero de preguntas");
    expect(texto).toContain("grado 9");
    expect(texto).toContain("respuestas marcadas");
  });

  it("no falla cuando el módulo trae solo lo mínimo", () => {
    expect(() => textoDelModulo({ id: "x", titulo: "T", paraQue: "P" })).not.toThrow();
  });
});
