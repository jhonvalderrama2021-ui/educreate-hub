import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  FileText, Download, Loader2, CheckCircle2, AlertTriangle, Inbox,
} from "lucide-react";
import { tamanoLegible } from "@/components/EntregaDeTarea";

/**
 * Entregas con archivo que ha recibido el docente, para revisarlas y poner
 * la nota.
 *
 * Un taller no se califica solo: la nota la escribe el docente después de
 * abrir el trabajo. Por eso aquí no hay nada automático, solo el archivo, un
 * campo de nota y uno de comentario.
 */

interface EntregaRecibida {
  id: string;
  student_id: string;
  course_resource_id: string;
  archivo_ruta: string | null;
  archivo_nombre: string | null;
  archivo_tamano: number | null;
  comentario_estudiante: string | null;
  comentario_docente: string | null;
  score: number | null;
  max_score: number | null;
  submitted_at: string;
}

interface Props {
  courseId: string;
  /** Si se indica, solo las entregas de ese estudiante. */
  studentId?: string;
  /** Título de cada recurso, para nombrar la entrega. */
  titulosPorRecurso: Record<string, string>;
  /** Nombre de cada estudiante, cuando se listan varios. */
  nombresPorEstudiante?: Record<string, string>;
  /** Fecha límite de cada recurso, para marcar las tardías. */
  limitesPorRecurso?: Record<string, string | null>;
}

export function RevisarEntregas({
  courseId, studentId, titulosPorRecurso, nombresPorEstudiante, limitesPorRecurso,
}: Props) {
  const qc = useQueryClient();
  const [guardando, setGuardando] = useState<string | null>(null);
  const [borradores, setBorradores] = useState<Record<string, { nota: string; comentario: string }>>({});

  const clave = ["entregas_archivo", courseId, studentId ?? "todos"] as const;

  const { data: entregas = [], isLoading } = useQuery({
    queryKey: clave,
    queryFn: async () => {
      let consulta = supabase
        .from("resource_submissions")
        .select("*")
        .eq("course_id", courseId)
        .not("archivo_ruta", "is", null)
        .order("submitted_at", { ascending: false });
      if (studentId) consulta = consulta.eq("student_id", studentId);
      const { data, error } = await consulta;
      if (error) throw error;
      return (data || []) as unknown as EntregaRecibida[];
    },
  });

  const abrir = async (e: EntregaRecibida) => {
    if (!e.archivo_ruta) return;
    // Enlace firmado y de un minuto: el bucket es privado y una URL pública
    // dejaría los trabajos del curso al alcance de cualquiera con el enlace.
    const { data, error } = await supabase.storage
      .from("entregas-tareas")
      .createSignedUrl(e.archivo_ruta, 60);
    if (error || !data) return toast.error("No se pudo abrir el archivo");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const calificar = async (e: EntregaRecibida) => {
    const borrador = borradores[e.id] ?? { nota: "", comentario: e.comentario_docente ?? "" };
    const nota = parseFloat(borrador.nota.replace(",", "."));
    if (Number.isNaN(nota) || nota < 0 || nota > 5) {
      return toast.error("La nota debe estar entre 0,0 y 5,0");
    }

    setGuardando(e.id);
    // Se guarda sobre 5 puntos: el resto de la plataforma calcula la nota
    // como score/max_score × 5, así que con max_score = 5 la nota es la nota.
    const { error } = await supabase.from("resource_submissions").update({
      score: nota,
      max_score: 5,
      comentario_docente: borrador.comentario.trim() || null,
      calificado_en: new Date().toISOString(),
    }).eq("id", e.id);
    setGuardando(null);

    if (error) return toast.error(error.message || "No se pudo calificar");
    qc.invalidateQueries({ queryKey: clave });
    qc.invalidateQueries({ queryKey: ["submissions_course", courseId] });
    qc.invalidateQueries({ queryKey: ["report_subs", courseId] });
    toast.success("Calificación guardada");
  };

  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-8 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (entregas.length === 0) {
    return (
      <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
        <Inbox className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">
          Todavía no hay trabajos entregados. Recuerda marcar el recurso como
          «Pedir entrega de archivo» en su configuración.
        </p>
      </div>
    );
  }

  const sinCalificar = entregas.filter((e) => e.score === null).length;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {entregas.length} trabajo{entregas.length === 1 ? "" : "s"} recibido
        {entregas.length === 1 ? "" : "s"}
        {sinCalificar > 0 && ` · ${sinCalificar} sin calificar`}
      </p>

      {entregas.map((e) => {
        const limite = limitesPorRecurso?.[e.course_resource_id];
        const tardia = !!limite && new Date(e.submitted_at) > new Date(limite);
        const borrador = borradores[e.id] ?? {
          nota: e.score !== null ? String(e.score) : "",
          comentario: e.comentario_docente ?? "",
        };
        const calificada = e.score !== null;

        return (
          <div key={e.id} className="glass-card rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 shrink-0 text-primary mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground text-sm">
                  {titulosPorRecurso[e.course_resource_id] || "Actividad"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {nombresPorEstudiante?.[e.student_id] &&
                    `${nombresPorEstudiante[e.student_id]} · `}
                  {e.archivo_nombre} · {tamanoLegible(e.archivo_tamano)}
                </p>
                <p className={`text-xs flex items-center gap-1 mt-0.5 ${
                  tardia ? "text-amber-700 dark:text-amber-500" : "text-muted-foreground"
                }`}>
                  {tardia && <AlertTriangle className="h-3 w-3" />}
                  {tardia ? "Entregado fuera de plazo el " : "Entregado el "}
                  {new Date(e.submitted_at).toLocaleString("es-CO")}
                </p>
              </div>
              {calificada && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />}
              <Button variant="outline" size="sm" onClick={() => abrir(e)}>
                <Download className="h-3.5 w-3.5 mr-1" /> Abrir
              </Button>
            </div>

            {e.comentario_estudiante && (
              <p className="text-sm text-muted-foreground bg-muted/40 rounded-lg p-3 whitespace-pre-line">
                {e.comentario_estudiante}
              </p>
            )}

            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`nota-${e.id}`} className="text-xs">Nota (0 a 5)</Label>
                <Input
                  id={`nota-${e.id}`}
                  className="w-24"
                  inputMode="decimal"
                  placeholder="0,0"
                  value={borrador.nota}
                  onChange={(ev) => setBorradores((p) => ({
                    ...p, [e.id]: { ...borrador, nota: ev.target.value },
                  }))}
                />
              </div>
              <div className="space-y-1.5 flex-1 min-w-[220px]">
                <Label htmlFor={`comentario-${e.id}`} className="text-xs">
                  Comentario para el estudiante
                </Label>
                <Textarea
                  id={`comentario-${e.id}`}
                  rows={2}
                  maxLength={1000}
                  value={borrador.comentario}
                  onChange={(ev) => setBorradores((p) => ({
                    ...p, [e.id]: { ...borrador, comentario: ev.target.value },
                  }))}
                  placeholder="Qué hizo bien y qué puede mejorar."
                />
              </div>
              <Button
                className="gradient-primary"
                disabled={guardando === e.id}
                onClick={() => calificar(e)}
              >
                {guardando === e.id ? "Guardando..." : calificada ? "Actualizar nota" : "Calificar"}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
