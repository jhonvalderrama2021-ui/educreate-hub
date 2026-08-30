import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResourceContentViewer } from "@/components/ResourceContentViewer";

/**
 * Todo el texto del recurso se puede corregir.
 *
 * El docente lo pidió así: "hay ciertas cosas que no deja editar, debe
 * dejarse editar todo el texto del recurso creado". Buena parte ya lo era,
 * pero quedaba fuera justo lo que uno ajusta antes de entrar al aula: el
 * propósito de cada fase, las acciones del docente y de los estudiantes, las
 * preguntas orientadoras, los criterios de evaluación, la tarea.
 *
 * La prueba busca cada texto por su valor y comprueba que esté dentro de un
 * campo escribible. Buscar por etiqueta no serviría: son listas, y la
 * etiqueta es la viñeta.
 */

/** El campo que contiene ese texto, o null si se pintó como texto muerto. */
function campoCon(valor: string): HTMLElement | null {
  const campos = [
    ...screen.queryAllByRole("textbox"),
  ] as HTMLInputElement[];
  return campos.find((c) => c.value === valor) ?? null;
}

const PLAN = {
  title: "La colmena Langstroth",
  grade: "9",
  duration: "90 minutos",
  topic: "Apicultura",
  subject: "Ciencias Naturales",
  standard: "Explico la estructura de los ecosistemas",
  dba: "DBA 3: relaciona estructura y función",
  objective: "Reconocer las partes de la colmena",
  learningGoals: ["Identificar el espacio abeja", "Explicar la rejilla excluidora"],
  priorKnowledge: ["Partes de un insecto"],
  materials: ["Ahumador", "Cuadros moviles"],
  phases: [{
    name: "Inicio",
    duration: "15 min",
    purpose: "Activar saberes previos sobre la colonia",
    teacherActions: ["Proyectar la foto de una colmena abierta"],
    studentActions: ["Nombrar lo que reconocen"],
    questions: ["Por que las obreras sellan los huecos?"],
    resources: "Video de dos minutos",
  }],
  differentiation: {
    support: "Entregar el esquema rotulado",
    extension: "Calcular la postura diaria de la reina",
  },
  evaluation: {
    type: "Formativa",
    instrument: "Lista de chequeo",
    criteria: [{ criterion: "Identifica partes", indicator: "Nombra al menos cinco" }],
  },
  homework: "Dibujar el corte de una colmena",
  references: ["Manual de apicultura andina, capitulo 3"],
};

const TALLER = {
  title: "Taller de la colmena",
  objective: "Reconocer el manejo del ahumador",
  duration: "2 horas",
  materials: ["Acicula de pino"],
  activities: [{
    number: 1,
    title: "Observacion guiada",
    purpose: "Que noten el espacio abeja",
    instructions: ["Medir la separacion entre cuadros", "Anotar en milimetros"],
    questions: ["Que pasa si el espacio es menor?"],
    product: "Tabla de mediciones",
    duration: "40 minutos",
  }],
  evaluation: {
    instrument: "Rubrica de observacion",
    criteria: [{ criterion: "Mide con cuidado", indicator: "Registra en milimetros" }],
  },
};

function montar(type: string, content: any, editable = true) {
  const onContentChange = vi.fn();
  render(
    <ResourceContentViewer
      type={type}
      content={content}
      editable={editable}
      onContentChange={onContentChange}
    />,
  );
  return { onContentChange };
}

describe("editar el plan de clase", () => {
  /*
   * Cada uno de estos textos se pintaba antes como texto muerto. Se listan
   * uno por uno y no en bloque: si mañana se rompe solo la evaluación, la
   * prueba debe decir "la evaluación", no "algo del plan de clase".
   */
  const debenSerEditables: [string, string][] = [
    ["el estándar", PLAN.standard],
    ["el DBA", PLAN.dba],
    ["una meta de aprendizaje", PLAN.learningGoals[0]],
    ["un saber previo", PLAN.priorKnowledge[0]],
    ["un material", PLAN.materials[0]],
    ["la duración de la fase", PLAN.phases[0].duration],
    ["el propósito de la fase", PLAN.phases[0].purpose],
    ["una acción del docente", PLAN.phases[0].teacherActions[0]],
    ["una acción de los estudiantes", PLAN.phases[0].studentActions[0]],
    ["una pregunta orientadora", PLAN.phases[0].questions[0]],
    ["el apoyo adicional", PLAN.differentiation.support],
    ["el reto de profundización", PLAN.differentiation.extension],
    ["el tipo de evaluación", PLAN.evaluation.type],
    ["el instrumento", PLAN.evaluation.instrument],
    ["un criterio", PLAN.evaluation.criteria[0].criterion],
    ["su indicador", PLAN.evaluation.criteria[0].indicator],
    ["la tarea", PLAN.homework],
    ["una referencia", PLAN.references[0]],
  ];

  for (const [nombre, valor] of debenSerEditables) {
    it(`deja editar ${nombre}`, () => {
      montar("lesson_plan", PLAN);
      expect(campoCon(valor), `"${valor}" no está en un campo escribible`).not.toBeNull();
    });
  }

  it("escribir en una acción del docente avisa del cambio en su sitio exacto", async () => {
    const user = userEvent.setup();
    const { onContentChange } = montar("lesson_plan", PLAN);

    const campo = campoCon(PLAN.phases[0].teacherActions[0])!;
    await user.type(campo, "!");

    // Lo que importa no es que avise, sino que escriba en la ranura correcta:
    // una ruta mal armada corrompería otra parte del plan sin decir nada.
    expect(onContentChange).toHaveBeenCalled();
    const ultimo = onContentChange.mock.calls.at(-1)![0];
    expect(ultimo.phases[0].teacherActions[0]).toBe(PLAN.phases[0].teacherActions[0] + "!");
    expect(ultimo.phases[0].studentActions[0]).toBe(PLAN.phases[0].studentActions[0]);
    expect(ultimo.homework).toBe(PLAN.homework);
  });

  it("sin editable no muestra ningún campo: es solo lectura", () => {
    montar("lesson_plan", PLAN, false);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    // Y el texto se sigue viendo.
    expect(screen.getByText(PLAN.homework, { exact: false })).toBeInTheDocument();
  });
});

describe("editar el taller", () => {
  const debenSerEditables: [string, string][] = [
    ["el propósito de la actividad", TALLER.activities[0].purpose],
    ["un paso de las instrucciones", TALLER.activities[0].instructions[0]],
    ["una pregunta orientadora", TALLER.activities[0].questions[0]],
    ["el producto esperado", TALLER.activities[0].product],
    ["la duración de la actividad", TALLER.activities[0].duration],
    ["el instrumento de evaluación", TALLER.evaluation.instrument],
    ["un criterio", TALLER.evaluation.criteria[0].criterion],
    ["su indicador", TALLER.evaluation.criteria[0].indicator],
  ];

  for (const [nombre, valor] of debenSerEditables) {
    it(`deja editar ${nombre}`, () => {
      montar("workshop", TALLER);
      expect(campoCon(valor), `"${valor}" no está en un campo escribible`).not.toBeNull();
    });
  }

  it("corregir un paso no toca los demás", async () => {
    const user = userEvent.setup();
    const { onContentChange } = montar("workshop", TALLER);

    await user.type(campoCon(TALLER.activities[0].instructions[1])!, "X");

    const ultimo = onContentChange.mock.calls.at(-1)![0];
    expect(ultimo.activities[0].instructions[1]).toBe(TALLER.activities[0].instructions[1] + "X");
    expect(ultimo.activities[0].instructions[0]).toBe(TALLER.activities[0].instructions[0]);
  });
});
