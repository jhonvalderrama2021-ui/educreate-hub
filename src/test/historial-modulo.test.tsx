import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Tarea 9 — guardado automático e historial dentro de cada módulo.
 *
 * Lo acordado en la reunión: al entrar a Exámenes, el formulario a la
 * izquierda y a la derecha una franja con los exámenes que ese docente ya
 * creó, paginada de 10 en 10, en vez de mandarlo al historial general.
 *
 * Lo que estas pruebas protegen:
 *  - que cada módulo vea SOLO sus recursos (un cuento no puede salir en
 *    exámenes: es el error que haría inútil la franja)
 *  - que la paginación sea realmente de 10 y no muestre las demás
 *  - que al borrar recursos la página actual no quede fuera de rango,
 *    dejando la franja en blanco sin explicación
 */

const RECURSOS: any[] = [];

vi.mock("@/hooks/useAuth", () => {
  const user = { id: "docente-1" };
  return { useAuth: () => ({ user }) };
});

vi.mock("@/integrations/supabase/client", () => {
  const consulta = () => {
    const q: any = {
      select: () => q,
      eq: () => q,
      order: () => q,
      then: (res: any) => res({ data: RECURSOS, error: null }),
    };
    return q;
  };
  return {
    supabase: {
      from: () => consulta(),
      // El canal de tiempo real no aporta nada en jsdom, pero el componente
      // lo suscribe y lo cierra al desmontarse.
      channel: () => ({ on() { return this; }, subscribe() { return this; } }),
      removeChannel: () => {},
    },
  };
});

const { HistorialModulo } = await import("@/components/HistorialModulo");

const recurso = (id: string, tipo: string, titulo: string) => ({
  id,
  resource_type: tipo,
  title: titulo,
  content: { titulo },
  is_public: false,
  subject: null,
  grade: null,
  created_at: "2026-08-01T10:00:00Z",
});

function montar(props: any = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onAbrir = props.onAbrir || vi.fn();
  const util = render(
    <QueryClientProvider client={qc}>
      <HistorialModulo tipos={["icfes"]} onAbrir={onAbrir} {...props} />
    </QueryClientProvider>,
  );
  return { ...util, onAbrir };
}

describe("Franja de historial por módulo", () => {
  beforeEach(() => { RECURSOS.length = 0; });

  it("muestra solo los recursos del módulo, no los de otros", async () => {
    RECURSOS.push(
      recurso("1", "icfes", "Examen de células"),
      recurso("2", "story", "Cuento de la luciérnaga"),
      recurso("3", "crossword", "Crucigrama del agua"),
    );
    montar();

    expect(await screen.findByText("Examen de células")).toBeInTheDocument();
    // Si un cuento se cuela en la franja de exámenes, la franja no sirve
    expect(screen.queryByText("Cuento de la luciérnaga")).not.toBeInTheDocument();
    expect(screen.queryByText("Crucigrama del agua")).not.toBeInTheDocument();
  });

  it("invita a generar cuando el módulo aún no tiene nada", async () => {
    RECURSOS.push(recurso("1", "story", "Cuento de la luciérnaga"));
    montar();
    expect(await screen.findByText(/Aquí aparecerán los recursos que generes/)).toBeInTheDocument();
  });

  it("pagina de 10 en 10 y no muestra los siguientes", async () => {
    for (let i = 1; i <= 23; i++) RECURSOS.push(recurso(String(i), "icfes", `Examen ${i}`));
    montar();

    expect(await screen.findByText("Examen 1")).toBeInTheDocument();
    expect(screen.getByText("Examen 10")).toBeInTheDocument();
    expect(screen.queryByText("Examen 11")).not.toBeInTheDocument();
    expect(screen.getByText("Página 1 de 3")).toBeInTheDocument();
    // El total va en la cabecera, para que el docente sepa cuántos tiene
    expect(screen.getByText("23")).toBeInTheDocument();
  });

  it("avanza y retrocede de página", async () => {
    const user = userEvent.setup();
    for (let i = 1; i <= 23; i++) RECURSOS.push(recurso(String(i), "icfes", `Examen ${i}`));
    montar();
    await screen.findByText("Examen 1");

    await user.click(screen.getByRole("button", { name: "Página siguiente" }));
    expect(screen.getByText("Examen 11")).toBeInTheDocument();
    expect(screen.queryByText("Examen 1")).not.toBeInTheDocument();
    expect(screen.getByText("Página 2 de 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Página siguiente" }));
    expect(screen.getByText("Página 3 de 3")).toBeInTheDocument();
    expect(screen.getByText("Examen 23")).toBeInTheDocument();
    // La última página tiene solo 3: el botón de siguiente debe bloquearse
    expect(screen.getByRole("button", { name: "Página siguiente" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Página anterior" }));
    expect(screen.getByText("Página 2 de 3")).toBeInTheDocument();
  });

  it("oculta la paginación cuando cabe todo en una página", async () => {
    for (let i = 1; i <= 7; i++) RECURSOS.push(recurso(String(i), "icfes", `Examen ${i}`));
    montar();
    await screen.findByText("Examen 1");
    expect(screen.queryByRole("button", { name: "Página siguiente" })).not.toBeInTheDocument();
  });

  it("entrega el recurso completo al pulsarlo, para poder abrirlo en el visor", async () => {
    const user = userEvent.setup();
    RECURSOS.push(recurso("42", "icfes", "Examen de genética"));
    const { onAbrir } = montar();
    await user.click(await screen.findByText("Examen de genética"));

    expect(onAbrir).toHaveBeenCalledTimes(1);
    expect(onAbrir.mock.calls[0][0]).toMatchObject({ id: "42", title: "Examen de genética" });
  });

  it("resalta el recurso que se está viendo", async () => {
    RECURSOS.push(recurso("1", "icfes", "Examen A"), recurso("2", "icfes", "Examen B"));
    montar({ activo: "2" });
    await screen.findByText("Examen A");

    expect(screen.getByText("Examen B").closest("button")).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("Examen A").closest("button")).not.toHaveAttribute("aria-current");
  });

  it("no deja la franja en blanco si se borran recursos estando en la última página", async () => {
    const user = userEvent.setup();
    for (let i = 1; i <= 23; i++) RECURSOS.push(recurso(String(i), "icfes", `Examen ${i}`));
    const { rerender } = montar();
    await screen.findByText("Examen 1");

    await user.click(screen.getByRole("button", { name: "Página siguiente" }));
    await user.click(screen.getByRole("button", { name: "Página siguiente" }));
    expect(screen.getByText("Página 3 de 3")).toBeInTheDocument();

    // El docente borra recursos desde el historial general: la página 3 deja
    // de existir y sin ajuste la franja quedaría vacía sin explicación.
    RECURSOS.length = 5;
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    rerender(
      <QueryClientProvider client={qc}>
        <HistorialModulo tipos={["icfes"]} onAbrir={vi.fn()} />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByText("Examen 1")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Página siguiente" })).not.toBeInTheDocument();
  });

  it("acepta varios tipos, para módulos que agrupan más de uno", async () => {
    RECURSOS.push(
      recurso("1", "icfes", "Examen ICFES"),
      recurso("2", "true_false", "Falso y verdadero"),
      recurso("3", "story", "Cuento"),
    );
    montar({ tipos: ["icfes", "true_false"] });

    expect(await screen.findByText("Examen ICFES")).toBeInTheDocument();
    expect(screen.getByText("Falso y verdadero")).toBeInTheDocument();
    expect(screen.queryByText("Cuento")).not.toBeInTheDocument();
  });

  it("muestra los filtros aunque solo haya un recurso", async () => {
    // Con "más de un valor distinto" los filtros desaparecían mientras el
    // docente tuviera un solo recurso, y parecía que la función no existía.
    RECURSOS.push({ ...recurso("1", "icfes", "Examen único"), subject: "Biología", grade: "9" });
    montar();
    await screen.findByText("Examen único");

    expect(screen.getByRole("button", { name: /Filtrar por asignatura/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Filtrar por grado/ })).toBeInTheDocument();
  });

  it("filtra por asignatura y por grado a la vez", async () => {
    const user = userEvent.setup();
    RECURSOS.push(
      { ...recurso("1", "icfes", "Bio grado 9"), subject: "Biología", grade: "9" },
      { ...recurso("2", "icfes", "Bio grado 10"), subject: "Biología", grade: "10" },
      { ...recurso("3", "icfes", "Química grado 9"), subject: "Química", grade: "9" },
    );
    montar();
    await screen.findByText("Bio grado 9");

    await user.click(screen.getByRole("button", { name: /Filtrar por asignatura/ }));
    await user.click(await screen.findByLabelText(/Biología/));
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByText("Química grado 9")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Filtrar por grado/ }));
    await user.click(await screen.findByLabelText(/Grado 10/));

    // Los dos filtros se aplican juntos, no uno u otro
    await waitFor(() => expect(screen.queryByText("Bio grado 9")).not.toBeInTheDocument());
    expect(screen.getByText("Bio grado 10")).toBeInTheDocument();
  });

  it("avisa cuando los filtros no dejan nada", async () => {
    const user = userEvent.setup();
    RECURSOS.push(
      { ...recurso("1", "icfes", "Bio grado 9"), subject: "Biología", grade: "9" },
      { ...recurso("2", "icfes", "Química grado 10"), subject: "Química", grade: "10" },
    );
    montar();
    await screen.findByText("Bio grado 9");

    await user.click(screen.getByRole("button", { name: /Filtrar por asignatura/ }));
    await user.click(await screen.findByLabelText(/Biología/));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: /Filtrar por grado/ }));
    await user.click(await screen.findByLabelText(/Grado 10/));

    expect(await screen.findByText(/Ningún recurso coincide con los filtros/)).toBeInTheDocument();
  });
});
