import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Clock, ChevronDown, Download, Loader2, Info } from "lucide-react";
import { formatearDuracion, iniciales } from "@/lib/examen-respuestas";
import { descargarExcel, type ValorCelda } from "@/lib/export-excel";

/**
 * Cuándo se conectó cada estudiante del curso y cuánto tiempo estuvo.
 *
 * Pedido del docente: verlo sin tener que abrir estudiante por estudiante.
 * Por eso la lista es una sola, con todos, y el detalle de cada sesión se
 * despliega al pulsar.
 *
 * ⚠️ Lo que mide: tiempo con la PLATAFORMA abierta, no dentro de este curso.
 * El registro de actividad no sabe en qué pantalla está la persona. Se dice
 * en pantalla para que el dato no se use para más de lo que aguanta: el
 * tiempo dedicado a una actividad concreta sí está, y sale en su informe.
 */

interface Conexion {
  student_id: string;
  nombre: string | null;
  email: string | null;
  inicio: string;
  fin: string;
  segundos: number;
}

const PERIODOS = [
  { valor: "7", etiqueta: "Últimos 7 días" },
  { valor: "30", etiqueta: "Últimos 30 días" },
  { valor: "90", etiqueta: "Últimos 3 meses" },
];

const soloFecha = (v: string) =>
  new Date(v).toLocaleDateString("es-CO", { weekday: "short", day: "2-digit", month: "short" });
const soloHora = (v: string) =>
  new Date(v).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

export function ConexionesDelCurso({ courseId, nombreCurso }: {
  courseId: string;
  nombreCurso: string;
}) {
  const [dias, setDias] = useState("30");
  const [abierto, setAbierto] = useState<string | null>(null);

  const { data: conexiones = [], isLoading } = useQuery({
    queryKey: ["conexiones_curso", courseId, dias],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("conexiones_del_curso", {
        p_course_id: courseId,
        p_dias: Number(dias),
      });
      if (error) throw error;
      return (data || []) as Conexion[];
    },
  });

  /** Una entrada por estudiante, con sus sesiones dentro. */
  const porEstudiante = useMemo(() => {
    const mapa = new Map<string, {
      id: string; nombre: string; email: string;
      sesiones: Conexion[]; total: number; ultima: string;
    }>();
    for (const c of conexiones) {
      const actual = mapa.get(c.student_id) ?? {
        id: c.student_id,
        nombre: c.nombre || "Sin nombre",
        email: c.email || "",
        sesiones: [], total: 0, ultima: c.fin,
      };
      actual.sesiones.push(c);
      actual.total += c.segundos;
      if (new Date(c.fin) > new Date(actual.ultima)) actual.ultima = c.fin;
      mapa.set(c.student_id, actual);
    }
    return [...mapa.values()].sort(
      (a, b) => new Date(b.ultima).getTime() - new Date(a.ultima).getTime());
  }, [conexiones]);

  const exportar = async () => {
    if (conexiones.length === 0) return toast.error("No hay conexiones que exportar");

    const detalle: ValorCelda[][] = conexiones.map((c) => [
      c.nombre || "Sin nombre",
      c.email || "",
      new Date(c.inicio).toLocaleDateString("es-CO"),
      soloHora(c.inicio),
      soloHora(c.fin),
      formatearDuracion(c.segundos),
      c.segundos,
    ]);

    const resumen: ValorCelda[][] = porEstudiante.map((e) => [
      e.nombre, e.email, e.sesiones.length,
      formatearDuracion(e.total), e.total,
      new Date(e.ultima).toLocaleString("es-CO"),
    ]);

    const periodo = PERIODOS.find((p) => p.valor === dias)?.etiqueta ?? `${dias} días`;
    const fecha = new Date().toLocaleDateString("es-CO",
      { day: "2-digit", month: "long", year: "numeric" });

    await descargarExcel(`Conexiones ${nombreCurso}`, [
      {
        nombre: "Resumen por estudiante",
        titulo: `${nombreCurso} — Conexiones`,
        subtitulo: `${periodo} · ${porEstudiante.length} estudiantes · Generado el ${fecha}`,
        columnas: [
          { titulo: "Estudiante", ancho: 30 },
          { titulo: "Correo", ancho: 32 },
          { titulo: "Veces que entró", ancho: 15, alineacion: "right" },
          { titulo: "Tiempo total", ancho: 14 },
          { titulo: "Segundos", ancho: 12, formato: "0", alineacion: "right" },
          { titulo: "Última vez", ancho: 20 },
        ],
        filas: resumen,
      },
      {
        nombre: "Cada conexión",
        titulo: `${nombreCurso} — Detalle de conexiones`,
        subtitulo: `${periodo} · ${conexiones.length} conexiones · Generado el ${fecha}`,
        columnas: [
          { titulo: "Estudiante", ancho: 30 },
          { titulo: "Correo", ancho: 32 },
          { titulo: "Día", ancho: 14 },
          { titulo: "Entró a las", ancho: 13, alineacion: "center" },
          { titulo: "Hasta las", ancho: 13, alineacion: "center" },
          { titulo: "Duración", ancho: 13 },
          { titulo: "Segundos", ancho: 12, formato: "0", alineacion: "right" },
        ],
        filas: detalle,
      },
    ]);
    toast.success("Archivo descargado");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="periodo-conexiones" className="text-xs">Periodo</Label>
          <Select value={dias} onValueChange={setDias}>
            <SelectTrigger id="periodo-conexiones" className="w-[180px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIODOS.map((p) => (
                <SelectItem key={p.valor} value={p.valor}>{p.etiqueta}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={() => { void exportar(); }}
          disabled={conexiones.length === 0}>
          <Download className="h-4 w-4 mr-2" /> Exportar en Excel
        </Button>
      </div>

      <p className="text-xs text-muted-foreground flex items-start gap-1.5">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        Es el tiempo con la plataforma abierta y la pestaña activa, no el
        tiempo dentro de este curso: el registro no sabe en qué pantalla está
        la persona. El tiempo dedicado a cada actividad sí sale en el informe
        de cada estudiante.
      </p>

      {isLoading ? (
        <div className="glass-card rounded-xl p-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : porEstudiante.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">
            Ningún estudiante del curso se ha conectado en este periodo.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {porEstudiante.map((e) => {
            const expandido = abierto === e.id;
            return (
              <div key={e.id} className="border border-border rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setAbierto(expandido ? null : e.id)}
                  aria-expanded={expandido}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/40 transition-colors"
                >
                  <div className="h-9 w-9 rounded-full gradient-primary flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary-foreground">
                      {iniciales(e.nombre)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground text-sm truncate">{e.nombre}</div>
                    <div className="text-xs text-muted-foreground">
                      Entró {e.sesiones.length} {e.sesiones.length === 1 ? "vez" : "veces"} ·
                      última vez el {new Date(e.ultima).toLocaleDateString("es-CO")} a las{" "}
                      {soloHora(e.ultima)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-semibold text-foreground text-sm">
                      {formatearDuracion(e.total)}
                    </div>
                    <div className="text-xs text-muted-foreground">en total</div>
                  </div>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                    expandido ? "rotate-180" : ""
                  }`} />
                </button>

                {expandido && (
                  <ul className="border-t border-border divide-y divide-border bg-muted/20">
                    {e.sesiones.map((s, i) => (
                      <li key={i} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                        <span className="text-foreground capitalize">{soloFecha(s.inicio)}</span>
                        <span className="text-muted-foreground">
                          {soloHora(s.inicio)} — {soloHora(s.fin)}
                        </span>
                        <span className="text-muted-foreground tabular-nums">
                          {formatearDuracion(s.segundos)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
