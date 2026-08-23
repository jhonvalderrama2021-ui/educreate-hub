import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalizeQuestions(content: any): any[] {
  if (!content) return [];
  if (Array.isArray(content)) return content;
  if (Array.isArray(content.questions)) return content.questions;
  if (Array.isArray(content.preguntas)) return content.preguntas;
  if (Array.isArray(content.items)) return content.items;
  return [];
}

function isTrueFalse(q: any): boolean {
  const t = String(q.type || "").toLowerCase();
  if (t === "true_false" || t === "verdadero_falso" || t === "vf" || t === "boolean") return true;
  const c = q.correct ?? q.correcta ?? q.respuesta_correcta;
  const opts = q.options ?? q.opciones;
  const isVF = typeof c === "boolean" || /^(verdadero|falso|true|false|v|f)$/i.test(String(c ?? ""));
  const noOpts = !opts || (Array.isArray(opts) && opts.length === 0) || (typeof opts === "object" && Object.keys(opts).length === 0);
  return isVF && noOpts;
}

function getOptionPairs(q: any): { label: string; text: string }[] {
  if (isTrueFalse(q)) {
    return [{ label: "V", text: "Verdadero" }, { label: "F", text: "Falso" }];
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
      label: String(k).toUpperCase(),
      text: typeof v === "string" ? v : v?.text ?? v?.label ?? String(v),
    }));
  }
  return [];
}

function getCorrectIndex(q: any, pairs: { label: string; text: string }[]): number {
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
  const byLabel = pairs.findIndex((p) => p.label.toLowerCase() === s.toLowerCase());
  if (byLabel >= 0) return byLabel;
  const byText = pairs.findIndex((p) => p.text.trim().toLowerCase() === s.toLowerCase());
  if (byText >= 0) return byText;
  const n = parseInt(s, 10);
  return isNaN(n) ? -1 : n;
}

function getText(q: any): string { return q.text || q.question || q.enunciado || ""; }
function getContext(q: any): string { return q.context || q.contexto || ""; }
function getExplanation(q: any): string {
  return q.feedback || q.retroalimentacion || q.explanation || q.explicacion || "";
}

/** Error con el estado que corresponde, para distinguirlo de un fallo del servidor. */
class ErrorDePeticion extends Error {
  constructor(public estado: number, mensaje: string) { super(mensaje); }
}

/**
 * Lee el cuerpo como JSON. Un cuerpo vacio o mal formado es culpa de quien
 * llama: se responde 400, no 500, para no confundirlo con un fallo real del
 * servidor al revisar los registros.
 */
async function leerJson(req: Request): Promise<Record<string, unknown>> {
  const texto = await req.text();
  if (!texto.trim()) throw new ErrorDePeticion(400, "El cuerpo de la petición está vacío");
  try {
    const datos = JSON.parse(texto);
    if (!datos || typeof datos !== "object" || Array.isArray(datos)) {
      throw new ErrorDePeticion(400, "El cuerpo debe ser un objeto JSON");
    }
    return datos as Record<string, unknown>;
  } catch (e) {
    if (e instanceof ErrorDePeticion) throw e;
    throw new ErrorDePeticion(400, "El cuerpo no es JSON válido");
  }
}


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Todas estas funciones son POST. Un GET devolvia 500 al intentar leer un
  // cuerpo que no existe, y eso ensucia los registros con errores que no son
  // del servidor.
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json", Allow: "POST, OPTIONS" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;


    // El administrador puede desactivar una cuenta sin borrarla (tarea 10 de
    // la reunion de asesoria). Se comprueba aqui, no solo en la interfaz.
    {
      const { createClient: crearClienteAdmin } = await import("https://esm.sh/@supabase/supabase-js@2");
      const revisor = crearClienteAdmin(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: activo } = await revisor.rpc("es_usuario_activo", { p_id: userId });
      if (activo === false) {
        return new Response(JSON.stringify({ error: "Tu cuenta esta desactivada. Comunicate con el administrador de la plataforma." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await leerJson(req);
    const { action, courseResourceId } = body;
    if (!courseResourceId || typeof courseResourceId !== "string") {
      return new Response(JSON.stringify({ error: "courseResourceId requerido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load course_resource with admin (already vetted access below)
    const { data: cr, error: crErr } = await admin
      .from("course_resources")
      .select("*")
      .eq("id", courseResourceId)
      .maybeSingle();
    if (crErr) throw crErr;
    if (!cr) {
      return new Response(JSON.stringify({ error: "Recurso no encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Access check: must be enrolled student or the course teacher
    const [{ data: enrolled }, { data: course }] = await Promise.all([
      admin.from("course_enrollments").select("student_id")
        .eq("course_id", cr.course_id).eq("student_id", userId).maybeSingle(),
      admin.from("mini_courses").select("teacher_id").eq("id", cr.course_id).maybeSingle(),
    ]);
    const isStudent = !!enrolled;
    const isTeacher = course?.teacher_id === userId;
    if (!isStudent && !isTeacher) {
      return new Response(JSON.stringify({ error: "Sin acceso a este recurso" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: resource, error: resErr } = await admin
      .from("generated_resources")
      .select("id, title, resource_type, content")
      .eq("id", cr.resource_id)
      .maybeSingle();
    if (resErr) throw resErr;
    if (!resource) {
      return new Response(JSON.stringify({ error: "Contenido no disponible" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const questions = normalizeQuestions(resource.content);

    if (action === "get") {
      // Strip correct answers and explanations before returning to student
      const safeQuestions = questions.map((q: any) => {
        const pairs = getOptionPairs(q);
        return {
          type: isTrueFalse(q) ? "true_false" : "multiple_choice",
          text: getText(q),
          context: getContext(q),
          options: pairs, // [{label,text}]
        };
      });
      return new Response(JSON.stringify({
        courseResource: {
          id: cr.id,
          course_id: cr.course_id,
          title: cr.title,
          time_limit_minutes: cr.time_limit_minutes,
          shuffle_questions: cr.shuffle_questions,
          show_grade: cr.show_grade,
          show_feedback: cr.show_feedback,
          resource_type: cr.resource_type,
        },
        questions: safeQuestions,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "submit") {
      if (!isStudent) {
        return new Response(JSON.stringify({ error: "Solo estudiantes inscritos pueden enviar" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const answers = body.answers ?? {};
      const timeSpent = Math.max(0, Math.floor(Number(body.timeSpentSeconds) || 0));

      let score = 0;
      const max = questions.length;
      const detail = questions.map((q: any, i: number) => {
        const pairs = getOptionPairs(q);
        const correctIdx = getCorrectIndex(q, pairs);
        const userIdx = Number(answers?.[i] ?? answers?.[String(i)] ?? -1);
        const ok = userIdx === correctIdx && correctIdx >= 0;
        if (ok) score++;
        return {
          i,
          userIdx,
          correctIdx,
          ok,
          correctLabel: pairs[correctIdx]?.label ?? null,
          correctText: pairs[correctIdx]?.text ?? null,
          explanation: getExplanation(q),
        };
      });

      const { error: insErr } = await admin.from("resource_submissions").insert({
        course_resource_id: cr.id,
        course_id: cr.course_id,
        student_id: userId,
        resource_type: cr.resource_type,
        attempt_number: 1,
        answers,
        score,
        max_score: max,
        time_spent_seconds: timeSpent,
        feedback: detail,
      });
      if (insErr) throw insErr;

      return new Response(JSON.stringify({
        score,
        max,
        showGrade: cr.show_grade,
        showFeedback: cr.show_feedback,
        feedback: cr.show_feedback ? detail : null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "action inválida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("course-exam error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: e instanceof ErrorDePeticion ? e.estado : 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
