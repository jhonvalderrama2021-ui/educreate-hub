import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";

/**
 * Tarea 10 — vista de resultados por estudiante.
 *
 * Pedido del asesor: *"Que salga el nombre, el logo, y cuando le des clic te
 * lleve a ver lo que hizo el estudiante"* y *"o una opción que le dé para
 * extraer todos"*.
 *
 * Antes esta pantalla solo mostraba una tabla con la nota. Ahora despliega
 * cada pregunta con lo que marcó el estudiante y cuál era la correcta.
 */

const PERFIL = { id: "est-1", full_name: "María Fernanda Ruiz", email: "maria@itp.edu.co" };
const CURSO = { name: "Biología 9°" };

const RECURSOS_CURSO = [
  { id: "cr-1", course_id: "c1", resource_id: "gr-1", resource_type: "icfes", title: "Examen de la célula" },
];

const CONTENIDOS = [{
  id: "gr-1",
  content: {
    questions: [
      {
        question: "¿Qué organelo produce la energía de la célula?",
        options: ["Mitocondria", "Núcleo", "Ribosoma"],
        correct: 0,
        explanation: "La mitocondria produce ATP.",
      },
      {
        question: "¿Dónde está el ADN?",
        options: ["Citoplasma", "Núcleo"],
        correct: 1,
      },
    ],
  },
}];

const ENTREGAS = [{
  id: "s-1",
  course_resource_id: "cr-1",
  course_id: "c1",
  student_id: "est-1",
  resource_type: "icfes",
  score: 1,
  max_score: 2,
  time_spent_seconds: 185,
  submitted_at: "2026-08-20T14:30:00Z",
  answers: { 0: 0, 1: 0 },
  feedback: [
    { i: 0, userIdx: 0, correctIdx: 0, ok: true, explanation: "La mitocondria produce ATP." },
    { i: 1, userIdx: 0, correctIdx: 1, ok: false },
  ],
}];

const descargas: { base: string; hojas: any[] }[] = [];

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Se intercepta la descarga, no la construcción del .xlsx: que el archivo
// salga bien formado se comprueba aparte, en descargas.test.ts.
vi.mock("@/lib/export-excel", () => ({
  descargarExcel: async (base: string, hojas: any[]) => { descargas.push({ base, hojas }); },
}));

vi.mock("@/integrations/supabase/client", () => {
  const DATOS: Record<string, any> = {
    profiles: PERFIL,
    mini_courses: CURSO,
    resource_submissions: ENTREGAS,
    course_resources: RECURSOS_CURSO,
    generated_resources: CONTENIDOS,
  };
  const consulta = (tabla: string) => {
    const q: any = {
      select: () => q,
      eq: () => q,
      in: () => q,
      order: () => q,
      single: () => Promise.resolve({ data: DATOS[tabla], error: null }),
      then: (res: any) => res({ data: DATOS[tabla], error: null }),
    };
    return q;
  };
  return { supabase: { from: (tabla: string) => consulta(tabla) } };
});

const { default: StudentReport } = await import("@/pages/courses/StudentReport");

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/resources/courses/c1/student-report/est-1"]}>
        <Routes>
          <Route path="/resources/courses/:courseId/student-report/:studentId" element={<StudentReport />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Informe de un estudiante", () => {
  beforeEach(() => { descargas.length = 0; });

  it("encabeza con el nombre, el correo y las iniciales", async () => {
    montar();
    expect(await screen.findByRole("heading", { name: "María Fernanda Ruiz" })).toBeInTheDocument();
    expect(screen.getByText(/maria@itp\.edu\.co/)).toBeInTheDocument();
    expect(screen.getByText("MF")).toBeInTheDocument();
  });

  it("resume promedio, actividades y tiempo en la escala colombiana", async () => {
    montar();
    await screen.findByText("Promedio");
    // 1 de 2 aciertos = 2,5 sobre 5,0. El mismo valor sale en la fila de la
    // entrega, asi que se busca dentro de la tarjeta de resumen.
    const resumen = screen.getByText("Promedio").closest("div")!.parentElement!;
    expect(resumen).toHaveTextContent("2.5");
    expect(resumen).toHaveTextContent("sobre 5,0");
    expect(screen.getByText("Actividades").closest("div")!.parentElement!).toHaveTextContent("1");
    expect(screen.getByText("3m 5s")).toBeInTheDocument();
  });

  it("mantiene el detalle plegado hasta que el docente lo abre", async () => {
    montar();
    await screen.findByText("Examen de la célula");
    expect(screen.queryByText(/¿Qué organelo produce la energía/)).not.toBeInTheDocument();
  });

  it("al abrir muestra cada pregunta con lo que respondió y la correcta", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(await screen.findByText("Examen de la célula"));

    expect(screen.getByText(/¿Qué organelo produce la energía/)).toBeInTheDocument();
    expect(screen.getByText(/¿Dónde está el ADN/)).toBeInTheDocument();

    // Acertó la primera: marcó Mitocondria, que es la correcta
    expect(screen.getByText(/respondió \(correcta\)/)).toBeInTheDocument();
    // Falló la segunda: marcó Citoplasma y la correcta era Núcleo
    expect(screen.getByText("← correcta")).toBeInTheDocument();
    expect(screen.getByText("La mitocondria produce ATP.")).toBeInTheDocument();
  });

  it("exporta un libro con resumen y detalle pregunta por pregunta", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(await screen.findByRole("button", { name: /Descargar en Excel/ }));

    await waitFor(() => expect(descargas).toHaveLength(1));
    const { base, hojas } = descargas[0];
    expect(base).toContain("María Fernanda Ruiz");

    // Dos hojas: el resumen que se lleva a la reunión de evaluación y el
    // detalle para hablar con el estudiante. En una sola tabla, el resumen se
    // perdía entre las preguntas.
    expect(hojas).toHaveLength(2);
    expect(hojas[0].nombre).toBe("Resumen");
    expect(hojas[1].nombre).toBe("Detalle por pregunta");

    // Resumen: una actividad, con la nota como número (1 de 2 aciertos → 2,5)
    expect(hojas[0].filas).toHaveLength(1);
    expect(hojas[0].filas[0]).toContain("Examen de la célula");
    expect(hojas[0].filas[0][4]).toBe(2.5);

    // Detalle: una fila por pregunta, con lo que marcó y lo correcto
    const detalle = hojas[1].filas;
    expect(detalle).toHaveLength(2);
    expect(detalle[0]).toContain("¿Qué organelo produce la energía de la célula?");
    expect(detalle[0]).toContain("Mitocondria");
    expect(detalle[0][detalle[0].length - 1]).toBe("Sí");
    expect(detalle[1]).toContain("Citoplasma");
    expect(detalle[1]).toContain("Núcleo");
    expect(detalle[1][detalle[1].length - 1]).toBe("No");
  });
});
