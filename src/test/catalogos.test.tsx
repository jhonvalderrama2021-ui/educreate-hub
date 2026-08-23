import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { RESPALDO } from "@/lib/catalogos";

/**
 * Tarea 11 de P2 — catálogos editables.
 *
 * Pedido del asesor: *"si hay una nueva metodología que no esté aquí, ¿dónde
 * se agregaría? … que este sistema no quede congelado en el tiempo"*. Las 32
 * asignaturas y las 18 metodologías estaban escritas en el código.
 *
 * Lo que estas pruebas protegen sobre todo: que un catálogo vacío o una
 * consulta caída NO dejen al docente con un desplegable en blanco. Sin
 * opciones no puede generar nada, y ese fallo apareceria justo el día de la
 * capacitación.
 */

let FILAS: any[] = [];
let fallaConsulta = false;
const escrituras: { op: string; datos: any; id?: string }[] = [];

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/hooks/useAuth", () => {
  const user = { id: "admin-1" };
  return { useAuth: () => ({ user }) };
});

vi.mock("@/integrations/supabase/client", () => {
  const consulta = () => {
    let pendiente: { op: string; datos: any } | null = null;
    const q: any = {
      select: () => q,
      order: () => q,
      insert: (datos: any) => { escrituras.push({ op: "insert", datos }); return Promise.resolve({ error: null }); },
      update: (datos: any) => { pendiente = { op: "update", datos }; return q; },
      delete: () => { pendiente = { op: "delete", datos: null }; return q; },
      eq: (_col: string, valor: any) => {
        if (pendiente) { escrituras.push({ ...pendiente, id: valor }); pendiente = null; }
        return q;
      },
      then: (res: any, rej: any) =>
        fallaConsulta
          ? res({ data: null, error: { message: "sin conexión" } })
          : res({ data: FILAS, error: null }),
    };
    return q;
  };
  return { supabase: { from: () => consulta() } };
});

const { useCatalogo } = await import("@/hooks/useCatalogo");
const { GestorCatalogos } = await import("@/components/GestorCatalogos");

const entrada = (id: string, valor: string, activo = true, orden = 1) => ({
  id, tipo: "metodologia", valor, orden, activo, created_at: "2026-08-01T10:00:00Z",
});

const envoltorio = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

describe("Hook de catálogo", () => {
  beforeEach(() => { FILAS = []; fallaConsulta = false; escrituras.length = 0; });

  it("devuelve las opciones que mantiene el administrador", async () => {
    FILAS = [entrada("1", "Aprendizaje Dialógico"), entrada("2", "Gamificación")];
    const { result } = renderHook(() => useCatalogo("metodologia"), { wrapper: envoltorio() });

    await waitFor(() => expect(result.current).toContain("Aprendizaje Dialógico"));
    expect(result.current).toHaveLength(2);
  });

  it("cae en la lista de respaldo si la consulta falla", async () => {
    fallaConsulta = true;
    const { result } = renderHook(() => useCatalogo("metodologia"), { wrapper: envoltorio() });

    // Sin respaldo el docente veria un desplegable vacio y no podria generar
    await waitFor(() => expect(result.current).toEqual(RESPALDO.metodologia));
    expect(result.current.length).toBe(18);
  });

  it("cae en la lista de respaldo si alguien vacía el catálogo", async () => {
    FILAS = [];
    const { result } = renderHook(() => useCatalogo("asignatura"), { wrapper: envoltorio() });

    await waitFor(() => expect(result.current).toEqual(RESPALDO.asignatura));
    expect(result.current.length).toBe(32);
  });
});

describe("Pantalla de catálogos", () => {
  beforeEach(() => {
    FILAS = [];
    fallaConsulta = false;
    escrituras.length = 0;
    vi.stubGlobal("confirm", () => true);
  });

  const montar = () => render(<GestorCatalogos />, { wrapper: envoltorio() });

  it("agrega una opción nueva al final de la lista", async () => {
    const user = userEvent.setup();
    FILAS = [entrada("1", "Gamificación", true, 5)];
    montar();
    await user.click(await screen.findByRole("tab", { name: "Metodologías" }));

    await user.type(await screen.findByLabelText("Agregar metodología"), "Aprendizaje Dialógico");
    await user.click(screen.getByRole("button", { name: /Agregar/ }));

    await waitFor(() => expect(escrituras.find((e) => e.op === "insert")).toBeTruthy());
    expect(escrituras.find((e) => e.op === "insert")!.datos).toMatchObject({
      tipo: "metodologia",
      valor: "Aprendizaje Dialógico",
      // Al final: no reordena lo que el docente ya tiene aprendido
      orden: 6,
    });
  });

  it("rechaza duplicados sin distinguir mayúsculas", async () => {
    const user = userEvent.setup();
    FILAS = [entrada("1", "Gamificación")];
    montar();
    await user.click(await screen.findByRole("tab", { name: "Metodologías" }));

    await user.type(await screen.findByLabelText("Agregar metodología"), "gamificación");
    await user.click(screen.getByRole("button", { name: /Agregar/ }));

    expect(escrituras.find((e) => e.op === "insert")).toBeUndefined();
  });

  it("oculta en vez de borrar, que es la acción segura", async () => {
    const user = userEvent.setup();
    FILAS = [entrada("1", "Clase magistral")];
    montar();
    await user.click(await screen.findByRole("tab", { name: "Metodologías" }));

    await user.click(await screen.findByLabelText("Ocultar Clase magistral"));

    await waitFor(() => expect(escrituras.find((e) => e.op === "update")).toMatchObject({
      id: "1", datos: { activo: false },
    }));
  });

  it("advierte antes de borrar que es preferible ocultar", async () => {
    const user = userEvent.setup();
    const avisos: string[] = [];
    vi.stubGlobal("confirm", (m: string) => { avisos.push(m); return true; });
    FILAS = [entrada("1", "Clase magistral")];
    montar();
    await user.click(await screen.findByRole("tab", { name: "Metodologías" }));

    await user.click(await screen.findByLabelText("Eliminar Clase magistral"));

    expect(avisos[0]).toMatch(/es preferible ocultarla/);
    await waitFor(() => expect(escrituras.find((e) => e.op === "delete")).toMatchObject({ id: "1" }));
  });

  it("renombra una opción existente", async () => {
    const user = userEvent.setup();
    FILAS = [entrada("1", "Clase magistral")];
    montar();
    await user.click(await screen.findByRole("tab", { name: "Metodologías" }));

    await user.click(await screen.findByLabelText("Editar Clase magistral"));
    const campo = screen.getByLabelText("Nuevo nombre para Clase magistral");
    await user.clear(campo);
    await user.type(campo, "Clase magistral dialogada");
    await user.click(screen.getByRole("button", { name: "Guardar nombre" }));

    await waitFor(() => expect(escrituras.find((e) => e.op === "update")).toMatchObject({
      id: "1", datos: { valor: "Clase magistral dialogada" },
    }));
  });

  it("avisa cuando no queda ninguna opción visible y explica qué ven los docentes", async () => {
    const user = userEvent.setup();
    FILAS = [entrada("1", "Clase magistral", false)];
    montar();
    await user.click(await screen.findByRole("tab", { name: "Metodologías" }));

    expect(await screen.findByText(/No hay ninguna opción visible/)).toBeInTheDocument();
    expect(screen.getByText(/lista\s+por defecto de 18 metodologías/)).toBeInTheDocument();
  });

  it("cuenta cuántas están visibles del total", async () => {
    const user = userEvent.setup();
    FILAS = [entrada("1", "Una"), entrada("2", "Otra", false), entrada("3", "Tercera")];
    montar();
    await user.click(await screen.findByRole("tab", { name: "Metodologías" }));

    expect(await screen.findByText("2 visibles de 3")).toBeInTheDocument();
    expect(screen.getByText("oculta")).toBeInTheDocument();
  });
});
