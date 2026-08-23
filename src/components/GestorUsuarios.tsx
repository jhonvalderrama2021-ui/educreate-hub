import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Search, Pencil, UserCheck, UserX, MailCheck, MailWarning, Loader2, Download,
} from "lucide-react";
import { descargarCSV } from "@/lib/examen-respuestas";

/**
 * Gestión de usuarios del panel de administración.
 *
 * Pedido del asesor: *"en el módulo administrador debe poderse verificar los
 * usuarios, editar usuarios, desactivar usuarios — desactivar el docente,
 * desactivar el estudiante"*.
 *
 * Antes solo se podía cambiar el rol. Ahora además se ve si la persona
 * confirmó su correo y cuándo entró por última vez (datos que viven en
 * `auth.users` y solo son accesibles a través de `admin_listar_usuarios`),
 * se pueden corregir nombre y usuario, y se puede cerrar el acceso sin
 * borrar la cuenta — borrarla se llevaría por delante sus recursos y las
 * entregas de sus estudiantes.
 */

export interface UsuarioAdmin {
  id: string;
  email: string | null;
  full_name: string | null;
  username: string | null;
  rol: string;
  activo: boolean;
  correo_confirmado: boolean;
  ultimo_acceso: string | null;
  creado_en: string;
}

/** Los tres roles de la base. `user_roles.role` es un enumerado, no texto libre. */
export type RolUsuario = "admin" | "docente" | "estudiante";

const ROLES: { valor: RolUsuario; etiqueta: string }[] = [
  { valor: "admin", etiqueta: "Admin" },
  { valor: "docente", etiqueta: "Docente" },
  { valor: "estudiante", etiqueta: "Estudiante" },
];

const COLOR_ROL: Record<string, string> = {
  admin: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  docente: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  estudiante: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

const fecha = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }) : "Nunca";

export function GestorUsuarios() {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroRol, setFiltroRol] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [editando, setEditando] = useState<UsuarioAdmin | null>(null);

  const cargar = async () => {
    setCargando(true);
    const { data, error } = await supabase.rpc("admin_listar_usuarios");
    if (error) toast.error("Error al cargar los usuarios");
    setUsuarios((data || []) as UsuarioAdmin[]);
    setCargando(false);
  };

  useEffect(() => { cargar(); }, []);

  const cambiarRol = async (id: string, rol: RolUsuario) => {
    // El rol vive en una tabla aparte, con una fila por usuario: se reemplaza.
    await supabase.from("user_roles").delete().eq("user_id", id);
    const { error } = await supabase.from("user_roles").insert([{ user_id: id, role: rol }]);
    if (error) return toast.error("Error al cambiar el rol");
    setUsuarios((prev) => prev.map((u) => (u.id === id ? { ...u, rol } : u)));
    toast.success("Rol actualizado");
  };

  const cambiarEstado = async (u: UsuarioAdmin) => {
    const desactivando = u.activo;
    if (desactivando && !confirm(
      `¿Desactivar a ${u.full_name || u.email}?\n\n` +
      "No podrá entrar a la plataforma, pero se conservan sus recursos y las " +
      "entregas de sus estudiantes. Puedes reactivarlo cuando quieras."
    )) return;

    const { error } = await supabase.rpc("admin_cambiar_estado_usuario", {
      p_id: u.id, p_activo: !u.activo,
    });
    if (error) return toast.error(error.message || "No se pudo cambiar el estado");

    setUsuarios((prev) => prev.map((x) => (x.id === u.id ? { ...x, activo: !u.activo } : x)));
    toast.success(desactivando ? "Usuario desactivado" : "Usuario reactivado");
  };

  const guardarEdicion = async (nombre: string, usuario: string) => {
    if (!editando) return;
    const { error } = await supabase.rpc("admin_actualizar_usuario", {
      p_id: editando.id, p_nombre: nombre, p_usuario: usuario,
    });
    if (error) {
      toast.error(error.message || "No se pudo guardar");
      return;
    }

    setUsuarios((prev) => prev.map((u) =>
      u.id === editando.id
        ? { ...u, full_name: nombre.trim() || null, username: usuario.trim() || null }
        : u));
    setEditando(null);
    toast.success("Usuario actualizado");
  };

  const exportar = () => {
    descargarCSV("usuarios-nexprofe.csv", [
      ["Nombre", "Usuario", "Correo", "Rol", "Estado", "Correo confirmado", "Último acceso", "Registrado"],
      ...visibles.map((u) => [
        u.full_name || "", u.username || "", u.email || "", u.rol,
        u.activo ? "Activo" : "Desactivado",
        u.correo_confirmado ? "Sí" : "No",
        fecha(u.ultimo_acceso), fecha(u.creado_en),
      ]),
    ]);
    toast.success("Archivo descargado");
  };

  const texto = busqueda.toLowerCase();
  const visibles = usuarios.filter((u) =>
    (texto === "" ||
      (u.full_name || "").toLowerCase().includes(texto) ||
      (u.email || "").toLowerCase().includes(texto) ||
      (u.username || "").toLowerCase().includes(texto)) &&
    (filtroRol === "todos" || u.rol === filtroRol) &&
    (filtroEstado === "todos" ||
      (filtroEstado === "activos" && u.activo) ||
      (filtroEstado === "desactivados" && !u.activo) ||
      (filtroEstado === "sin_confirmar" && !u.correo_confirmado)));

  const sinConfirmar = usuarios.filter((u) => !u.correo_confirmado).length;
  const desactivados = usuarios.filter((u) => !u.activo).length;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              aria-label="Buscar usuario"
              placeholder="Buscar por nombre, correo o usuario..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="filtro-rol" className="text-xs">Rol</Label>
            <Select value={filtroRol} onValueChange={setFiltroRol}>
              <SelectTrigger id="filtro-rol" className="w-[140px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {ROLES.map((r) => <SelectItem key={r.valor} value={r.valor}>{r.etiqueta}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="filtro-estado" className="text-xs">Estado</Label>
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger id="filtro-estado" className="w-[170px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="activos">Activos</SelectItem>
                <SelectItem value="desactivados">Desactivados</SelectItem>
                <SelectItem value="sin_confirmar">Sin confirmar correo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" size="sm" onClick={exportar} disabled={visibles.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Exportar
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          {visibles.length} de {usuarios.length} usuario{usuarios.length === 1 ? "" : "s"}
          {sinConfirmar > 0 && ` · ${sinConfirmar} sin confirmar correo`}
          {desactivados > 0 && ` · ${desactivados} desactivado${desactivados === 1 ? "" : "s"}`}
        </p>
      </div>

      {cargando ? (
        <div className="p-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : visibles.length === 0 ? (
        <p className="p-8 text-center text-muted-foreground text-sm">
          {usuarios.length === 0 ? "No hay usuarios registrados" : "Ningún usuario coincide con los filtros"}
        </p>
      ) : (
        <div className="divide-y divide-border">
          {visibles.map((u) => (
            <div
              key={u.id}
              className={`flex flex-wrap items-center justify-between p-4 gap-4 transition-colors ${
                u.activo ? "hover:bg-muted/30" : "bg-muted/40"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                  u.activo ? "bg-primary/10" : "bg-muted"
                }`}>
                  <span className={`text-sm font-semibold ${u.activo ? "text-primary" : "text-muted-foreground"}`}>
                    {(u.full_name || u.username || u.email || "U")[0].toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className={`font-medium truncate text-sm flex items-center gap-2 ${
                    u.activo ? "text-foreground" : "text-muted-foreground line-through"
                  }`}>
                    {u.full_name || u.username || "Sin nombre"}
                    {u.correo_confirmado ? (
                      <MailCheck className="h-3.5 w-3.5 text-primary shrink-0" aria-label="Correo confirmado" />
                    ) : (
                      <MailWarning className="h-3.5 w-3.5 text-amber-600 shrink-0" aria-label="Correo sin confirmar" />
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Último acceso: {fecha(u.ultimo_acceso)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {!u.activo && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">
                    desactivado
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${COLOR_ROL[u.rol] || ""}`}>
                  {u.rol}
                </span>

                <Select
                  value={u.rol}
                  onValueChange={(v) => cambiarRol(u.id, v as RolUsuario)}
                  disabled={u.id === user?.id}
                >
                  <SelectTrigger className="w-[130px] h-8 text-xs" aria-label={`Rol de ${u.full_name || u.email}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r.valor} value={r.valor}>{r.etiqueta}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Button
                  variant="ghost" size="icon" className="h-8 w-8"
                  onClick={() => setEditando(u)}
                  aria-label={`Editar ${u.full_name || u.email}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost" size="icon"
                  className={`h-8 w-8 ${u.activo ? "text-destructive hover:text-destructive" : "text-primary hover:text-primary"}`}
                  onClick={() => cambiarEstado(u)}
                  disabled={u.id === user?.id}
                  aria-label={`${u.activo ? "Desactivar" : "Reactivar"} ${u.full_name || u.email}`}
                >
                  {u.activo ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editando && (
        <DialogoEditar
          usuario={editando}
          onCerrar={() => setEditando(null)}
          onGuardar={guardarEdicion}
        />
      )}
    </div>
  );
}

function DialogoEditar({ usuario, onCerrar, onGuardar }: {
  usuario: UsuarioAdmin;
  onCerrar: () => void;
  onGuardar: (nombre: string, usuarioNombre: string) => Promise<void>;
}) {
  const [nombre, setNombre] = useState(usuario.full_name || "");
  const [alias, setAlias] = useState(usuario.username || "");
  const [guardando, setGuardando] = useState(false);

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar usuario</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="editar-nombre">Nombre completo</Label>
            <Input id="editar-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="editar-usuario">Nombre de usuario</Label>
            <Input id="editar-usuario" value={alias} onChange={(e) => setAlias(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground">Correo</Label>
            <p className="text-sm text-muted-foreground">{usuario.email}</p>
            <p className="text-xs text-muted-foreground">
              El correo es la credencial de acceso y solo puede cambiarlo la propia
              persona desde su perfil, confirmando desde su bandeja de entrada.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
          <Button
            className="gradient-primary"
            disabled={guardando}
            onClick={async () => {
              setGuardando(true);
              await onGuardar(nombre, alias);
              setGuardando(false);
            }}
          >
            {guardando ? "Guardando..." : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
