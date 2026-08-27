import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Eliminar un recurso del historial.
 *
 * Lo delicado no es el borrado sino lo que arrastra. Las llaves de la base
 * están encadenadas: recurso → fila que lo pone en el curso → entregas de
 * los estudiantes. Borrar un examen ya aplicado se lleva por delante las
 * notas, sin vuelta atrás.
 *
 * Antes esto era un `confirm("¿Eliminar este recurso?")` de una línea, que
 * no distinguía entre tirar un borrador repetido y borrar las notas de un
 * curso entero. Estas pruebas exigen que el aviso diga cuál de las dos cosas
 * está a punto de pasar.
 */

/** Lo que responderá la base en cada prueba. */
const estado = {
  enCursos: [] as any[],
  entregas: 0,
  borrados: [] as string[],
  fallaLaRevision: false,
};

vi.mock("@/integrations/supabase/client", () => {
  const consultaCursos = () => {
    const q: any = {
      select: () => q,
      eq: () => {
        if (estado.fallaLaRevision) return Promise.reject(new Error("sin red"));
        return Promise.resolve({ data: estado.enCursos, error: null });
      },
    };
    return q;
  };

  const consultaEntregas = () => {
    const q: any = {
      select: () => q,
      in: () => Promise.resolve({ count: estado.entregas, error: null }),
    };
    return q;
  };

  const borrado = () => {
    const q: any = {
      delete: () => q,
      eq: (_col: string, id: string) => {
        estado.borrados.push(id);
        return Promise.resolve({ error: null });
      },
    };
    return q;
  };

  return {
    supabase: {
      from: (tabla: string) => {
        if (tabla === "course_resources") return consultaCursos();
        if (tabla === "resource_submissions") return consultaEntregas();
        return borrado();
      },
    },
  };
});

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { BorrarRecurso } = await import("@/components/BorrarRecurso");

function montar(props: any = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <BorrarRecurso
        recursoId="rec-1"
        titulo="Examen de fracciones"
        claveCache={["generated_resources", "docente-1"]}
        {...props}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  estado.enCursos = [];
  estado.entregas = 0;
  estado.borrados = [];
  estado.fallaLaRevision = false;
});

describe("eliminar un recurso", () => {
  it("si no está en ningún curso, avisa que solo se va del historial", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByLabelText(/Eliminar Examen de fracciones/i));

    await waitFor(() =>
      expect(screen.getByText(/No está en ningún curso/i)).toBeInTheDocument(),
    );
    // Sin alarmas donde no hay nada que perder: si todo avisa, nada avisa.
    expect(screen.queryByText(/notas/i)).not.toBeInTheDocument();
  });

  it("si está en un curso SIN entregas, avisa que los estudiantes lo perderán de vista", async () => {
    estado.enCursos = [{ id: "cr-1", mini_courses: { name: "Grado 5A" } }];
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByLabelText(/Eliminar/i));

    await waitFor(() => expect(screen.getByText(/Grado 5A/)).toBeInTheDocument());
    expect(screen.getByText(/dejarán de verlo/i)).toBeInTheDocument();
  });

  it("si hay entregas, dice cuántas notas se van a borrar", async () => {
    estado.enCursos = [{ id: "cr-1", mini_courses: { name: "Grado 5A" } }];
    estado.entregas = 12;
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByLabelText(/Eliminar/i));

    // El numero concreto importa: "se perderan datos" no le dice al docente
    // si esta tirando un borrador o el trabajo de todo un curso.
    await waitFor(() => expect(screen.getByText(/12 entregas/)).toBeInTheDocument());
    expect(screen.getByText(/no se puede deshacer/i)).toBeInTheDocument();
    // Y se le ofrece la salida que conserva las notas.
    expect(screen.getByText(/quítalo desde el curso/i)).toBeInTheDocument();
    // El boton cambia de texto: confirmar deja de ser un tramite.
    expect(screen.getByRole("button", { name: /Eliminar de todos modos/i })).toBeInTheDocument();
  });

  it("no borra nada mientras no se confirme", async () => {
    estado.enCursos = [{ id: "cr-1", mini_courses: { name: "Grado 5A" } }];
    estado.entregas = 3;
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByLabelText(/Eliminar/i));
    await waitFor(() => expect(screen.getByText(/3 entregas/)).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Cancelar/i }));
    expect(estado.borrados).toEqual([]);
  });

  it("al confirmar, borra y avisa al módulo que lo tenía abierto", async () => {
    const onBorrado = vi.fn();
    const user = userEvent.setup();
    montar({ onBorrado });
    await user.click(screen.getByLabelText(/Eliminar/i));
    await waitFor(() => expect(screen.getByText(/No está en ningún curso/i)).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /^Eliminar$/i }));

    // Sin este aviso el módulo seguiría mostrando el recurso borrado y
    // dejaría guardar cambios sobre una fila que ya no existe.
    await waitFor(() => expect(onBorrado).toHaveBeenCalledWith("rec-1"));
    expect(estado.borrados).toEqual(["rec-1"]);
  });

  it("si no se pudo averiguar el uso, lo dice en vez de callarlo", async () => {
    estado.fallaLaRevision = true;
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByLabelText(/Eliminar/i));

    // Callar la duda seria peor: el docente borraria creyendo que no pasa nada.
    await waitFor(() =>
      expect(screen.getByText(/No se pudo comprobar/i)).toBeInTheDocument(),
    );
  });
});
