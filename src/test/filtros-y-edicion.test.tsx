import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { FiltroMultiple, opcionesDe } from "@/components/FiltroMultiple";
import { DialogoEditarRecurso } from "@/components/DialogoEditarRecurso";

/**
 * Filtros de selección múltiple y edición en panel propio.
 *
 * Dos cosas que el docente pidió al revisar la plataforma:
 *
 *  - Los desplegables solo dejaban elegir un valor. Quien dicta la misma
 *    materia en varios grados tenía que mirar sus recursos de a un grado por
 *    vez.
 *  - La edición se abría DEBAJO del recurso: había que desplazarse para
 *    encontrar los campos, con la vista de lectura todavía ocupando la
 *    pantalla. Ahora se despliega en su propio panel y al cerrarlo se vuelve
 *    a la vista del recurso.
 */

const envoltorio = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

// ─────────────────────────────────────────────────────────────────────────
describe("Filtro de selección múltiple", () => {
  const OPCIONES = [
    { valor: "6", etiqueta: "Grado 6", cantidad: 4 },
    { valor: "7", etiqueta: "Grado 7", cantidad: 2 },
    { valor: "8", etiqueta: "Grado 8", cantidad: 7 },
  ];

  function Sonda({ inicial = [] as string[] }) {
    const [sel, setSel] = useState<string[]>(inicial);
    return (
      <>
        <FiltroMultiple etiqueta="Grado" opciones={OPCIONES} seleccion={sel} onCambio={setSel} />
        <output data-testid="seleccion">{sel.join(",")}</output>
      </>
    );
  }

  it("sin nada marcado dice Todos: no filtra hasta que el docente elige", () => {
    render(<Sonda />);
    expect(screen.getByRole("button", { name: /Filtrar por grado/ })).toHaveTextContent("Todos");
  });

  it("permite marcar varios valores a la vez", async () => {
    const user = userEvent.setup();
    render(<Sonda />);

    await user.click(screen.getByRole("button", { name: /Filtrar por grado/ }));
    await user.click(await screen.findByLabelText(/Grado 6/));
    await user.click(screen.getByLabelText(/Grado 8/));

    // Lo que antes obligaba a mirar de a un grado por vez
    expect(screen.getByTestId("seleccion")).toHaveTextContent("6,8");
  });

  it("muestra cuántos hay de cada valor, para no elegir a ciegas", async () => {
    const user = userEvent.setup();
    render(<Sonda />);
    await user.click(screen.getByRole("button", { name: /Filtrar por grado/ }));

    expect(await screen.findByText("4")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("resume la selección en el botón", async () => {
    const user = userEvent.setup();
    render(<Sonda inicial={["6"]} />);
    const boton = screen.getByRole("button", { name: /Filtrar por grado/ });
    expect(boton).toHaveTextContent("Grado 6");

    await user.click(boton);
    await user.click(await screen.findByLabelText(/Grado 7/));
    expect(boton).toHaveTextContent("2 seleccionados");
  });

  it("se pueden quitar todos de una vez", async () => {
    const user = userEvent.setup();
    render(<Sonda inicial={["6", "7"]} />);

    await user.click(screen.getByRole("button", { name: /Filtrar por grado/ }));
    await user.click(await screen.findByRole("button", { name: /Quitar/ }));

    expect(screen.getByTestId("seleccion")).toHaveTextContent("");
  });

  it("no se muestra si no hay nada que filtrar", () => {
    const { container } = render(
      <FiltroMultiple etiqueta="Grado" opciones={[]} seleccion={[]} onCambio={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("Armado de opciones", () => {
  const RECURSOS = [
    { subject: "Matemáticas", grade: "6" },
    { subject: "Matemáticas", grade: "7" },
    { subject: "Biología", grade: "6" },
    { subject: null, grade: null },
  ];

  it("cuenta cuántos hay de cada valor y descarta los vacíos", () => {
    const opciones = opcionesDe(RECURSOS, (r) => r.subject);
    expect(opciones).toEqual([
      { valor: "Biología", etiqueta: "Biología", cantidad: 1 },
      { valor: "Matemáticas", etiqueta: "Matemáticas", cantidad: 2 },
    ]);
  });

  it("ordena los grados como números, no como texto", () => {
    const muchos = [{ g: "10" }, { g: "2" }, { g: "9" }];
    const opciones = opcionesDe(muchos, (r) => r.g, (v) => `Grado ${v}`);
    // Como texto, "10" iría antes que "2"
    expect(opciones.map((o) => o.valor)).toEqual(["2", "9", "10"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("Panel de edición del recurso", () => {
  const CONTENIDO = {
    title: "Taller de fracciones",
    subject: "Matemáticas",
    grade: "5",
    objective: "Resolver situaciones con fracciones",
    activities: [],
  };

  const montar = (props: any = {}) => {
    const onGuardar = props.onGuardar || vi.fn(async () => true);
    const onCerrar = props.onCerrar || vi.fn();
    render(
      <DialogoEditarRecurso
        abierto
        onCerrar={onCerrar}
        tipo="workshop"
        contenidoOriginal={CONTENIDO}
        tituloOriginal="Taller de fracciones"
        onGuardar={onGuardar}
      />,
      { wrapper: envoltorio() },
    );
    return { onGuardar, onCerrar };
  };

  beforeEach(() => { vi.stubGlobal("confirm", () => true); });

  it("se abre como panel con el título del recurso cargado", () => {
    montar();
    expect(screen.getByRole("heading", { name: "Editar recurso" })).toBeInTheDocument();
    expect(screen.getByLabelText("Título")).toHaveValue("Taller de fracciones");
  });

  it("avisa de que guarda sobre el mismo recurso, sin duplicarlo", () => {
    montar();
    expect(screen.getByText(/sin crear una copia/)).toBeInTheDocument();
  });

  it("no deja guardar si no se cambió nada", () => {
    montar();
    expect(screen.getByRole("button", { name: /Guardar cambios/ })).toBeDisabled();
    expect(screen.getByText("Sin cambios")).toBeInTheDocument();
  });

  it("guarda y vuelve a la vista del recurso", async () => {
    const user = userEvent.setup();
    const { onGuardar, onCerrar } = montar();

    const titulo = screen.getByLabelText("Título");
    await user.clear(titulo);
    await user.type(titulo, "Taller de fracciones equivalentes");
    await user.click(screen.getByRole("button", { name: /Guardar cambios/ }));

    await waitFor(() => expect(onGuardar).toHaveBeenCalledTimes(1));
    expect(onGuardar.mock.calls[0][1]).toBe("Taller de fracciones equivalentes");
    // Al guardar se cierra: eso es "volver a la vista del recurso"
    await waitFor(() => expect(onCerrar).toHaveBeenCalled());
  });

  it("no cierra si el guardado falla: se perderían los cambios", async () => {
    const user = userEvent.setup();
    const onGuardar = vi.fn(async () => false);
    const { onCerrar } = montar({ onGuardar });

    await user.type(screen.getByLabelText("Título"), " corregido");
    await user.click(screen.getByRole("button", { name: /Guardar cambios/ }));

    await waitFor(() => expect(onGuardar).toHaveBeenCalled());
    expect(onCerrar).not.toHaveBeenCalled();
  });

  it("pide confirmación antes de cerrar con cambios sin guardar", async () => {
    const user = userEvent.setup();
    const avisos: string[] = [];
    vi.stubGlobal("confirm", (m: string) => { avisos.push(m); return false; });

    const { onCerrar } = montar();
    await user.type(screen.getByLabelText("Título"), " x");
    await user.click(screen.getByRole("button", { name: /Cerrar/ }));

    expect(avisos[0]).toMatch(/cambios sin guardar/i);
    expect(onCerrar).not.toHaveBeenCalled();
  });

  it("cierra sin preguntar si no se tocó nada", async () => {
    const user = userEvent.setup();
    const avisos: string[] = [];
    vi.stubGlobal("confirm", (m: string) => { avisos.push(m); return true; });

    const { onCerrar } = montar();
    await user.click(screen.getByRole("button", { name: /Cerrar/ }));

    expect(avisos).toHaveLength(0);
    expect(onCerrar).toHaveBeenCalled();
  });

  it("trabaja sobre una copia: cancelar no toca el recurso original", async () => {
    const user = userEvent.setup();
    const original = JSON.parse(JSON.stringify(CONTENIDO));
    montar();

    await user.type(screen.getByLabelText("Título"), " modificado");
    await user.click(screen.getByRole("button", { name: /Cerrar/ }));

    expect(CONTENIDO).toEqual(original);
  });
});
