import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

/**
 * Regresión de la tarea 8 (observaciones del asesor en la reunión):
 *
 *  1. "el bot queda muy básico" — con solo nombre y especialidad el asistente
 *     responde de forma genérica. Ahora el docente puede precisar cómo debe
 *     comportarse (campo Personalización) y a qué nivel educativo se dirige.
 *  2. No existía forma de corregir un bot: había que borrarlo y volver a
 *     crearlo, perdiendo la conversación. Ahora se edita.
 *
 * La trampa que estas pruebas vigilan: que el botón de guardar haga UPDATE
 * cuando se está editando e INSERT cuando se está creando. Si al editar hace
 * insert, el docente termina con bots duplicados sin darse cuenta.
 */

const BOTS = [
  {
    id: "b1",
    name: "MateBot",
    specialty: "Matemáticas",
    detalle: "Enfócate en álgebra básica y no resuelvas los ejercicios completos.",
    nivel_educativo: "Grado 8",
    created_at: "2026-08-01T10:00:00Z",
  },
];

const llamadas: { tipo: string; datos: any; id?: string }[] = [];

vi.mock("@/hooks/useAuth", () => {
  // Referencia estable: si cada render devuelve un objeto nuevo, el
  // useEffect([user]) de BotList vuelve a cargar en bucle y nunca termina.
  const user = { id: "docente-1" };
  return { useAuth: () => ({ user }) };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/CampoObservacion", () => ({
  CampoObservacion: () => null,
}));

vi.mock("@/integrations/supabase/client", () => {
  const consulta = () => {
    let pendiente: { tipo: string; datos: any } | null = null;
    const q: any = {
      select: () => q,
      order: () => q,
      eq: (_col: string, valor: string) => {
        if (pendiente) { llamadas.push({ ...pendiente, id: valor }); pendiente = null; }
        return q;
      },
      insert: (datos: any) => { llamadas.push({ tipo: "insert", datos }); return Promise.resolve({ error: null }); },
      update: (datos: any) => { pendiente = { tipo: "update", datos }; return q; },
      delete: () => { pendiente = { tipo: "delete", datos: null }; return q; },
      then: (res: any) => res({ data: BOTS, error: null }),
    };
    return q;
  };
  return { supabase: { from: () => consulta() } };
});

const { default: BotList } = await import("@/pages/resources/BotList");

const montar = () => render(<MemoryRouter><BotList /></MemoryRouter>);

describe("Asistentes conversacionales", () => {
  beforeEach(() => { llamadas.length = 0; });

  it("muestra la personalización y el nivel educativo en la tarjeta del bot", async () => {
    montar();
    expect(await screen.findByText("MateBot")).toBeInTheDocument();
    expect(screen.getByText(/Enfócate en álgebra básica/)).toBeInTheDocument();
    expect(screen.getByText(/Grado 8/)).toBeInTheDocument();
  });

  it("el formulario nuevo ofrece personalización y nivel, no solo nombre y especialidad", async () => {
    const user = userEvent.setup();
    montar();
    await screen.findByText("MateBot");
    await user.click(screen.getByRole("button", { name: /Nuevo Bot/ }));

    expect(screen.getByLabelText(/Nombre del bot/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Especialidad/)).toBeInTheDocument();
    expect(screen.getByLabelText("Nivel educativo")).toBeInTheDocument();
    expect(screen.getByLabelText("Personalización")).toBeInTheDocument();
  });

  it("crear un bot hace insert con la personalización incluida", async () => {
    const user = userEvent.setup();
    montar();
    await screen.findByText("MateBot");
    await user.click(screen.getByRole("button", { name: /Nuevo Bot/ }));

    await user.type(screen.getByLabelText(/Nombre del bot/), "HistorIA");
    await user.type(screen.getByLabelText(/^Especialidad/), "Historia de Colombia");
    await user.type(screen.getByLabelText("Nivel educativo"), "Grado 10");
    await user.type(screen.getByLabelText("Personalización"), "Céntrate en el siglo XX.");
    await user.click(screen.getByRole("button", { name: "Crear Bot" }));

    await waitFor(() => expect(llamadas.filter((l) => l.tipo === "insert")).toHaveLength(1));
    expect(llamadas[0].datos).toMatchObject({
      user_id: "docente-1",
      name: "HistorIA",
      specialty: "Historia de Colombia",
      nivel_educativo: "Grado 10",
      detalle: "Céntrate en el siglo XX.",
    });
  });

  it("editar carga los datos existentes en el formulario", async () => {
    const user = userEvent.setup();
    montar();
    await screen.findByText("MateBot");
    await user.click(screen.getByRole("button", { name: "Editar MateBot" }));

    expect(screen.getByRole("heading", { name: /Editar bot/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/Nombre del bot/)).toHaveValue("MateBot");
    expect(screen.getByLabelText(/^Especialidad/)).toHaveValue("Matemáticas");
    expect(screen.getByLabelText("Nivel educativo")).toHaveValue("Grado 8");
    expect(screen.getByLabelText("Personalización")).toHaveValue(BOTS[0].detalle);
  });

  it("guardar una edición hace UPDATE sobre el mismo bot, nunca un insert", async () => {
    const user = userEvent.setup();
    montar();
    await screen.findByText("MateBot");
    await user.click(screen.getByRole("button", { name: "Editar MateBot" }));

    const personalizacion = screen.getByLabelText("Personalización");
    await user.clear(personalizacion);
    await user.type(personalizacion, "Ahora también geometría.");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(llamadas.filter((l) => l.tipo === "update")).toHaveLength(1));
    // Duplicar el bot en lugar de corregirlo es el fallo que se vigila
    expect(llamadas.filter((l) => l.tipo === "insert")).toHaveLength(0);
    const update = llamadas.find((l) => l.tipo === "update")!;
    expect(update.id).toBe("b1");
    expect(update.datos).toMatchObject({
      name: "MateBot",
      detalle: "Ahora también geometría.",
    });
    expect(update.datos.updated_at).toBeTruthy();
  });

  it("cancelar una edición limpia el formulario y sale del modo edición", async () => {
    const user = userEvent.setup();
    montar();
    await screen.findByText("MateBot");
    await user.click(screen.getByRole("button", { name: "Editar MateBot" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    // Si el estado de edición sobrevive, el siguiente "Nuevo Bot" abriría el
    // formulario con los datos del bot anterior y lo sobrescribiría.
    await user.click(screen.getByRole("button", { name: /Nuevo Bot/ }));
    expect(screen.getByRole("heading", { name: "Nuevo Bot" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Nombre del bot/)).toHaveValue("");
    expect(screen.getByLabelText("Personalización")).toHaveValue("");
  });

  it("no guarda si falta el nombre o la especialidad", async () => {
    const user = userEvent.setup();
    montar();
    await screen.findByText("MateBot");
    await user.click(screen.getByRole("button", { name: /Nuevo Bot/ }));
    await user.type(screen.getByLabelText(/Nombre del bot/), "Sin especialidad");
    await user.click(screen.getByRole("button", { name: "Crear Bot" }));

    expect(llamadas.filter((l) => l.tipo === "insert")).toHaveLength(0);
  });
});
