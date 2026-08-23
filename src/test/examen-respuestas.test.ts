import { describe, it, expect } from "vitest";
import {
  normalizarPreguntas, opcionesDe, indiceCorrecto, esVerdaderoFalso,
  revisarEntrega, notaColombiana, formatearDuracion, iniciales,
} from "@/lib/examen-respuestas";

/**
 * Tarea 10 — ver lo que respondió el estudiante.
 *
 * Estas funciones replican las de `supabase/functions/course-exam`, que es
 * quien califica. Si divergen, el informe le mostraría al docente una
 * respuesta distinta de la que se calificó: el peor fallo posible aquí,
 * porque nadie lo notaría hasta que un estudiante reclame.
 *
 * Los prompts han cambiado varias veces y en la base de datos conviven
 * exámenes con las claves en inglés y en español, con opciones como lista o
 * como objeto, y con la respuesta correcta guardada como número, como letra
 * o como el texto completo. Todo eso se cubre aquí.
 */

describe("Lectura de preguntas de examen", () => {
  it("encuentra las preguntas bajo cualquiera de las claves usadas", () => {
    expect(normalizarPreguntas({ questions: [1, 2] })).toHaveLength(2);
    expect(normalizarPreguntas({ preguntas: [1, 2, 3] })).toHaveLength(3);
    expect(normalizarPreguntas({ items: [1] })).toHaveLength(1);
    expect(normalizarPreguntas([1, 2, 3, 4])).toHaveLength(4);
    expect(normalizarPreguntas(null)).toEqual([]);
    expect(normalizarPreguntas({ titulo: "Sin preguntas" })).toEqual([]);
  });

  it("etiqueta las opciones en lista como A, B, C…", () => {
    const opciones = opcionesDe({ options: ["Mitocondria", "Núcleo", "Ribosoma"] });
    expect(opciones).toEqual([
      { label: "A", text: "Mitocondria" },
      { label: "B", text: "Núcleo" },
      { label: "C", text: "Ribosoma" },
    ]);
  });

  it("acepta opciones como objeto, que es como las devuelve a veces el modelo", () => {
    const opciones = opcionesDe({ opciones: { a: "Uno", b: "Dos" } });
    expect(opciones).toEqual([
      { label: "A", text: "Uno" },
      { label: "B", text: "Dos" },
    ]);
  });

  it("reconoce las de falso y verdadero aunque no traigan opciones", () => {
    const q = { enunciado: "El agua hierve a 100 °C", correcta: "verdadero" };
    expect(esVerdaderoFalso(q)).toBe(true);
    expect(opcionesDe(q)).toEqual([
      { label: "V", text: "Verdadero" },
      { label: "F", text: "Falso" },
    ]);
    expect(indiceCorrecto(q, opcionesDe(q))).toBe(0);
    expect(indiceCorrecto({ ...q, correcta: false }, opcionesDe(q))).toBe(1);
  });

  it("ubica la correcta venga como número, como letra o como texto", () => {
    const opciones = opcionesDe({ options: ["Mitocondria", "Núcleo", "Ribosoma"] });
    expect(indiceCorrecto({ correct: 1 }, opciones)).toBe(1);
    expect(indiceCorrecto({ correct: "B" }, opciones)).toBe(1);
    expect(indiceCorrecto({ correcta: "b" }, opciones)).toBe(1);
    expect(indiceCorrecto({ respuesta_correcta: "Núcleo" }, opciones)).toBe(1);
    expect(indiceCorrecto({ correct: "1" }, opciones)).toBe(1);
    // Sin respuesta correcta no se puede inventar una
    expect(indiceCorrecto({}, opciones)).toBe(-1);
  });
});

describe("Revisión de una entrega", () => {
  const examen = {
    questions: [
      {
        question: "¿Qué organelo produce la energía de la célula?",
        context: "Biología celular",
        options: ["Mitocondria", "Núcleo", "Ribosoma", "Lisosoma"],
        correct: 0,
        explanation: "La mitocondria produce ATP.",
      },
      {
        question: "¿Dónde está el ADN?",
        options: ["Citoplasma", "Núcleo"],
        correct: 1,
      },
    ],
  };

  const entrega = {
    answers: { 0: 0, 1: 0 },
    feedback: [
      { i: 0, userIdx: 0, correctIdx: 0, ok: true, correctText: "Mitocondria", explanation: "La mitocondria produce ATP." },
      { i: 1, userIdx: 0, correctIdx: 1, ok: false, correctText: "Núcleo", explanation: "" },
    ],
  };

  it("cruza el enunciado del examen con lo que marcó el estudiante", () => {
    const revisadas = revisarEntrega(examen, entrega);
    expect(revisadas).toHaveLength(2);

    expect(revisadas[0]).toMatchObject({
      numero: 1,
      enunciado: "¿Qué organelo produce la energía de la célula?",
      contexto: "Biología celular",
      marcada: 0,
      correcta: 0,
      acerto: true,
      explicacion: "La mitocondria produce ATP.",
    });
    expect(revisadas[0].opciones[0].text).toBe("Mitocondria");

    expect(revisadas[1]).toMatchObject({ numero: 2, marcada: 0, correcta: 1, acerto: false });
  });

  it("respeta la calificación guardada aunque el examen se edite después", () => {
    // El docente corrige la respuesta correcta de la primera pregunta DESPUÉS
    // de que el estudiante presentó. Recalcular le cambiaría la nota a algo
    // que él nunca vio.
    const editado = JSON.parse(JSON.stringify(examen));
    editado.questions[0].correct = 2;

    const revisadas = revisarEntrega(editado, entrega);
    expect(revisadas[0].correcta).toBe(0);
    expect(revisadas[0].acerto).toBe(true);
  });

  it("marca como en blanco las preguntas que el estudiante no respondió", () => {
    const sinResponder = {
      answers: { 0: 0 },
      feedback: [
        { i: 0, userIdx: 0, correctIdx: 0, ok: true },
        { i: 1, userIdx: -1, correctIdx: 1, ok: false },
      ],
    };
    const revisadas = revisarEntrega(examen, sinResponder);
    expect(revisadas[1].marcada).toBe(-1);
    expect(revisadas[1].acerto).toBe(false);
  });

  it("no se cae si el examen fue eliminado después de la entrega", () => {
    const revisadas = revisarEntrega(null, entrega);
    expect(revisadas).toHaveLength(2);
    expect(revisadas[0].enunciado).toMatch(/no disponible/i);
    // La calificación se conserva: es lo único que queda del examen
    expect(revisadas[0].acerto).toBe(true);
    expect(revisadas[1].acerto).toBe(false);
  });

  it("califica sin detalle guardado, comparando contra el examen", () => {
    const soloRespuestas = { answers: { 0: 1, 1: 1 } };
    const revisadas = revisarEntrega(examen, soloRespuestas);
    expect(revisadas[0].acerto).toBe(false);
    expect(revisadas[1].acerto).toBe(true);
  });

  it("devuelve una lista vacía para actividades que no son exámenes", () => {
    expect(revisarEntrega({ titulo: "Taller" }, { answers: {} })).toEqual([]);
  });
});

describe("Formato del informe", () => {
  it("convierte los aciertos a la escala colombiana de 1 a 5", () => {
    expect(notaColombiana(10, 10)).toBe("5.0");
    expect(notaColombiana(6, 10)).toBe("3.0");
    expect(notaColombiana(0, 10)).toBe("0.0");
    expect(notaColombiana(null, 10)).toBe("—");
    expect(notaColombiana(5, 0)).toBe("—");
  });

  it("muestra la duración en minutos y segundos", () => {
    expect(formatearDuracion(0)).toBe("0s");
    expect(formatearDuracion(45)).toBe("45s");
    expect(formatearDuracion(125)).toBe("2m 5s");
    expect(formatearDuracion(null)).toBe("—");
  });

  it("arma las iniciales del estudiante para el avatar", () => {
    expect(iniciales("Jhon Eduar Valderrama")).toBe("JE");
    expect(iniciales("Ana")).toBe("AN");
    expect(iniciales("  María  Fernanda  ")).toBe("MF");
    expect(iniciales(null)).toBe("?");
    expect(iniciales("")).toBe("?");
  });
});
