import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, CheckCircle2, XCircle, FileText, ToggleLeft } from "lucide-react";
import { toast } from "sonner";
import type { CourseResource } from "@/lib/courses-types";

interface Question {
  type?: string;
  text?: string;
  question?: string;
  enunciado?: string;
  context?: string;
  contexto?: string;
  options?: any;
  opciones?: any;
  correct?: string | number | boolean;
  correcta?: string | number | boolean;
  respuesta_correcta?: string | number | boolean;
  feedback?: string;
  retroalimentacion?: string;
  explanation?: string;
  explicacion?: string;
}

function normalizeQuestions(content: any): Question[] {
  if (!content) return [];
  if (Array.isArray(content)) return content;
  if (Array.isArray(content.questions)) return content.questions;
  if (Array.isArray(content.preguntas)) return content.preguntas;
  if (Array.isArray(content.items)) return content.items;
  return [];
}

function isTrueFalse(q: Question): boolean {
  const t = String(q.type || "").toLowerCase();
  if (t === "true_false" || t === "verdadero_falso" || t === "vf" || t === "boolean") return true;
  // Heuristic: no options + correct is Verdadero/Falso/true/false
  const c = q.correct ?? q.correcta ?? q.respuesta_correcta;
  const opts = q.options ?? q.opciones;
  const isVF = typeof c === "boolean" || /^(verdadero|falso|true|false|v|f)$/i.test(String(c ?? ""));
  const noOpts = !opts || (Array.isArray(opts) && opts.length === 0) || (typeof opts === "object" && Object.keys(opts).length === 0);
  return isVF && noOpts;
}

/** Returns options as { label, text } pairs preserving keys like A/B/C/D when available. */
function getOptionPairs(q: Question): { label: string; text: string }[] {
  if (isTrueFalse(q)) {
    return [
      { label: "V", text: "Verdadero" },
      { label: "F", text: "Falso" },
    ];
  }
  const raw: any = q.options ?? q.opciones ?? [];
  if (Array.isArray(raw)) {
    return raw.map((o, i) => ({
      label: String.fromCharCode(65 + i),
      text: typeof o === "string" ? o : o?.text ?? o?.label ?? String(o),
    }));
  }
  if (raw && typeof raw === "object") {
    return Object.entries(raw).map(([k, v]: [string, any]) => ({
      label: k.toUpperCase(),
      text: typeof v === "string" ? v : v?.text ?? v?.label ?? String(v),
    }));
  }
  return [];
}

function getText(q: Question): string {
  return q.text || q.question || q.enunciado || "";
}

function getContext(q: Question): string {
  return q.context || q.contexto || "";
}

function getCorrectIndex(q: Question, pairs: { label: string; text: string }[]): number {
  const c = q.correct ?? q.correcta ?? q.respuesta_correcta;
  if (c === undefined || c === null) return -1;

  if (isTrueFalse(q)) {
    const s = String(c).toLowerCase().trim();
    if (s === "true" || s === "verdadero" || s === "v" || c === true) return 0;
    if (s === "false" || s === "falso" || s === "f" || c === false) return 1;
    return -1;
  }

  if (typeof c === "number") return c;
  const s = String(c).trim();
  // Match by label (A/B/C/D)
  const byLabel = pairs.findIndex((p) => p.label.toLowerCase() === s.toLowerCase());
  if (byLabel >= 0) return byLabel;
  // Match by text
  const byText = pairs.findIndex((p) => p.text.trim().toLowerCase() === s.toLowerCase());
  if (byText >= 0) return byText;
  const n = parseInt(s, 10);
  return isNaN(n) ? -1 : n;
}

function getExplanation(q: Question): string {
  return q.feedback || q.retroalimentacion || q.explanation || q.explicacion || "";
}

export default function TakeCourseExam() {
  const { courseId, courseResourceId } = useParams<{ courseId: string; courseResourceId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const startedAtRef = useRef<number>(Date.now());
  const [started, setStarted] = useState(false);
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
    if (started && cr?.shuffle_questions) {
      return [...list].sort(() => Math.random() - 0.5);
    }
    return list;
  }, [resource, cr?.shuffle_questions, started]);

  const stats = useMemo(() => {
    let mc = 0, vf = 0;
    for (const q of questions) {
      if (isTrueFalse(q)) vf++;
      else mc++;
    }
    return { mc, vf, total: questions.length };
  }, [questions]);

  // Timer (only after start)
  useEffect(() => {
    if (!started || !cr?.time_limit_minutes || submitted) return;
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
  }, [cr, submitted, started]);

  const submit = async (auto = false) => {
    if (submitted || !cr) return;
    if (!auto && Object.keys(answers).length < questions.length) {
      if (!confirm(`Te faltan ${questions.length - Object.keys(answers).length} preguntas. ¿Enviar de todos modos?`)) return;
    }
    setSubmitted(true);

    let score = 0;
    const max = questions.length;
    const detail = questions.map((q, i) => {
      const pairs = getOptionPairs(q);
      const correctIdx = getCorrectIndex(q, pairs);
      const userIdx = answers[i] ?? -1;
      const ok = userIdx === correctIdx && correctIdx >= 0;
      if (ok) score++;
      return { i, userIdx, correctIdx, ok, explanation: getExplanation(q) };
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

  // Start screen with overview
  if (!started && !submitted) {
    return (
      <div className="max-w-2xl mx-auto animate-fade-in space-y-6">
        <button onClick={() => navigate(`/resources/courses/${courseId}/student`)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Volver al curso
        </button>
        <div className="glass-card rounded-xl p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{cr.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">Antes de comenzar, revisa la información del examen.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border p-4">
              <div className="text-xs text-muted-foreground">Total de preguntas</div>
              <div className="text-2xl font-bold text-primary">{stats.total}</div>
            </div>
            {cr.time_limit_minutes && (
              <div className="rounded-lg border border-border p-4">
                <div className="text-xs text-muted-foreground">Tiempo límite</div>
                <div className="text-2xl font-bold text-primary">{cr.time_limit_minutes} min</div>
              </div>
            )}
          </div>

          <div>
            <h2 className="text-sm font-semibold mb-2">Tipos de preguntas</h2>
            <div className="space-y-2">
              {stats.mc > 0 && (
                <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Selección múltiple (tipo ICFES)</div>
                    <div className="text-xs text-muted-foreground">Elige una opción entre A, B, C o D.</div>
                  </div>
                  <span className="text-sm font-semibold">{stats.mc}</span>
                </div>
              )}
              {stats.vf > 0 && (
                <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <ToggleLeft className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Verdadero o Falso</div>
                    <div className="text-xs text-muted-foreground">Indica si la afirmación es verdadera o falsa.</div>
                  </div>
                  <span className="text-sm font-semibold">{stats.vf}</span>
                </div>
              )}
              {stats.total === 0 && (
                <div className="text-sm text-muted-foreground">Este recurso no tiene preguntas en formato evaluable.</div>
              )}
            </div>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            {cr.show_grade ? <p>• Verás tu calificación al finalizar.</p> : <p>• Tu docente revisará y calificará tus respuestas.</p>}
            {cr.show_feedback && <p>• Recibirás retroalimentación al terminar.</p>}
            {cr.shuffle_questions && <p>• Las preguntas se presentarán en orden aleatorio.</p>}
          </div>

          <Button
            onClick={() => { startedAtRef.current = Date.now(); setStarted(true); }}
            disabled={stats.total === 0}
            className="w-full gradient-primary"
          >
            Comenzar examen
          </Button>
        </div>
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
                const pairs = getOptionPairs(q);
                const correctIdx = getCorrectIndex(q, pairs);
                const userIdx = answers[i] ?? -1;
                const ok = userIdx === correctIdx;
                const exp = getExplanation(q);
                return (
                  <div key={i} className="border border-border rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      {ok ? <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" /> : <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />}
                      <div className="flex-1">
                        <div className="font-medium text-sm">{i + 1}. {getText(q)}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Tu respuesta: {userIdx >= 0 ? `${pairs[userIdx]?.label}. ${pairs[userIdx]?.text}` : "(sin responder)"}
                        </div>
                        {!ok && correctIdx >= 0 && (
                          <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                            Correcta: {pairs[correctIdx]?.label}. {pairs[correctIdx]?.text}
                          </div>
                        )}
                        {exp && (
                          <div className="text-xs text-muted-foreground mt-1 italic">{exp}</div>
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
            const pairs = getOptionPairs(q);
            const vf = isTrueFalse(q);
            const ctx = getContext(q);
            return (
              <div key={i} className="glass-card rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">
                    {vf ? "Verdadero / Falso" : "Selección múltiple"}
                  </span>
                </div>
                {ctx && (
                  <div className="text-xs text-muted-foreground bg-muted/40 rounded p-2 mb-2 whitespace-pre-wrap">{ctx}</div>
                )}
                <div className="font-medium mb-3">{i + 1}. {getText(q)}</div>
                <div className="space-y-2">
                  {pairs.map((p, oi) => (
                    <label key={oi} className="flex items-start gap-2 cursor-pointer p-2 rounded hover:bg-muted/40">
                      <input type="radio" name={`q-${i}`} checked={answers[i] === oi}
                        onChange={() => setAnswers({ ...answers, [i]: oi })} className="mt-1" />
                      <span className="text-sm">
                        <span className="font-semibold mr-2">{p.label}.</span>{p.text}
                      </span>
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
