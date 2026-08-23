import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MODELO_EMBEDDING = "text-embedding-3-small";
// Por debajo de este parecido el fragmento habla de otra cosa. Meterlo en el
// prompt solo confunde al modelo y le hace citar algo que no viene al caso.
const SIMILITUD_MINIMA = 0.25;
const FRAGMENTOS_POR_PREGUNTA = 5;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // El administrador puede desactivar una cuenta sin borrarla (tarea 10 de
    // la reunion de asesoria). Se comprueba en el servidor, no solo en la
    // interfaz: si no, bastaria abrir la consola para seguir gastando la
    // clave de OpenAI de la institucion.
    {
      const revisor = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: activo } = await revisor.rpc("es_usuario_activo", { p_id: user.id });
      if (activo === false) {
        return new Response(JSON.stringify({
          error: "Tu cuenta esta desactivada. Comunicate con el administrador de la plataforma.",
        }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const { botId, message } = await req.json();
    if (!botId || !message) {
      return new Response(JSON.stringify({ error: "botId y message son requeridos" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get bot info
    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("*")
      .eq("id", botId)
      .eq("user_id", user.id)
      .single();

    if (botError || !bot) {
      return new Response(JSON.stringify({ error: "Bot no encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get conversation history (last 50 messages)
    const { data: history } = await supabase
      .from("bot_messages")
      .select("role, content")
      .eq("bot_id", botId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(50);

    const conversationMessages = (history || []).map((m: any) => ({
      role: m.role, content: m.content,
    }));

    // Save user message
    await supabase.from("bot_messages").insert({
      bot_id: botId, user_id: user.id, role: "user", content: message,
    });

    // La clave de OpenAI la administra el panel de administración (tabla platform_settings)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: setting } = await supabaseAdmin
      .from("platform_settings")
      .select("value")
      .eq("key", "openai_api_key")
      .single();

    if (!setting?.value) {
      return new Response(JSON.stringify({
        error: "API Key de OpenAI no configurada. El administrador debe configurarla en el panel de administración.",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const apiKey = setting.value as string;

    // ── Documentos anexados ────────────────────────────────────────────
    // "El bot puede partir de un documento que yo pueda anexar". La pregunta
    // se convierte en vector y se recuperan los fragmentos mas parecidos.
    // Solo se mandan esos, no el documento entero: una cartilla completa
    // costaria mucho en cada pregunta y el modelo se perderia entre tanto
    // texto.
    let contextoDocumentos = "";
    try {
      const { count } = await supabaseAdmin
        .from("bot_documentos")
        .select("id", { count: "exact", head: true })
        .eq("bot_id", botId)
        .eq("estado", "listo");

      if ((count ?? 0) > 0) {
        const respuestaEmbedding = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: MODELO_EMBEDDING, input: message }),
        });

        if (respuestaEmbedding.ok) {
          const datos = await respuestaEmbedding.json();
          const vector = datos.data?.[0]?.embedding;

          const { data: encontrados } = await supabase.rpc("buscar_en_documentos_bot", {
            p_bot_id: botId,
            p_embedding: JSON.stringify(vector),
            p_limite: FRAGMENTOS_POR_PREGUNTA,
          });

          const utiles = (encontrados || []).filter(
            (f: any) => Number(f.similitud) >= SIMILITUD_MINIMA,
          );

          if (utiles.length > 0) {
            contextoDocumentos = [
              "",
              "MATERIAL DEL DOCENTE — es tu fuente principal:",
              ...utiles.map((f: any, i: number) =>
                `[${i + 1}] (de "${f.documento}") ${f.texto}`),
              "",
              "Usa este material antes que tu conocimiento general. Si la " +
              "pregunta no se responde con el, dilo con claridad y responde " +
              "desde tu especialidad, avisando que no viene del material.",
            ].join("\n\n");
          } else {
            // Sin esto el bot no se entera de que existe un documento y
            // rechaza la pregunta por "no ser de mi especialidad", cuando lo
            // util es decir que ese dato no esta en el material del docente.
            contextoDocumentos = [
              "",
              "MATERIAL DEL DOCENTE:",
              "El docente anexo material a este bot, pero ningun fragmento " +
              "responde a esta pregunta en concreto. Si la pregunta parece " +
              "referirse a ese material, dilo asi: que ese dato no aparece en " +
              "el material anexado. No respondas que la pregunta es ajena a tu " +
              "especialidad, y no inventes el dato.",
            ].join("\n\n");
          }
        }
      }
    } catch (e) {
      // Si la busqueda falla, el bot responde igual desde su especialidad.
      // Quedarse sin bot por un fallo de recuperacion seria peor.
      console.error("No se pudo consultar los documentos del bot:", e);
    }

    // El docente puede precisar como debe comportarse el bot: que temas
    // cubrir, con que enfoque explicar o que evitar. Sin esto el bot responde
    // de forma generica sobre la especialidad.
    const personalizacion = bot.detalle
      ? `

INDICACIONES DEL DOCENTE QUE TE CREO — tienen prioridad sobre las pautas generales:
${bot.detalle}`
      : "";
    const nivel = bot.nivel_educativo
      ? `

NIVEL EDUCATIVO DE TUS ESTUDIANTES: ${bot.nivel_educativo}. Ajusta el vocabulario, la extension de las explicaciones y los ejemplos a ese nivel.`
      : "";

    const systemPrompt = `Eres "${bot.name}", un tutor educativo especializado en ${bot.specialty}, que acompaña a estudiantes del sistema educativo colombiano.

ALCANCE
${contextoDocumentos ? `1. Tienes DOS temas permitidos: ${bot.specialty} y el MATERIAL DEL DOCENTE que aparece al final de estas instrucciones. Cualquier pregunta sobre alguno de los dos entra en tu alcance.
2. Antes de rechazar una pregunta, comprueba si trata sobre el material del docente o sobre la institución, el curso o el plan que ese material describe. Si es así, RESPÓNDELA. El docente anexó ese material justamente para que lo consultes.
2b. Si trata del material pero el dato concreto no aparece en él, di que ese dato no está en el material anexado. Eso es una respuesta útil; contestar "no es mi especialidad" no lo es.
2c. Solo si la pregunta no tiene nada que ver ni con ${bot.specialty} ni con ese material, responde: "Mi especialidad es ${bot.specialty}, por lo que no puedo ayudarte con esa pregunta. ¿Tienes alguna duda sobre ${bot.specialty}?"` : `1. Responde ÚNICAMENTE sobre ${bot.specialty}.
2. Si te preguntan algo ajeno a tu especialidad, responde: "Mi especialidad es ${bot.specialty}, por lo que no puedo ayudarte con esa pregunta. ¿Tienes alguna duda sobre ${bot.specialty}?"`}

CÓMO ENSEÑAS — ESTO ES LO MÁS IMPORTANTE
3. Tu objetivo es que el estudiante APRENDA, no que entregue una tarea resuelta.
4. Si te piden resolver un ejercicio, un problema o un trabajo, NO des la respuesta final de entrada. Explica el concepto necesario, muestra el procedimiento con UN EJEMPLO DISTINTO y luego invita al estudiante a resolver el suyo.
5. Si insiste o si ya intentó y se equivocó, guíalo paso a paso con preguntas que lo lleven a descubrir el error, en lugar de corregírselo directamente.
6. Cierra tus explicaciones con una pregunta que verifique la comprensión.
7. Si detectas un error conceptual, señálalo con respeto y explica por qué es un error, no solo cuál es la respuesta correcta.

CÓMO ESCRIBES
8. Responde siempre en español, con lenguaje cercano y sin tecnicismos innecesarios.
9. Ajusta el nivel de tu explicación al que muestre el estudiante en sus mensajes: si escribe como alguien de primaria, explica como para primaria.
10. Usa ejemplos del contexto colombiano y de la vida cotidiana siempre que ayuden.
11. Sé breve: máximo 3 párrafos por respuesta, salvo que te pidan profundizar.
12. Nunca inventes datos, fechas ni fuentes. Si no sabes algo con certeza, dilo.${nivel}${personalizacion}${contextoDocumentos}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.4-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationMessages,
          { role: "user", content: message },
        ],
        max_completion_tokens: 4000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de solicitudes excedido, intenta más tarde." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(JSON.stringify({ error: "Error del servicio de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await response.json();
    const assistantContent = aiData.choices?.[0]?.message?.content || "No pude generar una respuesta.";

    // Save assistant message
    await supabase.from("bot_messages").insert({
      bot_id: botId, user_id: user.id, role: "assistant", content: assistantContent,
    });

    return new Response(JSON.stringify({ reply: assistantContent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chat-bot error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
