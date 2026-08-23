import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";

/**
 * Regresión de la tarea 7 (observación del asesor en la reunión de asesoría):
 *
 *   "aquí van a salir absolutamente todos los recursos... hacia abajo,
 *    hacia abajo"
 *
 * La pantalla mostraba una lista plana con todos los recursos del docente.
 * Con veinte exámenes y treinta planes de clase era inutilizable. Ahora los
 * agrupa por tipo y ofrece filtros por asignatura y grado.
 *
 * Lo que estas pruebas protegen:
 *  - que los recursos queden agrupados y no en lista plana
 *  - que el grupo cerrado NO renderice sus recursos (si los renderiza todos
 *    ocultos con CSS volvemos al problema de origen)
 *  - que los ya asignados al curso no reaparezcan
 *  - que los filtros acoten de verdad y se puedan limpiar
 */

const RECURSOS = [
  { id: "r1", title: "Examen ICFES de células", resource_type: "icfes", subject: "Biología", grade: "9", created_at: "2026-08-01T10:00:00Z" },
  { id: "r2", title: "Examen ICFES de genética", resource_type: "icfes", subject: "Biología", grade: "11", created_at: "2026-08-02T10:00:00Z" },
  { id: "r3", title: "Taller de fracciones", resource_type: "workshop", subject: "Matemáticas", grade: "5", created_at: "2026-08-03T10:00:00Z" },
  { id: "r4", title: "Plan de clase sobre el agua", resource_type: "lesson_plan", subject: "Ciencias", grade: "4", created_at: "2026-08-04T10:00:00Z" },
  { id: "r5", title: "Ya está en el curso", resource_type: "rubric", subject: "Biología", grade: "9", created_at: "2026-08-05T10:00:00Z" },
];

const ASIGNADOS = [{ resource_id: "r5" }];

const insertados: any[] = [];

vi.mock("@/hooks/useAuth", () => {
  const user = { id: "docente-1" };
  return { useAuth: () => ({ user }) };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => {
  /** Constructor encadenable y "thenable", como el de supabase-js. */
  const consulta = (resultado: any) => {
    const q: any = {
      select: () => q,
      eq: () => q,
      order: () => q,
      insert: (fila: any) => { insertados.push(fila); return Promise.resolve({ error: null }); },
      then: (res: any) => res({ data: resultado, error: null }),
    };
    return q;
  };
  return {
    supabase: {
      from: (tabla: string) =>
        consulta(tabla === "generated_resources" ? RECURSOS : ASIGNADOS),
    },
  };
});

const { default: AddCourseResource } = await import("@/pages/courses/AddCourseResource");

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/resources/courses/c1/add"]}>
        <Routes>
          <Route path="/resources/courses/:courseId/add" element={<AddCourseResource />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Agregar recurso al curso", () => {
  beforeEach(() => { insertados.length = 0; });

  it("agrupa por tipo en lugar de mostrar una lista plana", async () => {
    montar();
    // Las cabeceras de grupo aparecen, con su contador
    expect(await screen.findByRole("button", { name: /Exámenes/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Talleres/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Planes de clase/ })).toBeInTheDocument();
  });

  it("mantiene los grupos cerrados: los títulos no se renderizan hasta abrirlos", async () => {
    montar();
    await screen.findByRole("button", { name: /Exámenes/ });
    // Esta es la clave de la corrección: el contenido no existe en el DOM
    expect(screen.queryByText("Examen ICFES de células")).not.toBeInTheDocument();
    expect(screen.queryByText("Taller de fracciones")).not.toBeInTheDocument();
  });

  it("abre un grupo al pulsarlo y muestra solo sus recursos", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(await screen.findByRole("button", { name: /Exámenes/ }));

    expect(screen.getByText("Examen ICFES de células")).toBeInTheDocument();
    expect(screen.getByText("Examen ICFES de genética")).toBeInTheDocument();
    // Abrir "Exámenes" no debe destapar los otros grupos
    expect(screen.queryByText("Taller de fracciones")).not.toBeInTheDocument();
  });

  it("excluye los recursos que ya están agregados al curso", async () => {
    montar();
    await screen.findByRole("button", { name: /Exámenes/ });
    // r5 es una rúbrica ya asignada: su grupo ni siquiera debe existir
    expect(screen.queryByRole("button", { name: /Rúbricas/ })).not.toBeInTheDocument();
    expect(screen.getByText(/4 disponibles/)).toBeInTheDocument();
  });

  it("la búsqueda por título acota y abre los grupos coincidentes", async () => {
    const user = userEvent.setup();
    montar();
    await screen.findByRole("button", { name: /Exámenes/ });

    await user.type(screen.getByPlaceholderText(/Buscar por título/), "genética");

    await waitFor(() => expect(screen.getByText("Examen ICFES de genética")).toBeInTheDocument());
    expect(screen.queryByText("Examen ICFES de células")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Talleres/ })).not.toBeInTheDocument();
    expect(screen.getByText(/1 disponible$/)).toBeInTheDocument();
  });

  it("filtra por asignatura y permite limpiar los filtros", async () => {
    const user = userEvent.setup();
    montar();
    await screen.findByRole("button", { name: /Exámenes/ });

    await user.click(screen.getByLabelText("Asignatura"));
    await user.click(await screen.findByRole("option", { name: "Matemáticas" }));

    await waitFor(() => expect(screen.getByText(/1 disponible$/)).toBeInTheDocument());
    expect(screen.getByText("Taller de fracciones")).toBeInTheDocument();
    expect(screen.queryByText("Examen ICFES de células")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    await waitFor(() => expect(screen.getByText(/4 disponibles/)).toBeInTheDocument());
  });

  it("avisa cuando ningún recurso coincide, sin dejar la pantalla vacía", async () => {
    const user = userEvent.setup();
    montar();
    await screen.findByRole("button", { name: /Exámenes/ });

    await user.type(screen.getByPlaceholderText(/Buscar por título/), "termodinámica cuántica");

    expect(await screen.findByText(/Ningún recurso coincide con los filtros/)).toBeInTheDocument();
  });

  it("agrega el recurso al curso con el tipo y el título correctos", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(await screen.findByRole("button", { name: /Talleres/ }));
    await user.click(screen.getByRole("button", { name: /Agregar/ }));

    await waitFor(() => expect(insertados).toHaveLength(1));
    expect(insertados[0]).toMatchObject({
      course_id: "c1",
      resource_id: "r3",
      resource_type: "workshop",
      title: "Taller de fracciones",
    });
  });
});
