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

async function generateImage(apiKey: string, prompt: string): Promise<string | null> {
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{
          role: "user",
          content: `Ilustración infantil de cuento, estilo libro infantil colorido, suave y amigable. ${prompt}. Sin texto en la imagen.`,
        }],
        modalities: ["image", "text"],
      }),
    });
    if (!resp.ok) {
      console.error("Image gen failed:", resp.status, await resp.text());
      return null;
    }
    const data = await resp.json();
    const url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    return url || null;
  } catch (e) {
    console.error("Image gen exception:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Require authenticated caller to prevent abuse of the paid AI gateway
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
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
    }

    const { title, character, characterType, ageGroup, theme, length } = await req.json();


    if (typeof title !== "string" || title.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Título requerido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY no configurada");

    const lengthLabel = length === "corto" ? "corto (3-4 párrafos por capítulo)" : length === "largo" ? "extenso (6-8 párrafos por capítulo)" : "medio (4-6 párrafos por capítulo)";
    const ageLabel = ageGroup || "niños de 6-10 años";
    const themeLabel = theme ? `Temática: ${theme}.` : "";
    const characterDesc = character
      ? `El personaje principal es ${character}${characterType ? ` (un ${characterType})` : ""}.`
      : "Inventa un personaje principal apropiado.";

    const systemPrompt = `Eres un escritor de cuentos infantiles en español. Escribe cuentos imaginativos, educativos y apropiados para ${ageLabel}. Usa un lenguaje claro y vivido. El cuento debe tener exactamente 4 capítulos: introducción, conflicto, clímax y desenlace. Cada capítulo debe tener un título corto. Para cada capítulo proporciona también un imagePrompt en inglés (descripción visual breve) que se usará para generar una ilustración.`;

    const userPrompt = `Título: ${title}\n${characterDesc}\n${themeLabel}\nLongitud: ${lengthLabel}\n\nGenera el cuento completo.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos agotados." }), {
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
      generateImage(LOVABLE_API_KEY, story.coverPrompt),
      ...chaptersToIllustrate.map((ch) => generateImage(LOVABLE_API_KEY, ch.imagePrompt)),
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
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
