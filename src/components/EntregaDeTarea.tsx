import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Upload, FileText, CheckCircle2, Clock, Download, Trash2, Loader2, AlertTriangle,
} from "lucide-react";
import { avisarError } from "@/lib/errores";

/**
 * Entrega de una tarea con archivo.
 *
 * Pedido del docente: los recursos que no son exámenes —un taller, una guía—
 * no tenían forma de entregarse. El estudiante los abría y ahí terminaba
 * todo, así que el docente no podía comprobar que los hubiera hecho.
 */

export const TIPOS_ACEPTADOS = ".pdf,.doc,.docx,.jpg,.jpeg,.png";
/** El mismo tope que el bucket. Se comprueba antes de subir para dar un
 *  mensaje claro en vez del error crudo del almacenamiento. */
export const MAX_BYTES = 20 * 1024 * 1024;

export interface EntregaExistente {
  id: string;
  archivo_ruta: string | null;
  archivo_nombre: string | null;
  archivo_tamano: number | null;
  comentario_estudiante: string | null;
  comentario_docente: string | null;
  score: number | null;
  max_score: number | null;
  submitted_at: string;
}

export function tamanoLegible(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  courseId: string;
  courseResourceId: string;
  tituloRecurso: string;
  instrucciones?: string | null;
  entregaHasta?: string | null;
}

export function EntregaDeTarea({
  courseId, courseResourceId, tituloRecurso, instrucciones, entregaHasta,
}: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [subiendo, setSubiendo] = useState(false);
  const [comentario, setComentario] = useState("");

  const clave = ["mi_entrega", courseResourceId, user?.id] as const;

  const { data: entrega, isLoading } = useQuery({
    queryKey: clave,
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("resource_submissions")
        .select("*")
        .eq("course_resource_id", courseResourceId)
        .eq("student_id", user!.id)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data && !comentario) setComentario(data.comentario_estudiante || "");
      return (data as EntregaExistente | null) ?? null;
    },
  });

  const { data: estado } = useQuery({
    queryKey: ["estado_entrega", courseResourceId],
    queryFn: async () => {
      const { data } = await supabase
        .rpc("estado_de_entrega", { p_course_resource_id: courseResourceId })
        .maybeSingle();
      return data;
    },
    // El plazo puede vencer con la pantalla abierta: se recomprueba.
    refetchInterval: 60_000,
  });

  const abierto = estado?.abierto !== false;
  const cierre = estado?.cierra_en ?? entregaHasta ?? null;

  const subir = async (archivo: File) => {
    if (!user) return;
    if (archivo.size > MAX_BYTES) {
      return toast.error(
        `El archivo pesa ${tamanoLegible(archivo.size)} y el máximo son 20 MB. ` +
        "Si es un escaneo, prueba a bajar la calidad.",
      );
    }

    setSubiendo(true);
    try {
      // La ruta lleva el curso primero porque las políticas del almacenamiento
      // comprueban por carpeta: el docente ve lo de su curso, el estudiante
      // solo lo suyo.
      const limpio = archivo.name.replace(/[^\w.\-]+/g, "_").slice(-80);
      const ruta = `${courseId}/${courseResourceId}/${user.id}/${Date.now()}_${limpio}`;

      const { error: errorSubida } = await supabase.storage
        .from("entregas-tareas")
        .upload(ruta, archivo, { upsert: false });
      if (errorSubida) throw errorSubida;

      const datos = {
        archivo_ruta: ruta,
        archivo_nombre: archivo.name,
        archivo_tamano: archivo.size,
        comentario_estudiante: comentario.trim() || null,
        submitted_at: new Date().toISOString(),
      };

      if (entrega) {
        // Se reemplaza la entrega anterior y se borra su archivo: dejar los
        // dos haría dudar al docente sobre cuál calificar.
        const { error } = await supabase.from("resource_submissions")
          .update(datos).eq("id", entrega.id);
        if (error) throw error;
        if (entrega.archivo_ruta) {
          await supabase.storage.from("entregas-tareas").remove([entrega.archivo_ruta]);
        }
      } else {
        const { error } = await supabase.from("resource_submissions").insert({
          course_resource_id: courseResourceId,
          course_id: courseId,
          student_id: user.id,
          resource_type: "tarea",
          answers: {},
          ...datos,
        });
        if (error) throw error;
      }

      qc.invalidateQueries({ queryKey: clave });
      qc.invalidateQueries({ queryKey: ["my_submissions", courseId] });
      toast.success("Trabajo entregado");
    } catch (e: any) {
      avisarError(e, "No se pudo subir el archivo");
    } finally {
      setSubiendo(false);
    }
  };

  const descargar = async () => {
    if (!entrega?.archivo_ruta) return;
    // Enlace firmado: el bucket es privado y una URL pública dejaría las
    // tareas de todo el curso al alcance de cualquiera con el enlace.
    const { data, error } = await supabase.storage
      .from("entregas-tareas")
      .createSignedUrl(entrega.archivo_ruta, 60);
    if (error || !data) return avisarError(error, "No se pudo abrir el archivo");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const quitar = async () => {
    if (!entrega?.archivo_ruta) return;
    if (!confirm("¿Quitar tu entrega? Tendrás que volver a subir el archivo.")) return;
    const { error } = await supabase.from("resource_submissions")
      .update({ archivo_ruta: null, archivo_nombre: null, archivo_tamano: null })
      .eq("id", entrega.id);
    if (error) return avisarError(error, "No se pudo quitar tu entrega");
    await supabase.storage.from("entregas-tareas").remove([entrega.archivo_ruta]);
    qc.invalidateQueries({ queryKey: clave });
    toast.success("Entrega retirada");
  };

  const yaCalificada = entrega?.score !== null && entrega?.score !== undefined;

  return (
    <div className="glass-card rounded-xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Upload className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-foreground">Entregar mi trabajo</h2>
          <p className="text-sm text-muted-foreground">
            Sube tu {tituloRecurso.toLowerCase()} en PDF, Word o como foto.
          </p>
        </div>
      </div>

      {instrucciones && (
        <p className="text-sm text-foreground bg-muted/40 rounded-lg p-3 whitespace-pre-line">
          {instrucciones}
        </p>
      )}

      {!abierto && (
        <p className="text-sm flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-amber-800 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            {estado?.motivo === "Todavía no está abierta"
              ? `Esta actividad abre el ${new Date(estado.abre_en!).toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" })}.`
              : `El plazo terminó el ${cierre ? new Date(cierre).toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" }) : ""}. Ya no se admiten entregas ni cambios.`}
          </span>
        </p>
      )}

      {abierto && cierre && (
        <p className="text-xs flex items-center gap-1.5 text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          Puedes entregar hasta el{" "}
          {new Date(cierre).toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" })}
        </p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : entrega?.archivo_ruta ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">
                {entrega.archivo_nombre}
              </p>
              <p className="text-xs text-muted-foreground">
                {tamanoLegible(entrega.archivo_tamano)} · Entregado el{" "}
                {new Date(entrega.submitted_at).toLocaleString("es-CO")}
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={descargar}
              aria-label="Ver mi archivo">
              <Download className="h-4 w-4" />
            </Button>
            {!yaCalificada && abierto && (
              <Button variant="ghost" size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={quitar} aria-label="Quitar mi entrega">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          {yaCalificada && (
            <div className="rounded-lg border border-border p-3 space-y-1">
              <p className="text-sm font-medium text-foreground">
                Calificación: {((entrega.score! / (entrega.max_score || 5)) * 5).toFixed(1)} / 5,0
              </p>
              {entrega.comentario_docente && (
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {entrega.comentario_docente}
                </p>
              )}
            </div>
          )}
        </div>
      ) : null}

      {!yaCalificada && abierto && (
        <>
          <div className="space-y-2">
            <Label htmlFor="comentario-entrega" className="text-xs">
              Comentario para el docente (opcional)
            </Label>
            <Textarea
              id="comentario-entrega"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Si quieres explicar algo sobre tu trabajo, escríbelo aquí."
            />
          </div>

          <label
            className={`flex items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-sm transition-colors ${
              subiendo
                ? "border-border text-muted-foreground"
                : "border-border hover:border-primary/50 cursor-pointer text-muted-foreground"
            }`}
          >
            <input
              type="file"
              accept={TIPOS_ACEPTADOS}
              className="hidden"
              disabled={subiendo}
              onChange={(e) => {
                const archivo = e.target.files?.[0];
                e.target.value = "";
                if (archivo) subir(archivo);
              }}
            />
            {subiendo ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Subiendo tu trabajo...</span>
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                <span>
                  {entrega?.archivo_ruta ? "Reemplazar mi archivo" : "Elegir archivo"}
                  {" "}(PDF, Word o foto, máximo 20 MB)
                </span>
              </>
            )}
          </label>
        </>
      )}

      {yaCalificada && (
        <p className="text-xs text-muted-foreground">
          Tu trabajo ya fue calificado, así que no se puede reemplazar. Si
          necesitas volver a entregarlo, habla con tu docente.
        </p>
      )}

      {!abierto && !entrega?.archivo_ruta && (
        <p className="text-xs text-muted-foreground">
          No alcanzaste a entregar. Habla con tu docente: solo él puede
          registrar una entrega fuera de plazo.
        </p>
      )}
    </div>
  );
}
