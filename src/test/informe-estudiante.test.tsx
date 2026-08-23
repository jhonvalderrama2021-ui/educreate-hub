import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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

const descargas: { nombre: string; filas: any[][] }[] = [];

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/lib/examen-respuestas", async (original) => {
  const real = await original<typeof import("@/lib/examen-respuestas")>();
  // Se intercepta solo la descarga: jsdom no puede escribir archivos, pero el
  // contenido del CSV sí interesa comprobarlo.
  return { ...real, descargarCSV: (nombre: string, filas: any[][]) => { descargas.push({ nombre, filas }); } };
});

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

  it("exporta una fila por pregunta, no solo la nota", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(await screen.findByRole("button", { name: /Descargar resultados/ }));

    expect(descargas).toHaveLength(1);
    const { nombre, filas } = descargas[0];
    expect(nombre).toBe("resultados-María_Fernanda_Ruiz.csv");

    // Cabecera + una fila por cada una de las 2 preguntas
    expect(filas).toHaveLength(3);
    expect(filas[0]).toContain("Enunciado");

    const primera = filas[1];
    expect(primera).toContain("María Fernanda Ruiz");
    expect(primera).toContain("Examen de la célula");
    expect(primera).toContain("2.5");
    expect(primera).toContain("¿Qué organelo produce la energía de la célula?");
    expect(primera).toContain("Mitocondria");
    expect(primera[primera.length - 1]).toBe("Sí");

    // La fallada debe salir con la respuesta del estudiante Y la correcta
    const segunda = filas[2];
    expect(segunda).toContain("Citoplasma");
    expect(segunda).toContain("Núcleo");
    expect(segunda[segunda.length - 1]).toBe("No");
  });
});
