import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { resourceType, pdfContent, instructions, numItems, theme } = await req.json();

    if (!resourceType) {
      return new Response(JSON.stringify({ error: "resourceType es requerido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    if (instructions) userParts.push(`Instrucciones: ${instructions}`);
    if (pdfContent) userParts.push(`\nContenido fuente del documento:\n${pdfContent}`);
    if (!pdfContent && !instructions)
      userParts.push("Genera contenido educativo de ejemplo sobre un tema general apropiado.");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userParts.join("\n") },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 16000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI error:", response.status, errText);
      return new Response(JSON.stringify({ error: `Error de OpenAI (${response.status}): ${errText}` }), {
        status: response.status === 401 ? 401 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = JSON.parse(data.choices[0].message.content);

    return new Response(JSON.stringify(content), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-resource error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
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
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: sysPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
      max_tokens: 3000,
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
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.75,
      max_tokens: 1500,
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
  const base = "Eres un experto pedagogo colombiano. Genera contenido educativo de alta calidad en español. Responde SIEMPRE en formato JSON válido según la estructura indicada.";

  switch (type) {
    case "icfes":
      return `${base}
Genera un examen tipo ICFES (Saber 11) con exactamente ${numItems} preguntas de selección múltiple con única respuesta.
IMPORTANTE: NO resaltes ni marques la respuesta correcta en las opciones. Las respuestas correctas se mostrarán al final del examen.
Formato JSON requerido:
{
  "title": "Título del examen",
  "subject": "Área o asignatura",
  "questions": [
    {
      "number": 1,
      "context": "Contexto o texto de lectura (si aplica)",
      "question": "Enunciado de la pregunta",
      "options": { "A": "opción A", "B": "opción B", "C": "opción C", "D": "opción D" },
      "correct": "A",
      "explanation": "Explicación de por qué es la respuesta correcta"
    }
  ]
}`;

    case "true_false":
      return `${base}
Genera un examen de Verdadero o Falso con exactamente ${numItems} preguntas.
IMPORTANTE: NO resaltes ni marques la respuesta correcta en el enunciado.
Formato JSON requerido:
{
  "title": "Título del examen",
  "subject": "Área o asignatura",
  "questions": [
    { "number": 1, "type": "true_false", "question": "Enunciado", "correct": "Verdadero", "explanation": "Explicación" }
  ]
}`;

    case "mixed":
      return `${base}
Genera un examen mixto con exactamente ${numItems} preguntas. Alterna entre preguntas tipo ICFES (selección múltiple) y preguntas de Verdadero o Falso.
IMPORTANTE: NO resaltes ni marques la respuesta correcta.
Formato JSON requerido:
{
  "title": "Título del examen",
  "subject": "Área o asignatura",
  "questions": [
    { "number": 1, "type": "multiple_choice", "question": "Enunciado", "options": { "A": "opción A", "B": "opción B", "C": "opción C", "D": "opción D" }, "correct": "A", "explanation": "Explicación" },
    { "number": 2, "type": "true_false", "question": "Enunciado", "correct": "Falso", "explanation": "Explicación" }
  ]
}`;

    case "workshop":
      return `${base}
Genera un taller educativo completo con actividades prácticas.
Formato JSON requerido:
{
  "title": "Título del taller",
  "subject": "Área o asignatura",
  "objective": "Objetivo general",
  "duration": "Duración estimada",
  "materials": ["material 1", "material 2"],
  "activities": [
    { "number": 1, "title": "Título de la actividad", "description": "Descripción detallada", "instructions": "Instrucciones paso a paso", "duration": "Tiempo estimado" }
  ],
  "evaluation": "Criterios de evaluación"
}`;

    case "lesson_plan":
      return `${base}
Genera un plan de clase completo y detallado.
Formato JSON requerido:
{
  "title": "Título del plan de clase",
  "subject": "Asignatura",
  "grade": "Grado",
  "duration": "Duración",
  "objective": "Objetivo de aprendizaje",
  "competencies": ["competencia 1"],
  "phases": [
    { "name": "Inicio", "duration": "Tiempo", "activities": "Descripción de actividades", "resources": "Recursos necesarios" }
  ],
  "evaluation": "Estrategia de evaluación",
  "homework": "Tarea o actividad extra"
}`;

    case "rubric":
      return `${base}
Genera una rúbrica de evaluación completa y detallada según el tipo y niveles especificados en las instrucciones.
Los niveles de desempeño que aparecen en las instrucciones deben usarse exactamente como se indican.
Formato JSON requerido:
{
  "title": "Título de la rúbrica",
  "subject": "Asignatura",
  "rubricType": "Tipo de rúbrica",
  "objective": "Objetivo o competencia a evaluar",
  "levels": ["Nivel1", "Nivel2", "Nivel3"],
  "criteria": [
    { "name": "Criterio de evaluación", "descriptions": { "Nivel1": "Descripción detallada", "Nivel2": "Descripción detallada", "Nivel3": "Descripción detallada" }, "weight": 25 }
  ],
  "observations": "Observaciones adicionales para el evaluador"
}`;

    default:
      return base;
  }
}
