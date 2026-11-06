import { useEffect, useState } from "react";
import { descargarExcel } from "@/lib/export-excel";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MessageSquare, Download, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { avisarError } from "@/lib/errores";

interface Observacion {
  id: string;
  user_id: string;
  modulo: string;
  observacion: string;
  atendida: boolean;
  created_at: string;
  autor?: { full_name: string | null; email: string | null };
}

/** Etiquetas legibles para los identificadores de módulo. */
const NOMBRES: Record<string, string> = {
  icfes: "Exámenes",
  true_false: "Exámenes (V/F)",
  mixed: "Exámenes (mixto)",
  workshop: "Talleres",
  lesson_plan: "Plan de clase",
  rubric: "Rúbricas",
  slides: "Diapositivas",
  crucigrama: "Crucigramas",
  cuento: "Cuentos",
  bots: "Bots",
  historial: "Historial",
  mini_cursos: "Mini cursos",
};

const nombreModulo = (m: string) => NOMBRES[m] || m;

/**
 * Consulta de las observaciones que dejan los docentes durante la prueba
 * piloto. Es la fuente de evidencia del cuarto objetivo específico.
 */
export function PanelObservaciones() {
  const [observaciones, setObservaciones] = useState<Observacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState("todas");

  const cargar = async () => {
    setCargando(true);
    const { data, error } = await supabase
      .from("observaciones_piloto")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      avisarError(error, "No se pudieron cargar las observaciones");
      setCargando(false);
      return;
    }

    // Se resuelven los autores en una sola consulta adicional
    const ids = [...new Set((data || []).map((o: any) => o.user_id))];
    let autores = new Map<string, any>();
    if (ids.length) {
      const { data: perfiles } = await supabase
        .from("profiles").select("id, full_name, email").in("id", ids);
      autores = new Map((perfiles || []).map((p: any) => [p.id, p]));
    }

    setObservaciones((data || []).map((o: any) => ({ ...o, autor: autores.get(o.user_id) })));
    setCargando(false);
  };

  useEffect(() => { cargar(); }, []);

  const marcarAtendida = async (id: string, atendida: boolean) => {
    setObservaciones((prev) => prev.map((o) => (o.id === id ? { ...o, atendida } : o)));
    const { error } = await supabase
      .from("observaciones_piloto").update({ atendida }).eq("id", id);
    if (error) {
      avisarError(error, "No se pudo marcar la observación");
      cargar();
    }
  };

  const exportar = async () => {
    await descargarExcel("Observaciones prueba piloto", [{
      nombre: "Observaciones",
      titulo: "Observaciones de la prueba piloto",
      subtitulo: `${observaciones.length} observaciones · ` +
        `${observaciones.filter((o) => !o.atendida).length} pendientes · Generado el ` +
        new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" }),
      columnas: [
        { titulo: "Fecha", ancho: 20 },
        { titulo: "Docente", ancho: 28 },
        { titulo: "Correo", ancho: 30 },
        { titulo: "Módulo", ancho: 20 },
        // La observación es lo que se analiza: se le da el ancho que merece
        { titulo: "Observación", ancho: 45 },
        { titulo: "Atendida", ancho: 11, alineacion: "center" },
      ],
      filas: observaciones.map((o) => [
        new Date(o.created_at).toLocaleString("es-CO"),
        o.autor?.full_name || "—",
        o.autor?.email || "—",
        nombreModulo(o.modulo),
        o.observacion,
        o.atendida ? "Sí" : "No",
      ]),
    }]);
    toast.success("Archivo descargado");
  };

  const modulos = [...new Set(observaciones.map((o) => o.modulo))];
  const visibles = filtro === "todas"
    ? observaciones
    : filtro === "pendientes"
    ? observaciones.filter((o) => !o.atendida)
    : observaciones.filter((o) => o.modulo === filtro);

  const pendientes = observaciones.filter((o) => !o.atendida).length;

  if (cargando) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">{observaciones.length}</strong> observaciones ·{" "}
            <strong className="text-foreground">{pendientes}</strong> sin atender
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Filtrar</Label>
            <Select value={filtro} onValueChange={setFiltro}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="pendientes">Sin atender</SelectItem>
                {modulos.map((m) => (
                  <SelectItem key={m} value={m}>{nombreModulo(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={() => { void exportar(); }} disabled={!observaciones.length}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {visibles.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Todavía no hay observaciones registradas</p>
          <p className="text-xs mt-1">
            Aparecerán aquí cuando los docentes las escriban desde cada módulo
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibles.map((o) => (
            <div
              key={o.id}
              className={`rounded-lg border p-4 ${o.atendida ? "border-border bg-muted/20" : "border-primary/30"}`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {o.autor?.full_name || "Usuario"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {nombreModulo(o.modulo)} · {new Date(o.created_at).toLocaleString("es-CO")}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={o.atendida ? "ghost" : "outline"}
                  onClick={() => marcarAtendida(o.id, !o.atendida)}
                  className="shrink-0"
                >
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                  {o.atendida ? "Atendida" : "Marcar"}
                </Button>
              </div>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {o.observacion}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
