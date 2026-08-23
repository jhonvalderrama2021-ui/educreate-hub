import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface StoryChapter {
  title: string;
  text: string;
  imagePrompt: string;
}

interface StoryStructure {
  title: string;
  moral?: string;
  chapters: StoryChapter[];
}

// Genera una ilustración con los modelos de imagen de OpenAI.
// Devuelve un data URI; si algo falla devuelve null y el cuento se muestra sin ilustración.
async function generateImage(apiKey: string, prompt: string): Promise<string | null> {
  try {
    const resp = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-image-1-mini",
        prompt: `Ilustración para cuento infantil, estilo libro ilustrado, colorido, suave y amigable, trazo limpio. ${prompt}. Sin ningún texto ni letras en la imagen.`,
        n: 1,
        size: "1024x1024",
      }),
    });
    if (!resp.ok) {
      console.error("Image gen failed:", resp.status, await resp.text());
      return null;
    }
    const data = await resp.json();
    const item = data.data?.[0];
    if (!item) return null;
    // Los modelos gpt-image devuelven base64; DALL·E puede devolver una URL.
    if (item.b64_json) return `data:image/png;base64,${item.b64_json}`;
    return item.url || null;
  } catch (e) {
    console.error("Image gen exception:", e);
    return null;
  }
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
    // Require authenticated caller to prevent abuse of the paid AI gateway
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let idUsuario = "";
    {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const token = authHeader.replace("Bearer ", "");
      const { data, error } = await sb.auth.getClaims(token);
      if (error || !data?.claims?.sub) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      idUsuario = data.claims.sub as string;
    }


    // El administrador puede desactivar una cuenta sin borrarla (tarea 10 de
    // la reunion de asesoria). Se comprueba aqui, no solo en la interfaz.
    {
      const { createClient: crearClienteAdmin } = await import("https://esm.sh/@supabase/supabase-js@2");
      const revisor = crearClienteAdmin(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: activo } = await revisor.rpc("es_usuario_activo", { p_id: idUsuario });
      if (activo === false) {
        return new Response(JSON.stringify({ error: "Tu cuenta esta desactivada. Comunicate con el administrador de la plataforma." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { title, character, characterType, ageGroup, theme, length } = await leerJson(req);


    if (typeof title !== "string" || title.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Título requerido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // La clave de OpenAI la administra el panel de administración (tabla platform_settings)
    const { createClient: createAdminClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseAdmin = createAdminClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
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

    const lengthLabel = length === "corto" ? "corto (3-4 párrafos por capítulo)" : length === "largo" ? "extenso (6-8 párrafos por capítulo)" : "medio (4-6 párrafos por capítulo)";
    const ageLabel = ageGroup || "niños de 6-10 años";
    const themeLabel = theme ? `Temática: ${theme}.` : "";
    const characterDesc = character
      ? `El personaje principal es ${character}${characterType ? ` (un ${characterType})` : ""}.`
      : "Inventa un personaje principal apropiado.";

    const systemPrompt = `Eres un escritor de literatura infantil en español, especializado en cuentos con intención pedagógica para el contexto colombiano.

ESTRUCTURA
1. Exactamente 4 capítulos con esta progresión: presentación, conflicto, clímax y desenlace.
2. Cada capítulo lleva un título corto y evocador (2-5 palabras).
3. La historia debe cerrar de forma completa: nada de finales abiertos ni continuaciones.

LENGUAJE — AJUSTADO A ${ageLabel.toUpperCase()}
4. Ajusta rigurosamente el vocabulario y la longitud de las frases a esa edad. Para 3-5 años usa frases muy cortas y palabras del día a día; para 11 años en adelante puedes usar subordinadas y vocabulario más rico.
5. Si introduces una palabra nueva o difícil, deja claro su significado por el contexto de la propia historia.
6. Usa recursos que enganchan a los niños: diálogos, repeticiones con ritmo, onomatopeyas y sensaciones concretas (qué se ve, se oye, se huele).
7. Muestra lo que ocurre a través de acciones y diálogos; no lo expliques como narrador.

VALOR PEDAGÓGICO
8. La enseñanza debe desprenderse de lo que le pasa al personaje por sus propias decisiones. Prohibido el sermón final ni frases del tipo "y así aprendió que...".
9. El personaje debe enfrentar el problema y resolverlo con sus recursos: nunca lo salva un adulto ni una casualidad.
10. La moraleja debe ser una frase breve y memorable, no un párrafo explicativo.
11. Puedes ambientar la historia en paisajes, fauna o costumbres de Colombia cuando enriquezca el relato.

CONTENIDO APROPIADO
12. Sin violencia, miedo intenso, estereotipos de género ni discriminación de ningún tipo.
13. El conflicto puede ser difícil, pero siempre tratado con esperanza.

ILUSTRACIONES
14. Para cada capítulo entrega un "imagePrompt" en INGLÉS: descripción visual concreta de la escena (personaje, acción, lugar, luz), de 10 a 25 palabras. Mantén al personaje descrito igual en todos los prompts para que las ilustraciones sean coherentes entre sí.`;

    const userPrompt = `Título: ${title}\n${characterDesc}\n${themeLabel}\nLongitud: ${lengthLabel}\n\nGenera el cuento completo.`;

    const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.4-mini",
        max_completion_tokens: 12000,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "submit_story",
            description: "Devuelve el cuento estructurado",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" },
                moral: { type: "string", description: "Moraleja o mensaje final del cuento" },
                coverPrompt: { type: "string", description: "Descripción visual de la portada en inglés" },
                chapters: {
                  type: "array",
                  minItems: 4,
                  maxItems: 4,
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      text: { type: "string", description: "Texto del capítulo en español" },
                      imagePrompt: { type: "string", description: "Descripción visual breve en inglés" },
                    },
                    required: ["title", "text", "imagePrompt"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["title", "chapters", "coverPrompt"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "submit_story" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error:", aiResp.status, t);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de uso alcanzado, intenta más tarde." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 401) {
        return new Response(JSON.stringify({ error: "La API Key de OpenAI no es válida. El administrador debe revisarla en el panel." }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402 || aiResp.status === 403) {
        return new Response(JSON.stringify({ error: "Sin créditos disponibles en la cuenta de OpenAI." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Error del modelo de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No se generó cuento");
    const story = JSON.parse(toolCall.function.arguments) as StoryStructure & { coverPrompt: string };

    // Generate images in parallel: cover + 3 chapter illustrations
    const chaptersToIllustrate = story.chapters.slice(0, 3);
    const [coverUrl, ...chapterImgs] = await Promise.all([
      generateImage(apiKey, story.coverPrompt),
      ...chaptersToIllustrate.map((ch) => generateImage(apiKey, ch.imagePrompt)),
    ]);

    const chapters = story.chapters.map((ch, i) => ({
      title: ch.title,
      text: ch.text,
      imageUrl: chapterImgs[i] || null,
    }));

    return new Response(
      JSON.stringify({
        title: story.title || title,
        moral: story.moral || null,
        coverImageUrl: coverUrl || null,
        chapters,
        character: character || null,
        characterType: characterType || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-story error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: e instanceof ErrorDePeticion ? e.estado : 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
