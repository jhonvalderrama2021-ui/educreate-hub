import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Modelos de generación. La familia GPT-5 exige `max_completion_tokens`
// y NO admite `temperature`: si se cambia a un modelo GPT-4, hay que
// revertir ambos parámetros en las tres llamadas de este archivo.
//
// Se reserva el modelo mayor para lo que más exige calidad y donde un
// resultado pobre se nota de inmediato: los exámenes (construcción de
// distractores plausibles) y las diapositivas. El resto usa el modelo
// rápido, unas 3 veces más económico.
const MODEL_ALTA_EXIGENCIA = "gpt-5.4";
const MODEL_ECONOMICO = "gpt-5.4-mini";

const TIPOS_ALTA_EXIGENCIA = new Set(["icfes", "true_false", "mixed", "slides"]);

function pickModel(resourceType: string): string {
  return TIPOS_ALTA_EXIGENCIA.has(resourceType) ? MODEL_ALTA_EXIGENCIA : MODEL_ECONOMICO;
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    // ─── AUTH CHECK ─────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // ────────────────────────────────────────────────────────────

    const { resourceType, pdfContent, instructions, numItems, theme } = await req.json();

    // ─── INPUT VALIDATION ───────────────────────────────────────
    const ALLOWED_TYPES = new Set([
      "slides", "icfes", "true_false", "mixed",
      "workshop", "lesson_plan", "rubric",
    ]);
    if (typeof resourceType !== "string" || !ALLOWED_TYPES.has(resourceType)) {
      return new Response(JSON.stringify({ error: "resourceType inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const MAX_PDF = 150_000;   // ~150 KB of text
    const MAX_INSTR = 5_000;   // ~5 KB
    if (pdfContent != null && (typeof pdfContent !== "string" || pdfContent.length > MAX_PDF)) {
      return new Response(JSON.stringify({ error: "pdfContent demasiado grande (máx. 150 KB)" }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (instructions != null && (typeof instructions !== "string" || instructions.length > MAX_INSTR)) {
      return new Response(JSON.stringify({ error: "instructions demasiado largo (máx. 5 KB)" }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (numItems != null && (typeof numItems !== "number" || numItems < 1 || numItems > 30)) {
      return new Response(JSON.stringify({ error: "numItems debe estar entre 1 y 30" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // ────────────────────────────────────────────────────────────


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

    // ============================================================
    // SLIDES: 2-PHASE GENERATION (outline → slides in parallel)
    // ============================================================
    if (resourceType === "slides") {
      const total = Math.max(3, Math.min(20, numItems || 8));
      const hasSourcePdf = !!(pdfContent && pdfContent.trim().length > 100);

      // Phase 1 — Outline (titles + layout assignment + image hints)
      const outline = await generateOutline(apiKey, {
        instructions: instructions || "",
        pdfContent: hasSourcePdf ? pdfContent : "",
        total,
      });

      // Phase 2 — One LLM call per slide, in parallel (faster + more variety)
      const slidePromises = outline.slides.map((item: any, idx: number) =>
        generateOneSlide(apiKey, {
          presentationTitle: outline.title,
          subject: outline.subject,
          slideIndex: idx,
          totalSlides: total,
          item,
          hasSourcePdf,
          pdfExcerpt: hasSourcePdf ? pdfContent.slice(0, 4000) : "",
        }).catch((e) => {
          console.warn(`Slide ${idx} fallback:`, e);
          return buildFallbackSlide(item, idx, total);
        })
      );
      const slides = await Promise.all(slidePromises);

      // Resolve images only for slides that need one (~half of them)
      const presentation: any = {
        title: outline.title,
        subject: outline.subject,
        theme: theme || DEFAULT_THEME,
        slides,
      };
      await resolveSlideImages(presentation);

      return new Response(JSON.stringify(presentation), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============================================================
    // OTHER RESOURCE TYPES — single-shot generation (unchanged)
    // ============================================================
    const systemPrompt = getSystemPrompt(resourceType, numItems || 10);
    const userParts: string[] = [];
    if (instructions) userParts.push(`Instrucciones del docente: ${instructions}`);

    // Cuando hay documento fuente, el recurso debe salir de él. Sin esta
    // instrucción explícita el modelo tendía a producir contenido genérico
    // sobre el tema y a ignorar el material que el docente había cargado.
    if (pdfContent) {
      userParts.push(
        `\n=== DOCUMENTO FUENTE ===\n` +
        `El siguiente material fue cargado por el docente y es la BASE OBLIGATORIA del recurso.\n` +
        `Genera el contenido a partir de la información, los conceptos, los datos y los ejemplos que aparecen aquí.\n` +
        `No produzcas contenido genérico sobre el tema: usa ESTE documento.\n` +
        `Si el documento no alcanza para cubrir todo lo solicitado, apóyate en él en lo que sí cubre y complementa el resto de forma coherente con su enfoque.\n\n` +
        `${pdfContent}\n` +
        `=== FIN DEL DOCUMENTO FUENTE ===`,
      );
    }
    if (!pdfContent && !instructions)
      userParts.push("Genera contenido educativo de ejemplo sobre un tema general apropiado.");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: pickModel(resourceType),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userParts.join("\n") },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 20000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI error:", response.status, errText);
      const clientMsg = response.status === 401
        ? "Servicio de IA no disponible. Contacta al administrador para verificar la configuración."
        : "Error al generar el recurso. Intenta nuevamente.";
      return new Response(JSON.stringify({ error: clientMsg }), {
        status: response.status === 401 ? 401 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = JSON.parse(data.choices[0].message.content);

    // Trazabilidad del contenido generado (Marco Ético para la IA en Colombia,
    // MinTIC 2023, y CONPES 3975 de 2019): se acompaña el recurso con el origen
    // de su generación para que el docente sepa qué lo produjo y lo valide.
    content._meta = {
      generadoPorIA: true,
      modelo: pickModel(resourceType),
      proveedor: "OpenAI",
      fecha: new Date().toISOString(),
      requiereValidacionDocente: true,
    };

    return new Response(JSON.stringify(content), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-resource error:", e);
    return new Response(JSON.stringify({ error: "Error al generar el recurso. Intenta nuevamente." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ============================================================
// PHASE 1: OUTLINE — assigns layout + image flag per slide
// ============================================================
async function generateOutline(apiKey: string, args: {
  instructions: string; pdfContent: string; total: number;
}) {
  const { instructions, pdfContent, total } = args;

  // Layouts available in the middle pool — heavy variety with new creative ones.
  const middleLayouts = [
    "split", "diagonalSplit", "cardOverlay", "magazine",
    "grid", "list", "process", "comparison", "timeline",
    "imageFull", "twoColumnText", "bigNumber", "quote",
  ];
  // Layouts that DON'T need a Pexels image (text/color-driven)
  const noImageLayouts = new Set([
    "quote", "conclusion", "bigNumber", "comparison", "twoColumnText", "process", "timeline",
  ]);
  const heroLayouts = ["hero", "circleHero"];

  const sysPrompt = `Eres un experto pedagogo. Genera el ESQUELETO (outline) de una presentación educativa profesional en español. Devuelve JSON estricto con esta forma:

{
  "title": "Título atractivo de la presentación (4-10 palabras)",
  "subject": "Asignatura o área",
  "slides": [
    { "title": "Título de slide 1 (3-7 palabras)", "summary": "Una frase de 12-20 palabras que describe qué enseñará exactamente esta slide.", "imageQuery": "english specific keywords for this slide topic" }
  ]
}

REGLAS:
1. Genera EXACTAMENTE ${total} entradas en "slides".
2. Cada slide debe tratar un sub-tema DISTINTO y avanzar la narrativa: la slide 1 introduce, las del medio profundizan en aspectos diferentes, la última cierra.
3. NO repitas títulos ni sub-temas.
4. El "imageQuery" debe ser muy específico al sub-tema en INGLÉS, 3-5 palabras (ej: "amazon rainforest canopy birds", "ancient maya pyramid stones"). NO genérico.
5. El "summary" debe ser concreto y educativamente útil — describe el ÁNGULO único de esa slide.`;

  const userPrompt = `Instrucciones del docente:\n${instructions}\n\n${pdfContent ? `Documento fuente (extracto):\n${pdfContent.slice(0, 6000)}` : "Sin documento fuente — usa conocimiento general riguroso."}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL_ALTA_EXIGENCIA,
      messages: [
        { role: "system", content: sysPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 8000,
    }),
  });
  if (!res.ok) throw new Error(`Outline failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const outline = JSON.parse(data.choices[0].message.content);

  // Force exact count
  const items: any[] = Array.isArray(outline.slides) ? outline.slides : [];
  while (items.length < total) {
    items.push({ title: `Aspecto adicional ${items.length + 1}`, summary: "Profundización del tema.", imageQuery: outline.title || "education" });
  }
  if (items.length > total) items.length = total;

  // Assign layout + needsImage with STRONG variety enforcement
  const usedCounts: Record<string, number> = {};
  let prevLayout = "";
  const assigned = items.map((it, i) => {
    let layout: string;
    if (i === 0) {
      layout = heroLayouts[Math.floor(Math.random() * heroLayouts.length)];
    } else if (i === total - 1) {
      layout = "conclusion";
    } else {
      // Pick a layout: not same as previous, used least, random tie-break
      const candidates = middleLayouts.filter((l) => l !== prevLayout);
      candidates.sort((a, b) => {
        const diff = (usedCounts[a] || 0) - (usedCounts[b] || 0);
        if (diff !== 0) return diff;
        return Math.random() - 0.5;
      });
      layout = candidates[0];
    }
    usedCounts[layout] = (usedCounts[layout] || 0) + 1;
    prevLayout = layout;
    (it as any)._layout = layout;

    // Image: every slide gets one EXCEPT noImageLayouts
    const wantsImage = !noImageLayouts.has(layout);
    return {
      ...it,
      layout,
      needsImage: wantsImage,
    };
  });

  return {
    title: outline.title || "Presentación",
    subject: outline.subject || "General",
    slides: assigned,
  };
}

// ============================================================
// PHASE 2: ONE SLIDE GENERATION (per slide, parallel)
// ============================================================
async function generateOneSlide(apiKey: string, args: {
  presentationTitle: string; subject: string; slideIndex: number; totalSlides: number;
  item: any; hasSourcePdf: boolean; pdfExcerpt: string;
}) {
  const { presentationTitle, subject, slideIndex, totalSlides, item, hasSourcePdf, pdfExcerpt } = args;

  const layoutSchema = getLayoutSchema(item.layout);

  const sys = `Eres un diseñador pedagógico experto. Genera UNA diapositiva educativa profesional en español como JSON estricto, siguiendo EXACTAMENTE el esquema dado. NO inventes campos extra.

Esquema obligatorio para layout "${item.layout}":
${layoutSchema}

REGLAS DE CONTENIDO:
- Títulos: 3-7 palabras, claros e impactantes.
- Descripciones de cards/listItems/steps: 25-50 palabras CADA UNA, completas y educativamente sustanciales — NO frases sueltas.
- "content" extenso: 60-100 palabras, párrafo informativo real (no genérico).
- ${hasSourcePdf ? 'Si el layout es "stats" o "bigNumber", cita la fuente real (campo "source") del documento adjunto.' : 'NO uses números/estadísticas inventadas — el layout asignado ya evita "stats" sin documento.'}
- Iconos: usa Material Icons válidos (school, lightbulb, eco, science, public, groups, psychology, history, build, explore, insights, trending_up, star, check_circle, bolt).
- ${item.needsImage ? `Incluye "image": { "query": "${item.imageQuery}", "alt": "descripción breve", "placement": "right" }.` : "NO incluyas campo image."}`;

  const user = `Presentación: "${presentationTitle}" (asignatura: ${subject})
Esta es la slide ${slideIndex + 1} de ${totalSlides}.
Título sugerido: "${item.title}"
Ángulo a desarrollar: ${item.summary}
${hasSourcePdf ? `Extracto del documento fuente:\n${pdfExcerpt}` : ""}

Genera la slide JSON ahora.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL_ALTA_EXIGENCIA,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 6000,
    }),
  });
  if (!res.ok) throw new Error(`Slide ${slideIndex} failed: ${res.status}`);
  const data = await res.json();
  const slide = JSON.parse(data.choices[0].message.content);

  // Force the right layout (LLM might drift)
  slide.layout = item.layout;
  if (!slide.title) slide.title = item.title;

  // Strip stats without source PDF
  if (!hasSourcePdf && slide.layout === "stats") {
    return buildFallbackSlide(item, slideIndex, totalSlides);
  }

  // Ensure image is present if requested
  if (item.needsImage && !slide.image?.query) {
    slide.image = {
      query: item.imageQuery || presentationTitle,
      alt: item.title,
      placement: slide.layout === "imageFull" ? "background" : "right",
    };
  }

  return slide;
}

function getLayoutSchema(layout: string): string {
  switch (layout) {
    case "hero":
      return `{ "layout": "hero", "title": "string", "subtitle": "frase 8-15 palabras", "image": { "query": "english keywords", "alt": "descr", "placement": "background" } }`;
    case "conclusion":
      return `{ "layout": "conclusion", "title": "string", "subtitle": "resumen una frase", "content": "párrafo 50-80 palabras de cierre" }`;
    case "grid":
      return `{ "layout": "grid", "title": "string", "cards": [{ "icon": "material_icon", "title": "3-5 palabras", "description": "25-50 palabras", "color": "#hex" }] } — exactamente 3 o 4 cards.`;
    case "split":
      return `{ "layout": "split", "title": "string", "subtitle": "frase intro", "content": "párrafo 60-100 palabras", "image": { "query": "...", "alt": "...", "placement": "right" } }`;
    case "process":
      return `{ "layout": "process", "title": "string", "steps": [{ "number": 1, "title": "3-5 palabras", "description": "25-40 palabras", "color": "#hex" }] } — 3 a 5 steps.`;
    case "comparison":
      return `{ "layout": "comparison", "title": "string", "columns": [{ "title": "Opción", "color": "#hex", "points": ["frase completa", "..."] }] } — exactamente 2 columnas con 3-5 points cada una.`;
    case "stats":
      return `{ "layout": "stats", "title": "string", "stats": [{ "value": "85%", "label": "frase 5-10 palabras", "source": "fuente real", "color": "#hex" }] } — 3 o 4 stats con source obligatorio.`;
    case "list":
      return `{ "layout": "list", "title": "string", "listItems": [{ "icon": "material_icon", "title": "3-5 palabras", "description": "25-50 palabras" }] } — 3 a 5 items.`;
    case "timeline":
      return `{ "layout": "timeline", "title": "string", "timelineEvents": [{ "date": "fase/año", "title": "3-5 palabras", "description": "20-40 palabras" }] } — 3 a 5 events.`;
    case "quote":
      return `{ "layout": "quote", "title": "Reflexión", "content": "cita poderosa 15-30 palabras", "subtitle": "— autor o contexto" }`;
    case "imageFull":
      return `{ "layout": "imageFull", "title": "string impactante", "subtitle": "frase 8-15 palabras", "image": { "query": "english keywords", "alt": "...", "placement": "background" } }`;
    case "bigNumber":
      return `{ "layout": "bigNumber", "title": "string", "bigNumber": "73%", "subtitle": "frase 6-10 palabras", "content": "explicación 40-70 palabras" }`;
    case "twoColumnText":
      return `{ "layout": "twoColumnText", "title": "string", "columns": [{ "title": "Perspectiva", "color": "#hex", "points": ["frase completa.", "..."] }] } — exactamente 2 columnas con 3-4 points.`;
    case "cardOverlay":
      return `{ "layout": "cardOverlay", "title": "string impactante", "content": "párrafo 50-80 palabras concreto", "image": { "query": "english keywords", "alt": "...", "placement": "background" } }`;
    case "magazine":
      return `{ "layout": "magazine", "title": "string", "listItems": [{ "icon": "material_icon", "title": "3-5 palabras", "description": "20-40 palabras" }], "image": { "query": "...", "alt": "...", "placement": "left" } } — 4 listItems exactos.`;
    case "diagonalSplit":
      return `{ "layout": "diagonalSplit", "title": "string", "subtitle": "frase 8-15 palabras", "content": "párrafo 40-70 palabras", "image": { "query": "...", "alt": "...", "placement": "left" } }`;
    case "circleHero":
      return `{ "layout": "circleHero", "title": "string", "subtitle": "frase 10-18 palabras", "image": { "query": "...", "alt": "...", "placement": "right" } }`;
    default:
      return `{ "layout": "${layout}", "title": "string", "content": "párrafo 50-80 palabras" }`;
  }
}

function buildFallbackSlide(item: any, idx: number, total: number): any {
  const palette = ["#3B82F6", "#6366F1", "#8B5CF6", "#22C55E", "#F59E0B", "#EF4444"];
  const color = palette[idx % palette.length];
  if (idx === 0) {
    return { layout: "hero", title: item.title, subtitle: item.summary };
  }
  if (idx === total - 1) {
    return { layout: "conclusion", title: item.title, subtitle: "Síntesis", content: item.summary };
  }
  return {
    layout: "list",
    title: item.title,
    listItems: [
      { icon: "lightbulb", title: "Idea central", description: item.summary },
      { icon: "school", title: "Aprendizaje", description: `Aspecto clave para profundizar.` },
      { icon: "explore", title: "Aplicación", description: `Forma práctica de aplicar el concepto en clase.` },
    ],
  };
}

// ============================================================
// IMAGE RESOLUTION (Pexels) — only for slides that asked for one
// ============================================================
async function resolveSlideImages(presentation: any): Promise<void> {
  const slides = presentation.slides || [];
  await Promise.all(
    slides.map(async (slide: any) => {
      if (!slide.image?.query) return;
      try {
        const url = await searchPexels(slide.image.query);
        if (url) slide.image.url = url;
      } catch (e) {
        console.warn("Pexels search failed for:", slide.image.query, e);
      }
    })
  );
}

async function searchPexels(query: string): Promise<string | null> {
  const apiKey = Deno.env.get("PEXELS_API_KEY");
  if (!apiKey) return null;
  try {
    const encoded = encodeURIComponent(query);
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encoded}&per_page=8&orientation=landscape`,
      { headers: { Authorization: apiKey } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const photos = data.photos || [];
    if (photos.length === 0) return null;
    const pick = photos[Math.floor(Math.random() * photos.length)];
    return pick?.src?.large2x || pick?.src?.large || pick?.src?.original || null;
  } catch {
    return null;
  }
}

const DEFAULT_THEME = {
  primary: "#1E3A5F",
  secondary: "#3B82F6",
  accent: "#6366F1",
  background: "#F0F4F8",
  text: "#1E293B",
  fontHeading: "'Space Grotesk', sans-serif",
  fontBody: "'Inter', sans-serif",
};

// ============================================================
// SYSTEM PROMPTS for non-slide resource types (UNCHANGED)
// ============================================================
function getSystemPrompt(type: string, numItems: number): string {
  const base = `Eres un pedagogo experto del sistema educativo colombiano, con dominio de los Estándares Básicos de Competencias (EBC) y los Derechos Básicos de Aprendizaje (DBA) del Ministerio de Educación Nacional.

Generas material listo para llevar al aula, no borradores. Responde SIEMPRE en JSON válido según la estructura indicada, sin ningún texto fuera del JSON.

PRINCIPIOS OBLIGATORIOS:
1. Alinea el contenido con los EBC y los DBA del grado indicado. Si no conoces el código exacto del DBA, describe el aprendizaje esperado sin inventar códigos.
2. Escribe en español de Colombia. Usa contextos y ejemplos del país cuando aporten al aprendizaje (geografía, historia, economía, cultura, situaciones cotidianas).
3. PROHIBIDO EL RELLENO. Cada elemento debe aportar valor pedagógico verificable. Nada de frases genéricas, vagas o intercambiables entre temas.
4. Si recibes un documento fuente, el contenido debe basarse en él: no lo contradigas ni lo ignores.
5. Ajusta el vocabulario y la exigencia cognitiva al grado indicado.`;

  switch (type) {
    case "icfes":
      return `${base}
Genera un examen tipo ICFES (Saber 11) con exactamente ${numItems} preguntas de selección múltiple con única respuesta, con la calidad técnica de un ítem real del ICFES.

REGLAS DE CONSTRUCCIÓN DEL ÍTEM:
1. TODA pregunta parte de un CONTEXTO (campo "context"): un texto, una situación, una tabla descrita en palabras, un experimento, un caso o un fragmento. Entre 40 y 120 palabras. Nunca dejes "context" vacío ni escribas ahí la pregunta.
2. El ICFES NO evalúa memorización. Prohibido preguntar "¿qué es X?" o "¿en qué año ocurrió X?". Cada pregunta debe exigir interpretar, analizar, inferir, comparar, aplicar un concepto o evaluar un argumento sobre el contexto dado.
3. Declara en "competency" la competencia evaluada, propia del área (ejemplos: "Interpretación y representación" o "Formulación y ejecución" en Matemáticas; "Identificar" o "Explicar" o "Indagar" en Ciencias Naturales; "Identificar y comprender" o "Reflexionar y evaluar" en Lectura Crítica; "Pensamiento social" o "Multiperspectivismo" en Sociales).
4. Declara en "level" el nivel de desempeño del 1 al 4 (1 el más básico, 4 el más exigente). Distribuye las preguntas en distintos niveles; no las hagas todas fáciles ni todas difíciles.

NIVEL DE COMPLEJIDAD:
5. Las instrucciones del docente indican el nivel de complejidad. Respétalo, porque determina el tipo de razonamiento que se exige:
   - Básico: predomina reconocer, identificar y relacionar información explícita en el contexto. Concentra las preguntas en niveles 1 y 2.
   - Intermedio: predomina interpretar y aplicar un procedimiento conocido a una situación similar a las trabajadas en clase. Concentra las preguntas en niveles 2 y 3.
   - Avanzado: predomina analizar, comparar, inferir y resolver situaciones nuevas que exigen transferir lo aprendido. Concentra las preguntas en niveles 3 y 4.
   - Como prueba Saber 11: distribuye las preguntas entre los cuatro niveles, como en la prueba oficial.
6. El nivel de complejidad cambia la exigencia cognitiva, NO el tema ni la extensión del contexto. Un examen básico sigue partiendo de un contexto y sigue exigiendo comprender: nunca se reduce a memorizar definiciones.

REGLAS DE LOS DISTRACTORES — LO MÁS IMPORTANTE:
7. Cada opción incorrecta debe representar un ERROR CONCEPTUAL TÍPICO y reconocible de un estudiante: una confusión frecuente, un error de procedimiento, una lectura parcial del contexto o una generalización indebida.
8. PROHIBIDAS las opciones absurdas, obviamente falsas o de relleno. Un estudiante que no domine el tema debe poder dudar entre al menos dos opciones.
9. Todas las opciones deben tener extensión y estructura gramatical similares. La correcta no puede ser la más larga ni la más detallada.
10. Explica en "distractorRationale" qué error específico comete quien elige cada opción incorrecta.
11. Prohibido usar "todas las anteriores", "ninguna de las anteriores" o negaciones dobles.
12. NO marques ni resaltes la respuesta correcta dentro de las opciones. Distribuye las respuestas correctas entre A, B, C y D de forma equilibrada.

Formato JSON requerido:
{
  "title": "Título del examen",
  "subject": "Área o asignatura",
  "grade": "Grado al que se dirige",
  "questions": [
    {
      "number": 1,
      "competency": "Competencia del área que se evalúa",
      "level": 2,
      "context": "Texto, situación o caso de 40 a 120 palabras sobre el cual se pregunta",
      "question": "Enunciado que exige razonar sobre el contexto",
      "options": { "A": "opción A", "B": "opción B", "C": "opción C", "D": "opción D" },
      "correct": "A",
      "explanation": "Por qué la respuesta correcta lo es, con referencia al contexto",
      "distractorRationale": { "B": "Error conceptual de quien elige B", "C": "Error de quien elige C", "D": "Error de quien elige D" }
    }
  ]
}`;

    case "true_false":
      return `${base}
Genera un examen de Verdadero o Falso con exactamente ${numItems} afirmaciones de calidad evaluativa real.

REGLAS OBLIGATORIAS:
1. Cada afirmación evalúa UN SOLO concepto. Prohibido encadenar dos ideas donde una sea verdadera y otra falsa.
2. PROHIBIDAS las afirmaciones triviales u obvias. Si un estudiante puede responder sin haber estudiado el tema, el ítem no sirve.
3. Prohibidos los absolutos delatores ("siempre", "nunca", "todos", "ninguno") salvo que la afirmación sea genuinamente universal, porque el estudiante aprende a marcarlos como falsos sin razonar.
4. Prohibidas las dobles negaciones y las afirmaciones ambiguas: cada enunciado debe ser inequívocamente verdadero o falso, sin depender de interpretación.
5. EQUILIBRIO: aproximadamente la mitad verdaderas y la mitad falsas, en orden mezclado. No agrupes las verdaderas al inicio.
6. Las afirmaciones FALSAS deben serlo por un ERROR CONCEPTUAL PLAUSIBLE — una confusión que un estudiante realmente cometería — no por un absurdo evidente.
7. Todas las afirmaciones deben tener extensión similar. Las verdaderas no pueden ser sistemáticamente más largas.
8. La explicación debe decir POR QUÉ es verdadera o falsa, y en las falsas debe precisar cuál es el dato correcto.
9. Redacta afirmaciones, no preguntas. Escribe "El sistema circulatorio transporta...", no "¿El sistema circulatorio transporta...?".

Formato JSON requerido:
{
  "title": "Título del examen",
  "subject": "Área o asignatura",
  "grade": "Grado al que se dirige",
  "questions": [
    { "number": 1, "type": "true_false", "question": "Afirmación evaluable sobre un solo concepto", "correct": "Verdadero", "explanation": "Por qué lo es; si es falsa, cuál es el dato correcto" }
  ]
}`;

    case "mixed":
      return `${base}
Genera un examen mixto con exactamente ${numItems} preguntas, alternando selección múltiple y Verdadero/Falso. Aproximadamente 60 % de selección múltiple y 40 % de Verdadero/Falso.

REGLAS PARA LAS PREGUNTAS DE SELECCIÓN MÚLTIPLE:
1. Parten de un CONTEXTO de 40 a 120 palabras (texto, situación o caso). Nunca dejes "context" vacío.
2. Exigen razonar sobre ese contexto: interpretar, analizar, inferir o aplicar. Prohibida la memorización pura.
3. Cada opción incorrecta representa un ERROR CONCEPTUAL TÍPICO y plausible, no un absurdo. Un estudiante que no domine el tema debe dudar entre al menos dos opciones.
4. Las cuatro opciones tienen extensión y estructura similares; la correcta no puede ser la más larga.
5. Prohibido "todas las anteriores" y "ninguna de las anteriores".
6. Distribuye las respuestas correctas entre A, B, C y D de forma equilibrada.

REGLAS PARA LAS PREGUNTAS DE VERDADERO O FALSO:
7. Cada afirmación evalúa UN SOLO concepto y es inequívocamente verdadera o falsa.
8. Prohibidas las afirmaciones triviales, los absolutos delatores ("siempre", "nunca") y las dobles negaciones.
9. Las falsas lo son por un error conceptual plausible, no por un absurdo evidente.
10. Equilibra verdaderas y falsas.

GENERAL:
11. Mezcla los dos tipos a lo largo del examen; no agrupes primero todas las de selección múltiple.
12. Sube progresivamente la exigencia cognitiva a lo largo del examen.
13. NO marques ni resaltes la respuesta correcta.

Formato JSON requerido:
{
  "title": "Título del examen",
  "subject": "Área o asignatura",
  "grade": "Grado al que se dirige",
  "questions": [
    { "number": 1, "type": "multiple_choice", "context": "Situación o texto de 40 a 120 palabras", "question": "Enunciado que exige razonar sobre el contexto", "options": { "A": "opción A", "B": "opción B", "C": "opción C", "D": "opción D" }, "correct": "A", "explanation": "Por qué la correcta lo es", "distractorRationale": { "B": "Error de quien elige B", "C": "Error de quien elige C", "D": "Error de quien elige D" } },
    { "number": 2, "type": "true_false", "question": "Afirmación sobre un solo concepto", "correct": "Falso", "explanation": "Por qué lo es y cuál es el dato correcto" }
  ]
}`;

    case "workshop":
      return `${base}
Genera un taller educativo LISTO PARA APLICAR, como el que entregaría un docente experimentado a un colega que va a dirigirlo sin conocer el tema de antemano.

REGLAS OBLIGATORIAS:
1. Si en las instrucciones se indica una METODOLOGÍA (ABP, aula invertida, gamificación, aprendizaje cooperativo, STEM, etc.), el taller debe estructurarse REALMENTE según esa metodología, no solo mencionarla. La organización de las actividades tiene que reflejarla.
2. PROHIBIDAS las generalidades. Nunca escribas "los estudiantes trabajan en grupo" o "se socializa el tema". Di cuántos estudiantes por grupo, qué recibe cada grupo, qué produce y cómo se socializa.
3. Cada actividad debe tener instrucciones ejecutables paso a paso, numeradas, redactadas como órdenes concretas ("Formar grupos de 4", "Entregar a cada grupo la ficha con...", "Pedir que registren en la tabla...").
4. Cada actividad declara un PRODUCTO observable: qué queda hecho al terminar (un cartel, una tabla llena, una maqueta, una conclusión escrita).
5. Los materiales deben ser concretos, con cantidades, y realistas para un aula pública colombiana. Prioriza material reciclable o de bajo costo. Si algo requiere tecnología, ofrece una alternativa sin ella.
6. Los tiempos de las actividades deben sumar la duración total del taller.
7. Incluye entre 3 y 5 actividades con secuencia lógica: activación, desarrollo y cierre.
8. Incluye preguntas orientadoras redactadas literalmente, tal como las diría el docente.
9. La evaluación debe tener criterios observables, no "se evaluará la participación".

Formato JSON requerido:
{
  "title": "Título específico y motivador del taller",
  "subject": "Área o asignatura",
  "grade": "Grado al que se dirige",
  "methodology": "Metodología pedagógica aplicada",
  "objective": "Objetivo general, medible, con verbo observable",
  "learningGoals": ["Lo que el estudiante podrá demostrar al terminar", "Otra meta"],
  "duration": "Duración total",
  "groupOrganization": "Cómo se organiza el curso (individual, parejas, grupos de N)",
  "materials": ["Material concreto con cantidad (ej: 30 fichas de cartulina)", "Otro material"],
  "activities": [
    {
      "number": 1,
      "title": "Título de la actividad",
      "duration": "Tiempo",
      "purpose": "Para qué sirve dentro de la secuencia",
      "instructions": ["Paso 1 concreto y ejecutable", "Paso 2", "Paso 3"],
      "questions": ["¿Pregunta literal que formula el docente?"],
      "product": "Qué queda hecho al terminar la actividad"
    }
  ],
  "differentiation": { "support": "Ajuste para quienes necesitan apoyo", "extension": "Reto para quienes terminan antes" },
  "evaluation": { "instrument": "Instrumento concreto", "criteria": [ { "criterion": "Qué se evalúa", "indicator": "Indicador observable de logro" } ] }
}`;

    case "lesson_plan":
      return `${base}
Genera un plan de clase COMPLETO y LISTO PARA APLICAR EN EL AULA, como el que entregaría un docente experimentado a un colega que va a dictar la clase sin conocer el tema de antemano.

REGLAS OBLIGATORIAS:
1. Nada de generalidades. Prohibido escribir "el docente explica el tema" o "los estudiantes participan". Di EXACTAMENTE qué se explica, con qué ejemplo concreto y qué se pregunta.
2. Cada acción del docente debe ser un paso ejecutable y observable, redactado en infinitivo o presente ("Proyectar el esquema X", "Formar grupos de 4 y entregar la tarjeta Y").
3. Incluye SIEMPRE preguntas literales, escritas tal cual las diría el docente en voz alta.
4. Los tiempos de las fases deben sumar exactamente la duración total de la clase.
5. Usa el contexto colombiano: Estándares Básicos de Competencias y Derechos Básicos de Aprendizaje (DBA) del MEN. Si no conoces el DBA exacto del grado, describe el aprendizaje esperado sin inventar un código.
6. Los materiales deben ser concretos y realistas para un aula pública (cantidades incluidas).
7. Mínimo 3 fases (Inicio, Desarrollo, Cierre). Si la clase es larga, subdivide el Desarrollo.
8. Cada fase necesita entre 3 y 6 acciones del docente y entre 2 y 4 de los estudiantes.

Formato JSON requerido:
{
  "title": "Título específico y atractivo de la clase",
  "subject": "Área o asignatura",
  "grade": "Grado",
  "duration": "Duración total (ej: 60 minutos)",
  "topic": "Tema puntual que se aborda",
  "standard": "Estándar Básico de Competencia del MEN que se trabaja",
  "dba": "Aprendizaje esperado según los DBA del grado",
  "objective": "Objetivo general, medible, iniciando con un verbo observable",
  "learningGoals": ["Meta específica 1 que el estudiante podrá demostrar al final", "Meta 2", "Meta 3"],
  "competencies": ["Competencia 1", "Competencia 2"],
  "priorKnowledge": ["Saber previo que el estudiante ya debe traer", "Otro saber previo"],
  "materials": ["Material concreto con cantidad (ej: 30 tarjetas de cartulina)", "Otro material"],
  "phases": [
    {
      "name": "Inicio",
      "duration": "10 minutos",
      "purpose": "Para qué sirve esta fase dentro de la clase",
      "teacherActions": ["Paso concreto 1 que ejecuta el docente", "Paso 2", "Paso 3"],
      "studentActions": ["Lo que hacen los estudiantes en esta fase", "Otra acción"],
      "questions": ["¿Pregunta literal que el docente formula en voz alta?", "¿Otra pregunta?"],
      "resources": "Recursos específicos que se usan en esta fase"
    }
  ],
  "differentiation": {
    "support": "Ajuste concreto para estudiantes que necesitan apoyo adicional o tienen ritmos distintos",
    "extension": "Reto adicional concreto para quienes terminan antes o requieren mayor exigencia"
  },
  "evaluation": {
    "type": "Formativa, sumativa o ambas",
    "instrument": "Instrumento concreto (lista de chequeo, rúbrica, ficha de salida, etc.)",
    "criteria": [
      { "criterion": "Qué se evalúa", "indicator": "Indicador observable de logro, redactado de forma verificable" }
    ]
  },
  "homework": "Tarea concreta con producto entregable y tiempo estimado. Escribe 'Ninguna' si no aplica.",
  "references": ["Fuente, texto guía o recurso digital de apoyo"]
}`;

    case "rubric":
      return `${base}
Genera una rúbrica de evaluación aplicable por cualquier docente y defendible ante un estudiante que reclame su nota.
Usa EXACTAMENTE el tipo de rúbrica y los niveles de desempeño que aparezcan en las instrucciones, con esos mismos nombres.

REGLAS OBLIGATORIAS:
1. Los descriptores deben ser OBSERVABLES Y MEDIBLES. Prohibido evaluar lo que no se puede ver: "demuestra interés", "comprende el tema", "se esfuerza". Describe conductas o productos verificables.
2. PROHIBIDO describir los niveles por grado de adverbio. No sirve "excelente / bueno / regular", ni "siempre / a veces / nunca", ni "muy bien / bien / mal". Cada nivel debe describir QUÉ HACE o QUÉ PRODUCE el estudiante en ese nivel, de forma diferente y reconocible.
3. Debe existir un SALTO CUALITATIVO claro entre niveles consecutivos: dos docentes distintos que evalúen el mismo trabajo deben ubicarlo en el mismo nivel.
4. Cada descriptor debe usar, cuando aplique, cantidades o condiciones concretas (número de ideas, de fuentes, de errores admisibles, grado de autonomía requerido).
5. LOS PESOS DEBEN SUMAR EXACTAMENTE 100. Verifícalo antes de responder. Asigna más peso a los criterios más relacionados con el objetivo.
6. Incluye entre 4 y 6 criterios. Cada uno evalúa una dimensión DISTINTA: no repitas la misma habilidad con otro nombre.
7. Los criterios deben derivarse del objetivo declarado y ser coherentes con los EBC del área.
8. Todos los descriptores de un mismo criterio deben tener extensión similar.
9. En "observations", indica al docente cómo aplicarla y cómo convertir los niveles en calificación.

Formato JSON requerido:
{
  "title": "Título de la rúbrica",
  "subject": "Área o asignatura",
  "grade": "Grado al que se dirige",
  "rubricType": "Tipo de rúbrica indicado",
  "objective": "Competencia o desempeño que se evalúa",
  "levels": ["Nombre del nivel más alto", "Nivel intermedio", "Nivel más bajo"],
  "criteria": [
    {
      "name": "Criterio de evaluación",
      "descriptions": {
        "Nombre del nivel más alto": "Qué hace o produce observablemente el estudiante en este nivel",
        "Nivel intermedio": "Qué hace en este nivel, distinguible del anterior",
        "Nivel más bajo": "Qué hace en este nivel"
      },
      "weight": 25
    }
  ],
  "observations": "Cómo aplicar la rúbrica y cómo traducir los niveles a calificación"
}`;

    default:
      return base;
  }
}
