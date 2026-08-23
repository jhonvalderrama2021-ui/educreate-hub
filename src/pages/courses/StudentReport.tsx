import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ArrowLeft, ChevronDown, Download, CheckCircle2, XCircle, MinusCircle,
  Clock, ListChecks, GraduationCap,
} from "lucide-react";
import type { ResourceSubmission, CourseResource } from "@/lib/courses-types";
import {
  revisarEntrega, notaColombiana, formatearDuracion, descargarCSV, iniciales,
} from "@/lib/examen-respuestas";

/**
 * Informe de un estudiante dentro de un mini curso.
 *
 * El asesor pidió en la reunión que al pulsar sobre un estudiante se llegue a
 * "ver lo que hizo", no solo la nota: qué marcó en cada pregunta, cuál era la
 * correcta y por qué. También pidió poder "extraer todos" los resultados, de
 * ahí la descarga en CSV.
 */

export default function StudentReport() {
  const { courseId, studentId } = useParams<{ courseId: string; studentId: string }>();
  const navigate = useNavigate();
  const [abierta, setAbierta] = useState<string | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["profile", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", studentId!).single();
      return data;
    },
  });

  const { data: curso } = useQuery({
    queryKey: ["mini_course", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data } = await supabase.from("mini_courses").select("name").eq("id", courseId!).single();
      return data;
    },
  });

  const { data: subs = [], isLoading } = useQuery({
    queryKey: ["report_subs", courseId, studentId],
    enabled: !!courseId && !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resource_submissions").select("*")
        .eq("course_id", courseId!).eq("student_id", studentId!)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data as ResourceSubmission[];
    },
  });

  const { data: resources = [] } = useQuery({
    queryKey: ["report_resources", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data } = await supabase
        .from("course_resources").select("*").eq("course_id", courseId!);
      return (data || []) as CourseResource[];
    },
  });

  // El detalle de cada pregunta necesita los enunciados, que viven en el
  // recurso generado y no en la entrega.
  const { data: contenidos = {} } = useQuery({
    queryKey: ["report_contents", courseId, resources.map((r) => r.resource_id).join(",")],
    enabled: resources.length > 0,
    queryFn: async () => {
      const ids = [...new Set(resources.map((r) => r.resource_id))];
      const { data } = await supabase
        .from("generated_resources").select("id, content").in("id", ids);
      return Object.fromEntries((data || []).map((r: any) => [r.id, r.content])) as Record<string, any>;
    },
  });

  const recursoDe = (s: ResourceSubmission) => resources.find((r) => r.id === s.course_resource_id);
  const contenidoDe = (s: ResourceSubmission) => {
    const cr = recursoDe(s);
    return cr ? contenidos[cr.resource_id] : null;
  };

  const conNota = subs.filter((s) => s.score !== null && s.max_score);
  const promedio = conNota.length
    ? (conNota.reduce((a, s) => a + (s.score! / s.max_score!) * 5, 0) / conNota.length).toFixed(1)
    : "—";
  const tiempoTotal = subs.reduce((a, s) => a + (s.time_spent_seconds || 0), 0);

  const exportar = () => {
    if (subs.length === 0) return toast.error("No hay actividades que exportar");
    const filas: (string | number)[][] = [
      ["Estudiante", "Actividad", "Tipo", "Aciertos", "Total", "Nota (1-5)", "Tiempo", "Fecha",
       "N° pregunta", "Enunciado", "Respondió", "Correcta", "¿Acertó?"],
    ];
    for (const s of subs) {
      const cr = recursoDe(s);
      const preguntas = revisarEntrega(contenidoDe(s), s);
      const cabecera = [
        profile?.full_name || "",
        cr?.title || "",
        s.resource_type,
        s.score ?? "",
        s.max_score ?? "",
        notaColombiana(s.score, s.max_score),
        formatearDuracion(s.time_spent_seconds),
        new Date(s.submitted_at).toLocaleString("es-CO"),
      ];
      if (preguntas.length === 0) {
        filas.push([...cabecera, "", "", "", "", ""]);
        continue;
      }
      // Una fila por pregunta: así el docente puede filtrar en Excel cuáles
      // falló todo el grupo, que es lo que sirve para reorientar la clase.
      for (const p of preguntas) {
        filas.push([
          ...cabecera,
          p.numero,
          p.enunciado,
          p.opciones[p.marcada]?.text ?? "(sin responder)",
          p.opciones[p.correcta]?.text ?? "",
          p.acerto ? "Sí" : "No",
        ]);
      }
    }
    const nombre = (profile?.full_name || "estudiante").replace(/\s+/g, "_");
    descargarCSV(`resultados-${nombre}.csv`, filas);
    toast.success("Archivo descargado");
  };

  return (
    <div className="max-w-5xl mx-auto animate-fade-in space-y-6">
      <button
        onClick={() => navigate(`/resources/courses/${courseId}`)}
        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        <ArrowLeft className="h-4 w-4" /> Volver al curso
      </button>

      <div className="glass-card rounded-xl p-6 flex flex-wrap items-center gap-4">
        <div
          className="h-14 w-14 rounded-full gradient-primary flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          <span className="text-lg font-bold text-primary-foreground">
            {iniciales(profile?.full_name)}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-foreground truncate">
            {profile?.full_name || "Estudiante"}
          </h1>
          <p className="text-sm text-muted-foreground truncate">
            {profile?.email}
            {curso?.name && ` · ${curso.name}`}
          </p>
        </div>
        <Button variant="outline" onClick={exportar} disabled={subs.length === 0}>
          <Download className="h-4 w-4 mr-2" /> Descargar resultados
        </Button>
      </div>

      {subs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Resumen icono={GraduationCap} etiqueta="Promedio" valor={promedio} nota="sobre 5,0" />
          <Resumen icono={ListChecks} etiqueta="Actividades" valor={String(subs.length)} nota="entregadas" />
          <Resumen icono={Clock} etiqueta="Tiempo total" valor={formatearDuracion(tiempoTotal)} nota="dedicado" />
        </div>
      )}

      {isLoading ? (
        <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">Cargando…</div>
      ) : subs.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
          Este estudiante aún no ha realizado actividades.
        </div>
      ) : (
        <div className="space-y-2">
          {subs.map((s) => {
            const cr = recursoDe(s);
            const expandida = abierta === s.id;
            const preguntas = expandida ? revisarEntrega(contenidoDe(s), s) : [];

            return (
              <div key={s.id} className="border border-border rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setAbierta(expandida ? null : s.id)}
                  aria-expanded={expandida}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground line-clamp-1">{cr?.title || "Actividad"}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatearDuracion(s.time_spent_seconds)} ·{" "}
                      {new Date(s.submitted_at).toLocaleString("es-CO")}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-semibold text-foreground">
                      {notaColombiana(s.score, s.max_score)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {s.score ?? "—"} de {s.max_score ?? "—"}
                    </div>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expandida ? "rotate-180" : ""}`}
                  />
                </button>

                {expandida && (
                  <div className="border-t border-border p-4 space-y-4 bg-muted/20">
                    {preguntas.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Esta actividad no guarda respuestas por pregunta.
                      </p>
                    ) : (
                      preguntas.map((p) => (
                        <div key={p.numero} className="space-y-2">
                          <div className="flex items-start gap-2">
                            {p.acerto ? (
                              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                            ) : p.marcada < 0 ? (
                              <MinusCircle className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                            ) : (
                              <XCircle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
                            )}
                            <p className="text-sm font-medium text-foreground">
                              {p.numero}. {p.enunciado}
                            </p>
                          </div>

                          {p.contexto && (
                            <p className="text-xs text-muted-foreground pl-6 italic">{p.contexto}</p>
                          )}

                          <ul className="pl-6 space-y-1">
                            {p.opciones.map((o, i) => {
                              const marcada = i === p.marcada;
                              const correcta = i === p.correcta;
                              return (
                                <li
                                  key={i}
                                  className={`text-sm rounded px-2 py-1 ${
                                    correcta
                                      ? "bg-primary/10 text-foreground font-medium"
                                      : marcada
                                      ? "bg-destructive/10 text-foreground"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {o.label && `${o.label}. `}{o.text}
                                  {marcada && (
                                    <span className="ml-2 text-xs">
                                      ← respondió {correcta ? "(correcta)" : ""}
                                    </span>
                                  )}
                                  {correcta && !marcada && (
                                    <span className="ml-2 text-xs">← correcta</span>
                                  )}
                                </li>
                              );
                            })}
                          </ul>

                          {p.marcada < 0 && (
                            <p className="text-xs text-muted-foreground pl-6">Dejó la pregunta en blanco.</p>
                          )}
                          {p.explicacion && (
                            <p className="text-xs text-muted-foreground pl-6">{p.explicacion}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Resumen({ icono: Icono, etiqueta, valor, nota }: {
  icono: any; etiqueta: string; valor: string; nota: string;
}) {
  return (
    <div className="glass-card rounded-xl p-4 flex items-center gap-3">
      <Icono className="h-5 w-5 text-primary shrink-0" />
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{etiqueta}</div>
        <div className="font-semibold text-foreground">
          {valor} <span className="text-xs font-normal text-muted-foreground">{nota}</span>
        </div>
      </div>
    </div>
  );
}
