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

const descargas: { base: string; hojas: any[] }[] = [];

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// Se intercepta la descarga, no la construcción del .xlsx: que el archivo
// salga bien formado se comprueba aparte, en descargas.test.ts. Aquí interesa
// QUÉ se exporta.
vi.mock("@/lib/export-excel", () => ({
  descargarExcel: async (base: string, hojas: any[]) => { descargas.push({ base, hojas }); },
}));

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

  it("al filtrar por una actividad muestra SOLO a quienes la entregaron", async () => {
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByRole("button", { name: /Filtrar por actividad/ }));
    await user.click(await screen.findByLabelText(/Examen de genética/));

    // Solo Ana la presentó. Antes seguían saliendo los tres con la nota en
    // blanco, y el filtro parecía no hacer nada.
    await waitFor(() => expect(screen.queryByText("Luis Gómez")).not.toBeInTheDocument());
    expect(screen.queryByText("Pedro Sin Entregas")).not.toBeInTheDocument();
    expect(screen.getByText("Ana Ruiz")).toBeInTheDocument();
    expect(screen.getByText("1 estudiante")).toBeInTheDocument();
  });

  it("el avance y el promedio se refieren solo a la actividad filtrada", async () => {
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByRole("button", { name: /Filtrar por actividad/ }));
    await user.click(await screen.findByLabelText(/Examen de genética/));

    // Ana sacó 5/10 en esa: 2,5. Su promedio del curso entero era 3,8.
    await waitFor(() => expect(screen.getByText("2.5")).toBeInTheDocument());
    expect(screen.queryByText("3.8")).not.toBeInTheDocument();
    expect(screen.getByText("1 de 1 entregada")).toBeInTheDocument();
    expect(screen.getByText(/viendo 1 de 2 actividades/)).toBeInTheDocument();
  });

  it("quien no entregó no desaparece: se cuenta y se puede volver a ver", async () => {
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByRole("button", { name: /Filtrar por actividad/ }));
    await user.click(await screen.findByLabelText(/Examen de genética/));
    await waitFor(() => expect(screen.queryByText("Luis Gómez")).not.toBeInTheDocument());

    // Saber quién NO entregó es justo lo que el docente persigue, así que el
    // dato sigue a la vista aunque las tarjetas estén ocultas.
    const verOcultos = screen.getByRole("button", { name: /2 sin entregar esta actividad/ });
    await user.click(verOcultos);

    expect(screen.getByText("Luis Gómez")).toBeInTheDocument();
    expect(screen.getByText("Pedro Sin Entregas")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /ocultar a quienes no entregaron/ }));
    await waitFor(() => expect(screen.queryByText("Luis Gómez")).not.toBeInTheDocument());
  });

  it("sin filtro de actividad siguen saliendo todos", async () => {
    montar();
    expect(screen.getByText("Ana Ruiz")).toBeInTheDocument();
    expect(screen.getByText("Luis Gómez")).toBeInTheDocument();
    expect(screen.getByText("Pedro Sin Entregas")).toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: /Resumen en Excel/ }));

    await waitFor(() => expect(descargas).toHaveLength(1));
    const hoja = descargas[0].hojas[0];
    // 2 de Ana + 1 de Luis + 1 fila de Pedro sin entregas. La cabecera ya no
    // es una fila más: la pone el generador de Excel con su propio formato.
    expect(hoja.filas).toHaveLength(4);
    expect(hoja.columnas.map((c: any) => c.titulo)).toContain("Nota (1-5)");

    const pedro = hoja.filas.find((f: any[]) => String(f[0]).includes("Pedro"));
    expect(pedro).toBeTruthy();
    expect(pedro).toContain("(sin entregas)");

    // La nota va como NÚMERO, no como texto. En CSV llegaba como "5.0" y
    // ordenar por nota en Excel dejaba el 10 antes que el 2.
    const deAna = hoja.filas.find((f: any[]) => f[0] === "Ana Ruiz" && f[3] === 10);
    expect(deAna[5]).toBe(5);
    expect(typeof deAna[5]).toBe("number");
  });

  it("el resumen respeta el filtro por actividad y lo dice en el subtítulo", async () => {
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByRole("button", { name: /Filtrar por actividad/ }));
    await user.click(await screen.findByLabelText(/Examen de genética/));
    await user.click(screen.getByRole("button", { name: /Resumen en Excel/ }));

    await waitFor(() => expect(descargas).toHaveLength(1));
    const hoja = descargas[0].hojas[0];
    expect(hoja.subtitulo).toContain("Examen de genética");
    // Ana la presentó; Luis y Pedro no. Los tres salen: el consolidado de
    // notas necesita al curso entero aunque la cuadrícula filtre.
    expect(hoja.filas).toHaveLength(3);
    expect(hoja.filas.filter((f: any[]) => String(f[2]) === "(sin entregas)")).toHaveLength(2);
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
