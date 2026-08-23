import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResourceContentViewer } from "@/components/ResourceContentViewer";

/**
 * Regresión: al enriquecer los prompts, varios campos pasaron de texto a
 * objeto o a lista (`evaluation`, `instructions`, `differentiation`). El visor
 * seguía pasándolos como texto, React intentaba renderizar un objeto y la
 * página quedaba en blanco.
 *
 * Estas pruebas cubren el formato nuevo y el anterior, porque en la base de
 * datos conviven recursos generados antes y después del cambio.
 */

const tallerNuevo = {
  title: "Taller de fracciones",
  subject: "Matemáticas",
  grade: "5",
  methodology: "Aprendizaje Basado en Problemas",
  objective: "Resolver situaciones con fracciones",
  learningGoals: ["Representar fracciones", "Comparar fracciones"],
  duration: "90 minutos",
  groupOrganization: "Grupos de 4",
  materials: ["30 tarjetas de cartulina", "6 pliegos de papel"],
  activities: [
    {
      number: 1,
      title: "Repartir la pizza",
      duration: "30 minutos",
      purpose: "Activar saberes previos",
      instructions: ["Formar grupos de 4", "Entregar la ficha", "Registrar en la tabla"],
      questions: ["¿En cuántas partes iguales dividimos?"],
      product: "Tabla con los repartos",
    },
  ],
  differentiation: { support: "Usar material concreto", extension: "Fracciones equivalentes" },
  evaluation: {
    instrument: "Lista de chequeo",
    criteria: [{ criterion: "Representa fracciones", indicator: "Divide la figura en partes iguales" }],
  },
};

const tallerAnterior = {
  title: "Taller antiguo",
  objective: "Objetivo del taller",
  duration: "60 minutos",
  materials: ["Cartulina"],
  activities: [
    { number: 1, title: "Actividad", description: "Descripción de la actividad", instructions: "Paso a paso en texto", duration: "20 min" },
  ],
  evaluation: "Se evaluará mediante observación directa",
};

const planNuevo = {
  title: "Plan de clase",
  grade: "8",
  duration: "60 minutos",
  topic: "Sistema circulatorio",
  objective: "Comprender la circulación",
  learningGoals: ["Identificar los componentes"],
  priorKnowledge: ["Concepto de célula"],
  materials: ["Láminas"],
  phases: [
    {
      name: "Inicio",
      duration: "10 minutos",
      purpose: "Activar saberes",
      teacherActions: ["Proyectar el esquema"],
      studentActions: ["Observar y anotar"],
      questions: ["¿Qué transporta la sangre?"],
    },
  ],
  differentiation: { support: "Apoyo visual", extension: "Investigar patologías" },
  evaluation: {
    type: "Formativa",
    instrument: "Ficha de salida",
    criteria: [{ criterion: "Identifica órganos", indicator: "Nombra corazón y pulmones" }],
  },
  homework: "Dibujar el recorrido de la sangre",
  references: ["Texto guía de Ciencias Naturales grado 8"],
};

const planAnterior = {
  title: "Plan antiguo",
  grade: "6",
  duration: "1 hora",
  objective: "Objetivo",
  phases: [{ name: "Inicio", duration: "10 minutos", activities: "Presentación del tema", resources: "Proyector" }],
  evaluation: "Observación durante la actividad",
};

describe("ResourceContentViewer", () => {
  it("renderiza un taller en formato nuevo sin romperse", () => {
    render(<ResourceContentViewer type="workshop" content={tallerNuevo} />);
    expect(screen.getByText("Repartir la pizza")).toBeInTheDocument();
    expect(screen.getByText("Formar grupos de 4")).toBeInTheDocument();
    expect(screen.getByText("Lista de chequeo", { exact: false })).toBeInTheDocument();
  });

  it("sigue renderizando un taller en formato anterior", () => {
    render(<ResourceContentViewer type="workshop" content={tallerAnterior} />);
    expect(screen.getByText("Descripción de la actividad")).toBeInTheDocument();
    expect(screen.getByText("Se evaluará mediante observación directa", { exact: false })).toBeInTheDocument();
  });

  it("renderiza un plan de clase en formato nuevo sin romperse", () => {
    render(<ResourceContentViewer type="lesson_plan" content={planNuevo} />);
    expect(screen.getByText("Proyectar el esquema")).toBeInTheDocument();
    expect(screen.getByText("Ficha de salida", { exact: false })).toBeInTheDocument();
  });

  it("sigue renderizando un plan de clase en formato anterior", () => {
    render(<ResourceContentViewer type="lesson_plan" content={planAnterior} />);
    expect(screen.getByText("Presentación del tema")).toBeInTheDocument();
    expect(screen.getByText("Observación durante la actividad", { exact: false })).toBeInTheDocument();
  });

  it("no falla cuando la evaluación viene como objeto en cualquiera de los dos tipos", () => {
    // Es exactamente el caso que dejaba la pantalla en blanco.
    for (const tipo of ["workshop", "lesson_plan"]) {
      const { unmount } = render(
        <ResourceContentViewer type={tipo} content={{ title: "x", evaluation: { instrument: "Rúbrica", criteria: [] } }} />,
      );
      expect(screen.getByText("Rúbrica", { exact: false })).toBeInTheDocument();
      unmount();
    }
  });
});


/**
 * El examen es el módulo donde el docente más edita: pide muchas preguntas y
 * descarta las que no le sirven. Al eliminar una, la numeración debe quedar
 * corrida y la hoja de respuestas coincidir con las preguntas restantes.
 */
describe("Examen: eliminar preguntas", () => {
  const examen = {
    title: "Examen de prueba",
    subject: "Ciencias",
    questions: [
      { number: 1, question: "Primera pregunta", options: { A: "a", B: "b" }, correct: "A" },
      { number: 2, question: "Segunda pregunta", options: { A: "a", B: "b" }, correct: "B" },
      { number: 3, question: "Tercera pregunta", options: { A: "a", B: "b" }, correct: "A" },
    ],
  };

  it("muestra el boton de eliminar solo en modo edicion", () => {
    const { unmount } = render(<ResourceContentViewer type="icfes" content={examen} />);
    expect(screen.queryByLabelText(/eliminar la pregunta/i)).toBeNull();
    unmount();

    render(<ResourceContentViewer type="icfes" content={examen} editable onContentChange={() => {}} />);
    expect(screen.getAllByLabelText(/eliminar la pregunta/i)).toHaveLength(3);
  });

  it("al eliminar una pregunta renumera las restantes", () => {
    const original = window.confirm;
    window.confirm = () => true;
    let resultado: any = null;

    render(
      <ResourceContentViewer
        type="icfes"
        content={examen}
        editable
        onContentChange={(c) => { resultado = c; }}
      />,
    );

    // Se elimina la segunda pregunta
    screen.getAllByLabelText(/eliminar la pregunta/i)[1].click();
    window.confirm = original;

    expect(resultado.questions).toHaveLength(2);
    expect(resultado.questions.map((q: any) => q.question)).toEqual([
      "Primera pregunta",
      "Tercera pregunta",
    ]);
    // La tercera pasa a ser la numero 2
    expect(resultado.questions.map((q: any) => q.number)).toEqual([1, 2]);
  });

  it("no elimina nada si el docente cancela la confirmacion", () => {
    const original = window.confirm;
    window.confirm = () => false;
    let resultado: any = null;

    render(
      <ResourceContentViewer
        type="icfes"
        content={examen}
        editable
        onContentChange={(c) => { resultado = c; }}
      />,
    );
    screen.getAllByLabelText(/eliminar la pregunta/i)[0].click();
    window.confirm = original;

    expect(resultado).toBeNull();
  });
});
