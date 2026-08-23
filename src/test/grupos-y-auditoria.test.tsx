import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { rutaDelRecurso } from "@/lib/ruta-modulo";

/**
 * Tareas 12, 13 y 14 de P2.
 *
 *  12. Cursos por grupo: *"en los colegios hay sexto A, sexto B, sexto C…
 *      serían 200 estudiantes en este listado"*.
 *  13. Auditoría de tiempos: *"a veces los estudiantes dicen 'es que yo sí me
 *      conecté toda la noche' y se va a ver la auditoría: entró 10 minutos"*.
 *  14. Editar recursos ya guardados: *"si hacen una rúbrica y les quedó
 *      faltando algo, tienen dos opciones: volver a crearla o modificarla"*.
 */

let ACCESOS: any[] = [];
const llamadas: { nombre: string; args: any }[] = [];

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/examen-respuestas", async (original) => {
  const real = await original<typeof import("@/lib/examen-respuestas")>();
  return { ...real, descargarCSV: vi.fn() };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (nombre: string, args: any) => {
      llamadas.push({ nombre, args });
      if (nombre === "resumen_accesos") return Promise.resolve({ data: ACCESOS, error: null });
      return Promise.resolve({ data: null, error: null });
    },
  },
}));

const { PanelAuditoria } = await import("@/components/PanelAuditoria");
const { useRegistroAcceso } = await import("@/hooks/useRegistroAcceso");

const envoltorio = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

// ─────────────────────────────────────────────────────────────────────────
describe("Tarea 14 · abrir un recurso guardado para modificarlo", () => {
  it("manda cada tipo de recurso a su propio módulo", () => {
    expect(rutaDelRecurso("crossword", "abc")).toBe("/resources/crossword?recurso=abc");
    expect(rutaDelRecurso("story", "abc")).toBe("/resources/story?recurso=abc");
  });

  it("los demás tipos van al generador, conservando el tipo", () => {
    // Sin el type, el generador abriría en "Exámenes" aunque sea una rúbrica
    expect(rutaDelRecurso("rubric", "abc")).toBe("/resources/generate?type=rubric&recurso=abc");
    expect(rutaDelRecurso("lesson_plan", "x1")).toBe("/resources/generate?type=lesson_plan&recurso=x1");
    expect(rutaDelRecurso("slides", "x2")).toBe("/resources/generate?type=slides&recurso=x2");
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("Tarea 13 · auditoría de tiempos de acceso", () => {
  beforeEach(() => {
    llamadas.length = 0;
    ACCESOS = [
      {
        user_id: "1", nombre: "Luis Gómez", email: "luis@itp.edu.co", rol: "estudiante",
        sesiones: 3, segundos_totales: 640,
        primera_vez: "2026-08-01T10:00:00Z", ultima_vez: "2026-08-20T14:00:00Z",
      },
      {
        user_id: "2", nombre: "Ana Ruiz", email: "ana@itp.edu.co", rol: "docente",
        sesiones: 12, segundos_totales: 18000,
        primera_vez: "2026-07-01T10:00:00Z", ultima_vez: "2026-08-22T09:00:00Z",
      },
      {
        user_id: "3", nombre: "Pedro Nunca", email: "pedro@itp.edu.co", rol: "estudiante",
        sesiones: 0, segundos_totales: 0, primera_vez: null, ultima_vez: null,
      },
    ];
  });

  it("responde la pregunta del asesor: cuánto tiempo estuvo de verdad", async () => {
    render(<PanelAuditoria />, { wrapper: envoltorio() });
    expect(await screen.findByText("Luis Gómez")).toBeInTheDocument();
    // 640 segundos son 10m 40s, no "toda la noche"
    expect(screen.getByText("10m 40s")).toBeInTheDocument();
    expect(screen.getByText("5h")).toBeInTheDocument();
  });

  it("distingue a quien nunca entró de quien entró poco", async () => {
    render(<PanelAuditoria />, { wrapper: envoltorio() });
    await screen.findByText("Pedro Nunca");
    expect(screen.getByText("Nunca entró")).toBeInTheDocument();
    expect(screen.getByText(/2 con actividad en el periodo/)).toBeInTheDocument();
    expect(screen.getByText(/1 sin entrar/)).toBeInTheDocument();
  });

  it("advierte qué mide realmente, para no usar el dato de más", async () => {
    render(<PanelAuditoria />, { wrapper: envoltorio() });
    expect(await screen.findByText(/ni prueba que la persona estuviera leyendo/))
      .toBeInTheDocument();
  });

  it("cambia el periodo consultado", async () => {
    const user = userEvent.setup();
    render(<PanelAuditoria />, { wrapper: envoltorio() });
    await screen.findByText("Luis Gómez");
    expect(llamadas[0]).toMatchObject({ nombre: "resumen_accesos", args: { p_dias: 30 } });

    await user.click(screen.getByLabelText("Periodo"));
    await user.click(await screen.findByRole("option", { name: "Últimos 7 días" }));

    await waitFor(() =>
      expect(llamadas.some((l) => l.args?.p_dias === 7)).toBe(true));
  });

  it("filtra por rol", async () => {
    const user = userEvent.setup();
    render(<PanelAuditoria />, { wrapper: envoltorio() });
    await screen.findByText("Ana Ruiz");

    await user.click(screen.getByLabelText("Rol"));
    await user.click(await screen.findByRole("option", { name: "Docente" }));

    await waitFor(() => expect(screen.queryByText("Luis Gómez")).not.toBeInTheDocument());
    expect(screen.getByText("Ana Ruiz")).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("Tarea 13 · latido de actividad", () => {
  beforeEach(() => { llamadas.length = 0; });

  function Sonda({ activo }: { activo: boolean }) {
    useRegistroAcceso(activo);
    return null;
  }

  it("no registra nada si no hay sesión iniciada", async () => {
    render(<Sonda activo={false} />);
    await new Promise((r) => setTimeout(r, 20));
    expect(llamadas).toHaveLength(0);
  });

  it("registra al abrir la plataforma con sesión", async () => {
    render(<Sonda activo />);
    await waitFor(() => expect(llamadas.filter((l) => l.nombre === "registrar_acceso")).toHaveLength(1));
  });

  it("no cuenta una pestaña que quedó de fondo", async () => {
    // Una pestaña olvidada toda la noche no debe sumar ocho horas: eso haría
    // la auditoría inútil, justo al revés de lo que pidió el asesor.
    const original = Object.getOwnPropertyDescriptor(Document.prototype, "visibilityState");
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });

    render(<Sonda activo />);
    await new Promise((r) => setTimeout(r, 30));
    expect(llamadas).toHaveLength(0);

    if (original) Object.defineProperty(Document.prototype, "visibilityState", original);
  });
});
