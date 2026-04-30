import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import type { CourseResource } from "@/lib/courses-types";

interface Question {
  text?: string;
  question?: string;
  enunciado?: string;
  options?: string[];
  opciones?: string[];
  correct?: string | number;
  correcta?: string | number;
  respuesta_correcta?: string | number;
  feedback?: string;
  retroalimentacion?: string;
}

function normalizeQuestions(content: any): Question[] {
  if (!content) return [];
  if (Array.isArray(content)) return content;
  if (Array.isArray(content.questions)) return content.questions;
  if (Array.isArray(content.preguntas)) return content.preguntas;
  if (Array.isArray(content.items)) return content.items;
  return [];
}

function getOptions(q: Question): string[] {
  const raw: any = q.options ?? q.opciones ?? [];
  if (Array.isArray(raw)) return raw.map((o) => (typeof o === "string" ? o : o?.text ?? o?.label ?? String(o)));
  if (raw && typeof raw === "object") {
    return Object.values(raw).map((o: any) => (typeof o === "string" ? o : o?.text ?? o?.label ?? String(o)));
  }
  return [];
}
function getText(q: Question): string {
  return q.text || q.question || q.enunciado || "";
}
function getCorrectIndex(q: Question, opts: string[]): number {
  const c = q.correct ?? q.correcta ?? q.respuesta_correcta;
  if (c === undefined || c === null) return -1;
  if (typeof c === "number") return c;
  const s = String(c).trim();
  if (/^[A-Z]$/i.test(s)) return s.toUpperCase().charCodeAt(0) - 65;
  const idx = opts.findIndex((o) => o.trim().toLowerCase() === s.toLowerCase());
  if (idx >= 0) return idx;
  const n = parseInt(s, 10);
  return isNaN(n) ? -1 : n;
}

export default function TakeCourseExam() {
  const { courseId, courseResourceId } = useParams<{ courseId: string; courseResourceId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const startedAtRef = useRef<number>(Date.now());
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ score: number; max: number } | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  const { data: cr, error: crError, isLoading: crLoading } = useQuery({
    queryKey: ["take_cr", courseResourceId],
    enabled: !!courseResourceId,
    retry: false,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("course_resources").select("*").eq("id", courseResourceId).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Recurso del curso no encontrado o sin acceso.");
      return data as CourseResource;
    },
  });

  const { data: resource, error: resError, isLoading: resLoading } = useQuery({
    queryKey: ["take_resource", cr?.resource_id],
    enabled: !!cr,
    retry: false,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("generated_resources").select("*").eq("id", cr!.resource_id).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("El contenido del examen no está disponible. Pide al docente que verifique los permisos.");
      return data;
    },
  });

  const questions = useMemo(() => {
    const list = normalizeQuestions(resource?.content);
    if (cr?.shuffle_questions) {
      return [...list].sort(() => Math.random() - 0.5);
    }
    return list;
  }, [resource, cr?.shuffle_questions]);

  // Timer
  useEffect(() => {
    if (!cr?.time_limit_minutes || submitted) return;
    const totalMs = cr.time_limit_minutes * 60 * 1000;
    const tick = () => {
      const elapsed = Date.now() - startedAtRef.current;
      const left = Math.max(0, Math.floor((totalMs - elapsed) / 1000));
      setRemaining(left);
      if (left === 0) submit(true);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cr, submitted]);

  const submit = async (auto = false) => {
    if (submitted || !cr) return;
    if (!auto && Object.keys(answers).length < questions.length) {
      if (!confirm(`Te faltan ${questions.length - Object.keys(answers).length} preguntas. ¿Enviar de todos modos?`)) return;
    }
    setSubmitted(true);

    let score = 0;
    const max = questions.length;
    const detail = questions.map((q, i) => {
      const opts = getOptions(q);
      const correctIdx = getCorrectIndex(q, opts);
      const userIdx = answers[i] ?? -1;
      const ok = userIdx === correctIdx && correctIdx >= 0;
      if (ok) score++;
      return { i, userIdx, correctIdx, ok, feedback: q.feedback || q.retroalimentacion };
    });

    const time = Math.floor((Date.now() - startedAtRef.current) / 1000);

    const { error } = await (supabase as any).from("resource_submissions").insert({
      course_resource_id: cr.id,
      course_id: cr.course_id,
      student_id: user!.id,
      resource_type: cr.resource_type,
      attempt_number: 1,
      answers,
      score,
      max_score: max,
      time_spent_seconds: time,
      feedback: detail,
    });
    if (error) toast.error(error.message);
    else toast.success("Respuestas enviadas");
    setResult({ score, max });
  };

  if (crError || resError) {
    return (
      <div className="max-w-2xl mx-auto animate-fade-in space-y-4 p-8">
        <button onClick={() => navigate(`/resources/courses/${courseId}/student`)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Volver al curso
        </button>
        <div className="glass-card rounded-xl p-6 text-center">
          <XCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-2">No se pudo cargar el examen</h2>
          <p className="text-sm text-muted-foreground">
            {(crError as Error)?.message || (resError as Error)?.message || "Error desconocido"}
          </p>
        </div>
      </div>
    );
  }
  if (crLoading || resLoading || !cr || !resource) {
    return (
      <div className="p-8 flex items-center justify-center gap-3 text-muted-foreground">
        <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        Cargando examen…
      </div>
    );
  }

  if (submitted && result) {
    return (
      <div className="max-w-3xl mx-auto animate-fade-in space-y-6">
        <button onClick={() => navigate(`/resources/courses/${courseId}/student`)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Volver al curso
        </button>
        <div className="glass-card rounded-xl p-8 text-center">
          <h1 className="text-2xl font-bold mb-2">¡Examen enviado!</h1>
          {cr.show_grade ? (
            <div className="text-5xl font-bold text-primary my-6">{result.score} / {result.max}</div>
          ) : (
            <p className="text-muted-foreground my-6">Tu docente revisará tus respuestas.</p>
          )}
          {cr.show_feedback && (
            <div className="text-left space-y-3 mt-6">
              <h2 className="font-semibold">Retroalimentación</h2>
              {questions.map((q, i) => {
                const opts = getOptions(q);
                const correctIdx = getCorrectIndex(q, opts);
                const userIdx = answers[i] ?? -1;
                const ok = userIdx === correctIdx;
                return (
                  <div key={i} className="border border-border rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      {ok ? <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" /> : <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />}
                      <div className="flex-1">
                        <div className="font-medium text-sm">{i + 1}. {getText(q)}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Tu respuesta: {userIdx >= 0 ? opts[userIdx] : "(sin responder)"}
                        </div>
                        {!ok && correctIdx >= 0 && (
                          <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                            Correcta: {opts[correctIdx]}
                          </div>
                        )}
                        {(q.feedback || q.retroalimentacion) && (
                          <div className="text-xs text-muted-foreground mt-1 italic">{q.feedback || q.retroalimentacion}</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Button onClick={() => navigate(`/resources/courses/${courseId}/student`)} className="mt-6 gradient-primary">Volver al curso</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => { if (confirm("¿Salir? Tus respuestas no se guardarán.")) navigate(`/resources/courses/${courseId}/student`); }}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Salir
        </button>
        {remaining !== null && (
          <div className={`flex items-center gap-2 font-mono text-sm px-3 py-1 rounded ${remaining < 60 ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
            <Clock className="h-4 w-4" />
            {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
          </div>
        )}
      </div>

      <div className="glass-card rounded-xl p-6">
        <h1 className="text-2xl font-bold text-foreground">{cr.title}</h1>
      </div>

      {questions.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
          Este recurso no tiene preguntas en formato evaluable.
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q, i) => {
            const opts = getOptions(q);
            return (
              <div key={i} className="glass-card rounded-lg p-4">
                <div className="font-medium mb-3">{i + 1}. {getText(q)}</div>
                <div className="space-y-2">
                  {opts.map((opt, oi) => (
                    <label key={oi} className="flex items-start gap-2 cursor-pointer p-2 rounded hover:bg-muted/40">
                      <input type="radio" name={`q-${i}`} checked={answers[i] === oi}
                        onChange={() => setAnswers({ ...answers, [i]: oi })} className="mt-1" />
                      <span className="text-sm">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
          <Button onClick={() => submit(false)} className="w-full gradient-primary">Enviar respuestas</Button>
        </div>
      )}
    </div>
  );
}
