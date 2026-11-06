import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, CheckCircle2, XCircle, FileText, ToggleLeft, Puzzle } from "lucide-react";
import { CrosswordGrid } from "@/components/games/CrosswordGrid";
import type { CrosswordContent } from "@/pages/resources/Crossword";
import { toast } from "sonner";
import { avisarError } from "@/lib/errores";

interface SafeQuestion {
  type: "multiple_choice" | "true_false";
  text: string;
  context: string;
  options: { label: string; text: string }[];
}

interface CourseResourceInfo {
  id: string;
  course_id: string;
  title: string;
  time_limit_minutes: number | null;
  shuffle_questions: boolean;
  show_grade: boolean;
  show_feedback: boolean;
  resource_type: string;
}

/**
 * El crucigrama tal como llega del servidor: SIN sus letras.
 *
 * `mascara` dice que celdas se pueden escribir; las letras se quedan en el
 * servidor, que es quien califica. De cada pista viene el numero, el texto y
 * cuantas letras tiene, nunca la palabra.
 */
interface CrucigramaSinSolucion {
  theme: string;
  difficulty: string;
  rows: number;
  cols: number;
  numbered: { row: number; col: number; n: number }[];
  mascara: boolean[][];
  across: { number: number; clue: string; longitud: number }[];
  down: { number: number; clue: string; longitud: number }[];
}

interface PalabraRevisada {
  numero: number;
  direccion: string;
  pista: string;
  ok: boolean;
  escrita: string;
  esperada: string;
}

interface FeedbackItem {
  i: number;
  userIdx: number;
  correctIdx: number;
  ok: boolean;
  correctLabel: string | null;
  correctText: string | null;
  explanation: string;
}

export default function TakeCourseExam() {
  const { courseId, courseResourceId } = useParams<{ courseId: string; courseResourceId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const startedAtRef = useRef<number>(Date.now());
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ score: number; max: number; showGrade: boolean; showFeedback: boolean; feedback: FeedbackItem[] | null } | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  const { data, error, isLoading } = useQuery({
    queryKey: ["course_exam", courseResourceId],
    enabled: !!courseResourceId,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("course-exam", {
        body: { action: "get", courseResourceId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as {
        courseResource: CourseResourceInfo;
        questions: SafeQuestion[];
        crucigrama?: CrucigramaSinSolucion;
      };
    },
  });

  const cr = data?.courseResource;
  const baseQuestions = data?.questions ?? [];
  const crucigrama = data?.crucigrama;

  // Lo que el estudiante lleva escrito en la cuadricula.
  const [letras, setLetras] = useState<string[][]>([]);

  /*
   * CrosswordGrid espera un crucigrama completo, con su `grid` de letras.
   * Aqui no hay letras: se arma uno con la forma y las pistas, poniendo un
   * caracter cualquiera donde la mascara dice que se puede escribir, porque
   * el componente usa esa casilla solo para saber si va vacia o rellenable.
   * Con `mostrarAciertos` en false nunca compara contra ese caracter.
   */
  const contenidoJugable = useMemo<CrosswordContent | null>(() => {
    if (!crucigrama) return null;
    return {
      theme: crucigrama.theme,
      difficulty: crucigrama.difficulty,
      rows: crucigrama.rows,
      cols: crucigrama.cols,
      grid: crucigrama.mascara.map((fila) => fila.map((activa) => (activa ? "·" : ""))),
      numbered: crucigrama.numbered,
      placed: [],
      // La palabra llega enmascarada: se conserva su LARGO, que es la ayuda
      // de siempre en un crucigrama, sin revelar ninguna letra.
      across: crucigrama.across.map((c) => ({
        number: c.number, clue: c.clue, word: "?".repeat(c.longitud), display: "",
      })),
      down: crucigrama.down.map((c) => ({
        number: c.number, clue: c.clue, word: "?".repeat(c.longitud), display: "",
      })),
    };
  }, [crucigrama]);

  const totalPalabras = (crucigrama?.across.length ?? 0) + (crucigrama?.down.length ?? 0);

  const questions = useMemo(() => {
    if (started && cr?.shuffle_questions) {
      return [...baseQuestions].sort(() => Math.random() - 0.5);
    }
    return baseQuestions;
  }, [baseQuestions, cr?.shuffle_questions, started]);

  const stats = useMemo(() => {
    let mc = 0, vf = 0;
    for (const q of baseQuestions) {
      if (q.type === "true_false") vf++;
      else mc++;
    }
    return { mc, vf, total: baseQuestions.length };
  }, [baseQuestions]);

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
    if (submitted || submitting || !cr) return;
    if (crucigrama) {
      const vacias = letras.flat().filter((l) => !l).length;
      const rellenables = crucigrama.mascara.flat().filter(Boolean).length;
      if (!auto && vacias > 0 && letras.length > 0) {
        const escritas = rellenables - vacias;
        if (!confirm(`Llevas ${escritas} de ${rellenables} casillas. ¿Enviar así?`)) return;
      }
    } else if (!auto && Object.keys(answers).length < questions.length) {
      if (!confirm(`Te faltan ${questions.length - Object.keys(answers).length} preguntas. ¿Enviar de todos modos?`)) return;
    }
    setSubmitting(true);
    const time = Math.floor((Date.now() - startedAtRef.current) / 1000);
    try {
      const { data: res, error } = await supabase.functions.invoke("course-exam", {
        body: {
          action: "submit",
          courseResourceId: cr.id,
          // El crucigrama manda la cuadricula escrita; el examen, las
          // opciones marcadas. El servidor sabe cual esperar por el tipo.
          answers: crucigrama ? letras : answers,
          timeSpentSeconds: time,
        },
      });
      if (error) throw error;
      if ((res as any)?.error) throw new Error((res as any).error);
      setSubmitted(true);
      setResult(res as any);
      toast.success("Respuestas enviadas");
    } catch (e: any) {
      avisarError(e, "No se pudieron enviar tus respuestas");
    } finally {
      setSubmitting(false);
    }
  };

  if (error) {
    return (
      <div className="max-w-2xl mx-auto animate-fade-in space-y-4 p-8">
        <button onClick={() => navigate(`/resources/courses/${courseId}/student`)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Volver al curso
        </button>
        <div className="glass-card rounded-xl p-6 text-center">
          <XCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-2">No se pudo cargar el examen</h2>
          <p className="text-sm text-muted-foreground">{(error as Error)?.message || "Error desconocido"}</p>
        </div>
      </div>
    );
  }
  if (isLoading || !cr) {
    return (
      <div className="p-8 flex items-center justify-center gap-3 text-muted-foreground">
        <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        Cargando examen…
      </div>
    );
  }

  if (!started && !submitted) {
    return (
      <div className="max-w-2xl mx-auto animate-fade-in space-y-6">
        <button onClick={() => navigate(`/resources/courses/${courseId}/student`)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Volver al curso
        </button>
        <div className="glass-card rounded-xl p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{cr.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {crucigrama
                ? "Antes de comenzar, revisa la información del crucigrama."
                : "Antes de comenzar, revisa la información del examen."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border p-4">
              <div className="text-xs text-muted-foreground">
                {crucigrama ? "Total de palabras" : "Total de preguntas"}
              </div>
              <div className="text-2xl font-bold text-primary">
                {crucigrama ? totalPalabras : stats.total}
              </div>
            </div>
            {cr.time_limit_minutes && (
              <div className="rounded-lg border border-border p-4">
                <div className="text-xs text-muted-foreground">Tiempo límite</div>
                <div className="text-2xl font-bold text-primary">{cr.time_limit_minutes} min</div>
              </div>
            )}
          </div>

          <div>
            <h2 className="text-sm font-semibold mb-2">
              {crucigrama ? "En qué consiste" : "Tipos de preguntas"}
            </h2>
            <div className="space-y-2">
              {crucigrama && (
                <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <Puzzle className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Crucigrama</div>
                    <div className="text-xs text-muted-foreground">
                      Completa la cuadrícula con las pistas horizontales y verticales.
                    </div>
                  </div>
                  <span className="text-sm font-semibold">{totalPalabras}</span>
                </div>
              )}
              {!crucigrama && stats.mc > 0 && (
                <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Selección múltiple (tipo ICFES)</div>
                    <div className="text-xs text-muted-foreground">Elige una opción entre A, B, C o D.</div>
                  </div>
                  <span className="text-sm font-semibold">{stats.mc}</span>
                </div>
              )}
              {!crucigrama && stats.vf > 0 && (
                <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <ToggleLeft className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Verdadero o Falso</div>
                    <div className="text-xs text-muted-foreground">Indica si la afirmación es verdadera o falsa.</div>
                  </div>
                  <span className="text-sm font-semibold">{stats.vf}</span>
                </div>
              )}
              {!crucigrama && stats.vf === 0 && stats.mc === 0 && (
                <div className="text-sm text-muted-foreground">Este recurso no tiene preguntas en formato evaluable.</div>
              )}
            </div>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            {cr.show_grade ? <p>• Verás tu calificación al finalizar.</p> : <p>• Tu docente revisará y calificará tus respuestas.</p>}
            {cr.show_feedback && <p>• Recibirás retroalimentación al terminar.</p>}
            {!crucigrama && cr.shuffle_questions && <p>• Las preguntas se presentarán en orden aleatorio.</p>}
            {crucigrama && <p>• Se cuenta cada palabra completa, no cada letra suelta.</p>}
          </div>

          <Button
            onClick={() => { startedAtRef.current = Date.now(); setStarted(true); }}
            disabled={crucigrama ? totalPalabras === 0 : stats.total === 0}
            className="w-full gradient-primary"
          >
            {crucigrama ? "Comenzar crucigrama" : "Comenzar examen"}
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
          <h1 className="text-2xl font-bold mb-2">
            {crucigrama ? "¡Crucigrama enviado!" : "¡Examen enviado!"}
          </h1>
          {crucigrama && result.showGrade && (
            <p className="text-sm text-muted-foreground">palabras completadas</p>
          )}
          {result.showGrade ? (
            <div className="text-5xl font-bold text-primary my-6">{result.score} / {result.max}</div>
          ) : (
            <p className="text-muted-foreground my-6">Tu docente revisará tus respuestas.</p>
          )}
          {crucigrama && result.showFeedback && result.feedback && (
            <div className="text-left space-y-2 mt-6">
              <h2 className="font-semibold">Palabra por palabra</h2>
              {(result.feedback as unknown as PalabraRevisada[]).map((p, i) => (
                <div
                  key={i}
                  className={`rounded-lg border p-3 ${p.ok ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5"}`}
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    {p.ok ? <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                          : <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                    <span>{p.numero} {p.direccion}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{p.pista}</p>
                  {!p.ok && (
                    <p className="text-xs mt-1">
                      <span className="text-muted-foreground">Escribiste </span>
                      <span className="font-mono text-destructive">{p.escrita}</span>
                      <span className="text-muted-foreground"> · Era </span>
                      <span className="font-mono text-primary">{p.esperada}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {!crucigrama && result.showFeedback && result.feedback && (
            <div className="text-left space-y-3 mt-6">
              <h2 className="font-semibold">Retroalimentación</h2>
              {questions.map((q, i) => {
                const fb = result.feedback!.find((f) => f.i === i);
                if (!fb) return null;
                const userOpt = fb.userIdx >= 0 ? q.options[fb.userIdx] : null;
                return (
                  <div key={i} className="border border-border rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      {fb.ok ? <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" /> : <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />}
                      <div className="flex-1">
                        <div className="font-medium text-sm">{i + 1}. {q.text}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Tu respuesta: {userOpt ? `${userOpt.label}. ${userOpt.text}` : "(sin responder)"}
                        </div>
                        {!fb.ok && fb.correctLabel && (
                          <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                            Correcta: {fb.correctLabel}. {fb.correctText}
                          </div>
                        )}
                        {fb.explanation && (
                          <div className="text-xs text-muted-foreground mt-1 italic">{fb.explanation}</div>
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

      {contenidoJugable ? (
        <div className="glass-card rounded-xl p-6">
          <CrosswordGrid
            content={contenidoJugable}
            interactive
            /* Sin marcar aciertos: el servidor tiene las letras, aqui no hay
               contra que comparar, y avisar celda por celda convertiria el
               crucigrama en adivinar por prueba y error. */
            mostrarAciertos={false}
            onCambio={setLetras}
          />
        </div>
      ) : questions.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
          Este recurso no tiene preguntas en formato evaluable.
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q, i) => {
            const vf = q.type === "true_false";
            return (
              <div key={i} className="glass-card rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">
                    {vf ? "Verdadero / Falso" : "Selección múltiple"}
                  </span>
                </div>
                {q.context && (
                  <div className="text-xs text-muted-foreground bg-muted/40 rounded p-2 mb-2 whitespace-pre-wrap">{q.context}</div>
                )}
                <div className="font-medium mb-3">{i + 1}. {q.text}</div>
                <div className="space-y-2">
                  {q.options.map((p, oi) => (
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
          <Button onClick={() => submit(false)} disabled={submitting} className="w-full gradient-primary">
            {submitting ? "Enviando…" : "Enviar respuestas"}
          </Button>
        </div>
      )}
    </div>
  );
}
