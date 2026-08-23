import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Tarea 10 de P2 — gestión de usuarios desde administración.
 *
 * Pedido del asesor: *"en el módulo administrador debe poderse verificar los
 * usuarios, editar usuarios, desactivar usuarios — desactivar el docente,
 * desactivar el estudiante"*. Antes solo se podía cambiar el rol.
 *
 * Lo que estas pruebas protegen:
 *  - que un administrador no pueda desactivarse ni degradarse a sí mismo:
 *    dejaría la plataforma sin nadie que pueda revertirlo
 *  - que desactivar pida confirmación, porque cierra el acceso a una persona
 *  - que se vea quién no ha confirmado el correo, que es lo que el asesor
 *    llamó "verificar los usuarios"
 */

const USUARIOS = [
  {
    id: "admin-1", email: "jhon@itp.edu.co", full_name: "Jhon Valderrama",
    username: "jhonv", rol: "admin", activo: true, correo_confirmado: true,
    ultimo_acceso: "2026-08-22T10:00:00Z", creado_en: "2026-03-01T10:00:00Z",
  },
  {
    id: "doc-1", email: "ana@itp.edu.co", full_name: "Ana Ruiz",
    username: "anar", rol: "docente", activo: true, correo_confirmado: true,
    ultimo_acceso: "2026-08-20T10:00:00Z", creado_en: "2026-04-01T10:00:00Z",
  },
  {
    id: "est-1", email: "luis@itp.edu.co", full_name: "Luis Gómez",
    username: null, rol: "estudiante", activo: false, correo_confirmado: false,
    ultimo_acceso: null, creado_en: "2026-05-01T10:00:00Z",
  },
];

const rpcs: { nombre: string; args: any }[] = [];
const confirmaciones: string[] = [];
let confirmar = true;

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/hooks/useAuth", () => {
  const user = { id: "admin-1" };
  return { useAuth: () => ({ user }) };
});

vi.mock("@/lib/examen-respuestas", () => ({ descargarCSV: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => {
  const consulta = () => {
    const q: any = {
      delete: () => q,
      insert: (fila: any) => { rpcs.push({ nombre: "insert_rol", args: fila }); return Promise.resolve({ error: null }); },
      eq: () => q,
      then: (res: any) => res({ data: null, error: null }),
    };
    return q;
  };
  return {
    supabase: {
      from: () => consulta(),
      rpc: (nombre: string, args: any) => {
        rpcs.push({ nombre, args });
        if (nombre === "admin_listar_usuarios") return Promise.resolve({ data: USUARIOS, error: null });
        return Promise.resolve({ data: null, error: null });
      },
    },
  };
});

const { GestorUsuarios } = await import("@/components/GestorUsuarios");

describe("Gestión de usuarios", () => {
  beforeEach(() => {
    rpcs.length = 0;
    confirmaciones.length = 0;
    confirmar = true;
    vi.stubGlobal("confirm", (mensaje: string) => { confirmaciones.push(mensaje); return confirmar; });
  });

  it("lista los usuarios con su rol y su último acceso", async () => {
    render(<GestorUsuarios />);
    expect(await screen.findByText("Jhon Valderrama")).toBeInTheDocument();
    expect(screen.getByText("Ana Ruiz")).toBeInTheDocument();
    expect(screen.getByText("Luis Gómez")).toBeInTheDocument();
    expect(screen.getByText(/Último acceso: Nunca/)).toBeInTheDocument();
  });

  it("señala quién no ha confirmado el correo y quién está desactivado", async () => {
    render(<GestorUsuarios />);
    await screen.findByText("Luis Gómez");

    expect(screen.getAllByLabelText("Correo confirmado")).toHaveLength(2);
    expect(screen.getAllByLabelText("Correo sin confirmar")).toHaveLength(1);
    expect(screen.getByText("desactivado")).toBeInTheDocument();
    expect(screen.getByText(/1 sin confirmar correo/)).toBeInTheDocument();
    expect(screen.getByText(/1 desactivado/)).toBeInTheDocument();
  });

  it("no deja que el administrador se desactive ni se cambie el rol a sí mismo", async () => {
    render(<GestorUsuarios />);
    await screen.findByText("Jhon Valderrama");

    expect(screen.getByLabelText("Desactivar Jhon Valderrama")).toBeDisabled();
    expect(screen.getByLabelText("Rol de Jhon Valderrama")).toBeDisabled();
    // Los demás sí se pueden tocar
    expect(screen.getByLabelText("Desactivar Ana Ruiz")).not.toBeDisabled();
  });

  it("pide confirmación antes de cerrarle el acceso a alguien", async () => {
    const user = userEvent.setup();
    render(<GestorUsuarios />);
    await screen.findByText("Ana Ruiz");

    await user.click(screen.getByLabelText("Desactivar Ana Ruiz"));

    expect(confirmaciones[0]).toContain("Ana Ruiz");
    // El aviso debe dejar claro que no se pierde nada
    expect(confirmaciones[0]).toMatch(/se conservan sus recursos/);
    await waitFor(() =>
      expect(rpcs.find((r) => r.nombre === "admin_cambiar_estado_usuario")).toMatchObject({
        args: { p_id: "doc-1", p_activo: false },
      }));
  });

  it("no desactiva si el administrador cancela la confirmación", async () => {
    const user = userEvent.setup();
    confirmar = false;
    render(<GestorUsuarios />);
    await screen.findByText("Ana Ruiz");

    await user.click(screen.getByLabelText("Desactivar Ana Ruiz"));

    expect(rpcs.find((r) => r.nombre === "admin_cambiar_estado_usuario")).toBeUndefined();
  });

  it("reactiva sin pedir confirmación: es la acción que no hace daño", async () => {
    const user = userEvent.setup();
    render(<GestorUsuarios />);
    await screen.findByText("Luis Gómez");

    await user.click(screen.getByLabelText("Reactivar Luis Gómez"));

    expect(confirmaciones).toHaveLength(0);
    await waitFor(() =>
      expect(rpcs.find((r) => r.nombre === "admin_cambiar_estado_usuario")).toMatchObject({
        args: { p_id: "est-1", p_activo: true },
      }));
  });

  it("edita nombre y usuario, y avisa de que el correo no se toca desde aquí", async () => {
    const user = userEvent.setup();
    render(<GestorUsuarios />);
    await screen.findByText("Ana Ruiz");

    await user.click(screen.getByLabelText("Editar Ana Ruiz"));

    const nombre = screen.getByLabelText("Nombre completo");
    expect(nombre).toHaveValue("Ana Ruiz");
    expect(screen.getByText(/solo puede cambiarlo la propia persona/)).toBeInTheDocument();

    await user.clear(nombre);
    await user.type(nombre, "Ana María Ruiz");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(rpcs.find((r) => r.nombre === "admin_actualizar_usuario")).toMatchObject({
        args: { p_id: "doc-1", p_nombre: "Ana María Ruiz", p_usuario: "anar" },
      }));
  });

  it("filtra por estado para encontrar a los que faltan por confirmar", async () => {
    const user = userEvent.setup();
    render(<GestorUsuarios />);
    await screen.findByText("Ana Ruiz");

    await user.click(screen.getByLabelText("Estado"));
    await user.click(await screen.findByRole("option", { name: "Sin confirmar correo" }));

    await waitFor(() => expect(screen.queryByText("Ana Ruiz")).not.toBeInTheDocument());
    expect(screen.getByText("Luis Gómez")).toBeInTheDocument();
    expect(screen.getByText(/1 de 3 usuarios/)).toBeInTheDocument();
  });

  it("busca por nombre, correo o usuario", async () => {
    const user = userEvent.setup();
    render(<GestorUsuarios />);
    await screen.findByText("Ana Ruiz");

    await user.type(screen.getByLabelText("Buscar usuario"), "luis@");

    await waitFor(() => expect(screen.queryByText("Ana Ruiz")).not.toBeInTheDocument());
    expect(screen.getByText("Luis Gómez")).toBeInTheDocument();
  });
});
