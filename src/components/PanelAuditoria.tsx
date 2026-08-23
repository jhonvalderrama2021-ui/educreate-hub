import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Clock, Download, Loader2, Search } from "lucide-react";
import { descargarCSV, formatearDuracion } from "@/lib/examen-respuestas";

/**
 * Auditoría de tiempos de acceso.
 *
 * Pedido del asesor con un caso muy concreto: *"a veces los estudiantes dicen
 * 'es que yo sí me conecté toda la noche' y se va a ver la auditoría: entró
 * 10 minutos"*.
 *
 * Qué mide exactamente: el tiempo con la plataforma abierta y la pestaña
 * activa. No es el tiempo dedicado a un examen —eso ya sale en el informe del
 * estudiante— ni prueba que la persona estuviera leyendo. Se dice en pantalla
 * para que nadie use el dato para más de lo que aguanta.
 */

interface FilaAcceso {
  user_id: string;
  nombre: string | null;
  email: string | null;
  rol: string;
  sesiones: number;
  segundos_totales: number;
  primera_vez: string | null;
  ultima_vez: string | null;
}

const PERIODOS = [
  { valor: "7", etiqueta: "Últimos 7 días" },
  { valor: "30", etiqueta: "Últimos 30 días" },
  { valor: "90", etiqueta: "Últimos 3 meses" },
  { valor: "3650", etiqueta: "Todo el histórico" },
];

const fechaHora = (v: string | null) =>
  v ? new Date(v).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) : "—";

export function PanelAuditoria() {
  const [dias, setDias] = useState("30");
  const [busqueda, setBusqueda] = useState("");
  const [filtroRol, setFiltroRol] = useState("todos");

  const { data: filas = [], isLoading } = useQuery({
    queryKey: ["resumen_accesos", dias],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("resumen_accesos", {
        p_dias: Number(dias),
      });
      if (error) throw error;
      return (data || []) as FilaAcceso[];
    },
  });

  const texto = busqueda.toLowerCase();
  const visibles = filas.filter((f) =>
    (texto === "" ||
      (f.nombre || "").toLowerCase().includes(texto) ||
      (f.email || "").toLowerCase().includes(texto)) &&
    (filtroRol === "todos" || f.rol === filtroRol));

  const conActividad = visibles.filter((f) => f.sesiones > 0);
  const nunca = visibles.length - conActividad.length;

  const exportar = () => {
    descargarCSV(`auditoria-accesos-${dias}dias.csv`, [
      ["Nombre", "Correo", "Rol", "Sesiones", "Tiempo total", "Segundos", "Primer acceso", "Último acceso"],
      ...visibles.map((f) => [
        f.nombre || "", f.email || "", f.rol,
        f.sesiones,
        formatearDuracion(f.segundos_totales),
        f.segundos_totales,
        fechaHora(f.primera_vez), fechaHora(f.ultima_vez),
      ]),
    ]);
    toast.success("Archivo descargado");
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-start gap-2">
          <Clock className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div>
            <h2 className="font-semibold text-foreground">Tiempos de acceso</h2>
            <p className="text-sm text-muted-foreground">
              Tiempo con la plataforma abierta y la pestaña activa. No es el tiempo
              dedicado a cada examen —ese sale en el informe del estudiante— ni
              prueba que la persona estuviera leyendo.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              aria-label="Buscar persona"
              placeholder="Buscar por nombre o correo..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="periodo-auditoria" className="text-xs">Periodo</Label>
            <Select value={dias} onValueChange={setDias}>
              <SelectTrigger id="periodo-auditoria" className="w-[180px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIODOS.map((p) => (
                  <SelectItem key={p.valor} value={p.valor}>{p.etiqueta}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rol-auditoria" className="text-xs">Rol</Label>
            <Select value={filtroRol} onValueChange={setFiltroRol}>
              <SelectTrigger id="rol-auditoria" className="w-[140px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="docente">Docente</SelectItem>
                <SelectItem value="estudiante">Estudiante</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" size="sm" onClick={exportar} disabled={visibles.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Exportar
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          {conActividad.length} con actividad en el periodo
          {nunca > 0 && ` · ${nunca} sin entrar`}
        </p>
      </div>

      {isLoading ? (
        <div className="p-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : visibles.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">
          No hay registros para ese filtro.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Persona</th>
                <th className="px-4 py-2 font-medium">Rol</th>
                <th className="px-4 py-2 font-medium text-right">Sesiones</th>
                <th className="px-4 py-2 font-medium text-right">Tiempo total</th>
                <th className="px-4 py-2 font-medium">Último acceso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibles.map((f) => (
                <tr key={f.user_id} className={f.sesiones === 0 ? "text-muted-foreground" : ""}>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-foreground">{f.nombre || "Sin nombre"}</div>
                    <div className="text-xs text-muted-foreground">{f.email}</div>
                  </td>
                  <td className="px-4 py-2.5 text-xs">{f.rol}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{f.sesiones}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {f.sesiones === 0 ? "—" : formatearDuracion(f.segundos_totales)}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {f.sesiones === 0 ? "Nunca entró" : fechaHora(f.ultima_vez)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
