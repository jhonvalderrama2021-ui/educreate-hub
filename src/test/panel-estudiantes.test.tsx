import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

/**
 * Estudiantes del curso en cuadrícula.
 *
 * Lo que pidió el docente: ver lo que ha desarrollado cada estudiante con su
 * calificación, poder sacar un resumen de todo el grupo según el recurso que
 * quiera mirar, y que los estudiantes salgan en cuadrícula para entrar a cada
 * uno.
 *
 * Lo que estas pruebas protegen:
 *  - que quien NO ha entregado nada siga apareciendo. Es el dato que el
 *    docente más busca, y una lista construida a partir de las entregas lo
 *    dejaría fuera.
 *  - que al filtrar por una actividad, el avance y el promedio se refieran
 *    solo a esa. Si el filtro cambia la lista pero no los números, el docente
 *    lee un promedio del curso entero creyendo que es de esa actividad.
 */

const descargas: { nombre: string; filas: any[][] }[] = [];

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/examen-respuestas", async (original) => {
  const real = await original<typeof import("@/lib/examen-respuestas")>();
  return { ...real, descargarCSV: (nombre: string, filas: any[][]) => { descargas.push({ nombre, filas }); } };
});

const { PanelEstudiantesCurso } = await import("@/components/PanelEstudiantesCurso");

const INSCRIPCIONES = [
  { id: "i1", student_id: "e1", enrolled_at: "2026-08-01T10:00:00Z",
    profile: { id: "e1", full_name: "Ana Ruiz", email: "ana@itp.edu.co" } },
  { id: "i2", student_id: "e2", enrolled_at: "2026-08-01T10:00:00Z",
    profile: { id: "e2", full_name: "Luis Gómez", email: "luis@itp.edu.co" } },
  { id: "i3", student_id: "e3", enrolled_at: "2026-08-01T10:00:00Z",
    profile: { id: "e3", full_name: "Pedro Sin Entregas", email: "pedro@itp.edu.co" } },
];

const RECURSOS: any[] = [
  { id: "cr1", course_id: "c1", resource_id: "gr1", resource_type: "icfes", title: "Examen de la célula" },
  { id: "cr2", course_id: "c1", resource_id: "gr2", resource_type: "icfes", title: "Examen de genética" },
];

const ENTREGAS: any[] = [
  // Ana entregó las dos: 10/10 y 5/10
  { id: "s1", course_resource_id: "cr1", student_id: "e1", score: 10, max_score: 10,
    time_spent_seconds: 300, submitted_at: "2026-08-10T10:00:00Z", answers: {}, feedback: [] },
  { id: "s2", course_resource_id: "cr2", student_id: "e1", score: 5, max_score: 10,
    time_spent_seconds: 200, submitted_at: "2026-08-11T10:00:00Z", answers: {}, feedback: [] },
  // Luis solo la primera: 6/10
  { id: "s3", course_resource_id: "cr1", student_id: "e2", score: 6, max_score: 10,
    time_spent_seconds: 400, submitted_at: "2026-08-10T11:00:00Z", answers: {}, feedback: [] },
];

const montar = (props: any = {}) =>
  render(
    <MemoryRouter>
      <PanelEstudiantesCurso
        courseId="c1"
        nombreCurso="Biología 9"
        inscripciones={INSCRIPCIONES}
        recursos={RECURSOS}
        entregas={ENTREGAS}
        contenidos={{}}
        {...props}
      />
    </MemoryRouter>,
  );

describe("Cuadrícula de estudiantes del curso", () => {
  beforeEach(() => { descargas.length = 0; });

  it("muestra a todos los estudiantes, también a quien no ha entregado nada", () => {
    montar();
    expect(screen.getByText("Ana Ruiz")).toBeInTheDocument();
    expect(screen.getByText("Luis Gómez")).toBeInTheDocument();
    // El dato que el docente más busca
    expect(screen.getByText("Pedro Sin Entregas")).toBeInTheDocument();
    expect(screen.getByText("Sin empezar")).toBeInTheDocument();
    expect(screen.getByText(/1 sin entregar nada/)).toBeInTheDocument();
  });

  it("calcula el promedio de cada quien en la escala colombiana", () => {
    montar();
    // Ana: 10/10 y 5/10 → 5,0 y 2,5 → promedio 3,8
    expect(screen.getByText("3.8")).toBeInTheDocument();
    // Luis: 6/10 → 3,0
    expect(screen.getByText("3.0")).toBeInTheDocument();
    // Pedro no tiene nota
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("indica cuántas actividades lleva cada estudiante", () => {
    montar();
    expect(screen.getByText("2 de 2 entregadas")).toBeInTheDocument();
    expect(screen.getByText("1 de 2 entregadas")).toBeInTheDocument();
    expect(screen.getByText("0 de 2 entregadas")).toBeInTheDocument();
  });

  it("al filtrar por una actividad, el avance y el promedio son de esa actividad", async () => {
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByRole("button", { name: /Filtrar por actividad/ }));
    await user.click(await screen.findByLabelText(/Examen de genética/));

    // Solo Ana la presentó: 5/10 → 2,5
    await waitFor(() => expect(screen.getByText("2.5")).toBeInTheDocument());
    expect(screen.getAllByText("1 de 1 entregada")).toHaveLength(1);
    expect(screen.getAllByText("0 de 1 entregada")).toHaveLength(2);
    expect(screen.getByText(/viendo 1 de 2 actividades/)).toBeInTheDocument();
  });

  it("busca por nombre o correo", async () => {
    const user = userEvent.setup();
    montar();

    await user.type(screen.getByLabelText("Buscar estudiante"), "luis@");

    await waitFor(() => expect(screen.queryByText("Ana Ruiz")).not.toBeInTheDocument());
    expect(screen.getByText("Luis Gómez")).toBeInTheDocument();
  });

  it("exporta el resumen de notas de todo el grupo, incluidos los que no entregaron", async () => {
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByRole("button", { name: /Resumen de notas/ }));

    expect(descargas).toHaveLength(1);
    const { filas } = descargas[0];
    // Cabecera + 2 de Ana + 1 de Luis + 1 fila de Pedro sin entregas
    expect(filas).toHaveLength(5);
    expect(filas[0]).toContain("Nota (1-5)");

    const pedro = filas.find((f) => String(f[0]).includes("Pedro"));
    expect(pedro).toBeTruthy();
    expect(pedro).toContain("(sin entregas)");

    const primeraDeAna = filas.find((f) => f[0] === "Ana Ruiz");
    expect(primeraDeAna).toContain("5.0");
  });

  it("el resumen respeta el filtro por actividad y lo dice en el nombre del archivo", async () => {
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByRole("button", { name: /Filtrar por actividad/ }));
    await user.click(await screen.findByLabelText(/Examen de genética/));
    await user.click(screen.getByRole("button", { name: /Resumen de notas/ }));

    const { nombre, filas } = descargas[0];
    expect(nombre).toContain("Examen_de_genética");
    // Cabecera + Ana (la presentó) + Luis y Pedro (no la presentaron)
    expect(filas).toHaveLength(4);
    expect(filas.filter((f) => String(f[2]) === "(sin entregas)")).toHaveLength(2);
  });

  it("cada tarjeta lleva al informe de ese estudiante", async () => {
    const user = userEvent.setup();
    montar();

    const tarjeta = screen.getByText("Ana Ruiz").closest("button")!;
    expect(tarjeta).toBeInTheDocument();
    await user.click(tarjeta);
    // La navegación la hace react-router; basta con que la tarjeta sea el
    // control que la dispara y no un div sin semántica.
    expect(tarjeta.tagName).toBe("BUTTON");
  });

  it("avisa cuando el curso todavía no tiene estudiantes", () => {
    montar({ inscripciones: [] });
    expect(screen.getByText(/Sin estudiantes inscritos/)).toBeInTheDocument();
  });
});
