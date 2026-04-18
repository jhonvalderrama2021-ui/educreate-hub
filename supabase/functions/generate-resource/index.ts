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

    const systemPrompt = getSystemPrompt(resourceType, numItems || 10);
    const userParts: string[] = [];
    if (instructions) userParts.push(`Instrucciones: ${instructions}`);
    if (pdfContent) userParts.push(`\nContenido fuente del documento:\n${pdfContent}`);
    if (!pdfContent && !instructions)
      userParts.push("Genera contenido educativo de ejemplo sobre un tema general apropiado.");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${setting.value}`,
        "Content-Type": "application/json",
      },
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
      if (response.status === 401) {
        return new Response(JSON.stringify({ error: "API Key de OpenAI inválida." }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: `Error de OpenAI (${response.status}): ${errText}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    let content = JSON.parse(data.choices[0].message.content);

    // For slides: enforce variety, exact count, kill stats without source PDF, then resolve images
    if (resourceType === "slides" && content.slides) {
      const hasSourcePdf = !!(pdfContent && pdfContent.trim().length > 100);
      content = enforceLayoutVariety(content);
      content = stripStatsWithoutSource(content, hasSourcePdf);
      content = enforceSlideCount(content, numItems || 8);
      if (theme) content.theme = theme;
      content = await resolveSlideImages(content);
    }

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

async function resolveSlideImages(presentation: any): Promise<any> {
  const slides = presentation.slides || [];
  // Resolve in parallel for speed
  await Promise.all(
    slides.map(async (slide: any) => {
      if (slide.image?.query) {
        try {
          const url = await searchPexels(slide.image.query);
          if (url) slide.image.url = url;
        } catch (e) {
          console.warn("Pexels search failed for:", slide.image.query, e);
        }
      }
    })
  );
  return presentation;
}

/**
 * Force layout variety: no two consecutive same layouts, max 2 of any single layout.
 * Replaces duplicates with under-used alternatives.
 */
function enforceLayoutVariety(presentation: any): any {
  const slides = presentation.slides || [];
  if (slides.length <= 2) return presentation;

  const middleLayouts = [
    "grid", "split", "process", "comparison", "list", "timeline",
    "quote", "imageFull", "bigNumber", "twoColumnText",
  ];
  const counts: Record<string, number> = {};
  slides.forEach((s: any) => {
    counts[s.layout] = (counts[s.layout] || 0) + 1;
  });

  for (let i = 1; i < slides.length - 1; i++) {
    const prev = slides[i - 1].layout;
    const curr = slides[i].layout;
    const isStatsWithoutCare = curr === "stats"; // handled later
    if (curr === prev || counts[curr] > 2) {
      // pick the least used layout that isn't prev
      const candidate = middleLayouts
        .filter((l) => l !== prev)
        .sort((a, b) => (counts[a] || 0) - (counts[b] || 0))[0];
      if (candidate) {
        counts[curr]--;
        counts[candidate] = (counts[candidate] || 0) + 1;
        slides[i] = transformSlideLayout(slides[i], candidate);
      }
    }
  }
  presentation.slides = slides;
  return presentation;
}

/**
 * Remove "stats" slides when there is no source PDF (no real data to cite).
 * Convert them into a "list" or "grid" using the existing labels as content.
 */
function stripStatsWithoutSource(presentation: any, hasSourcePdf: boolean): any {
  if (hasSourcePdf) return presentation;
  const slides = presentation.slides || [];
  presentation.slides = slides.map((s: any) => {
    if (s.layout !== "stats") return s;
    const items = (s.stats || []).map((st: any, i: number) => ({
      icon: ["insights", "trending_up", "lightbulb", "school"][i % 4],
      title: st.label || `Aspecto ${i + 1}`,
      description: `Concepto clave relacionado con ${presentation.title || "el tema"}.`,
    }));
    return { layout: "list", title: s.title, listItems: items };
  });
  return presentation;
}

/**
 * Lightweight transform that swaps a slide's layout while preserving its title,
 * and synthesising minimal content for the new layout type.
 */
function transformSlideLayout(slide: any, newLayout: string): any {
  const title = slide.title || "Información clave";
  const next: any = { layout: newLayout, title };
  if (newLayout === "quote") {
    next.content = slide.subtitle || slide.content || `Reflexión central sobre ${title.toLowerCase()}.`;
    next.subtitle = "Reflexión";
  } else if (newLayout === "imageFull") {
    next.subtitle = slide.subtitle || slide.content?.slice(0, 120) || "";
    next.image = slide.image || { query: title, alt: title, placement: "background" };
  } else if (newLayout === "bigNumber") {
    next.bigNumber = slide.stats?.[0]?.value || "1";
    next.subtitle = slide.stats?.[0]?.label || slide.subtitle || title;
    next.content = slide.content || `Detalle relevante sobre ${title.toLowerCase()}.`;
  } else if (newLayout === "twoColumnText") {
    next.columns = slide.columns || [
      { title: "Aspecto 1", color: "#3B82F6", points: [slide.subtitle || "Punto destacado"] },
      { title: "Aspecto 2", color: "#6366F1", points: [slide.content?.slice(0, 80) || "Punto complementario"] },
    ];
  } else if (newLayout === "list") {
    next.listItems = slide.listItems || (slide.cards || []).slice(0, 4).map((c: any) => ({
      icon: c.icon || "check_circle", title: c.title, description: c.description,
    }));
    if (!next.listItems.length) {
      next.listItems = [{ icon: "check_circle", title, description: slide.content || slide.subtitle || "Detalle relevante." }];
    }
  } else if (newLayout === "grid") {
    next.cards = slide.cards || (slide.listItems || []).slice(0, 4).map((l: any) => ({
      icon: l.icon || "star", title: l.title, description: l.description, color: "#3B82F6",
    }));
    if (!next.cards.length) {
      next.cards = [
        { icon: "lightbulb", title, description: slide.content || slide.subtitle || "Concepto clave.", color: "#3B82F6" },
      ];
    }
  } else if (newLayout === "split") {
    next.subtitle = slide.subtitle || "";
    next.content = slide.content || slide.subtitle || `Información relevante sobre ${title.toLowerCase()}.`;
    next.image = slide.image || { query: title, alt: title, placement: "right" };
  } else {
    // fallback: keep original
    return slide;
  }
  return next;
}

/**
 * Ensures the presentation has exactly `expected` slides.
 * - Truncates if too many (preserves hero + conclusion).
 * - Pads with auto-generated content slides if too few.
 */
function enforceSlideCount(presentation: any, expected: number): any {
  let slides = presentation.slides || [];
  console.log(`[slides] Generated ${slides.length}, expected ${expected}`);
  if (slides.length === expected) return presentation;

  if (slides.length > expected) {
    const hero = slides[0];
    const conclusion = slides[slides.length - 1];
    const middle = slides.slice(1, -1).slice(0, expected - 2);
    presentation.slides = [hero, ...middle, conclusion];
    return presentation;
  }

  const palette = ["#3B82F6", "#6366F1", "#8B5CF6", "#22C55E", "#F59E0B", "#EF4444"];
  const lastIsConclusion = slides[slides.length - 1]?.layout === "conclusion";
  const conclusion = lastIsConclusion ? slides.pop() : null;
  const missing = expected - slides.length - (conclusion ? 1 : 0);
  const layouts = ["list", "grid", "stats", "process", "split"];
  for (let i = 0; i < missing; i++) {
    slides.push(buildFillerSlide(layouts[i % layouts.length], presentation.title || "el tema", i + 1, palette[i % palette.length]));
  }
  if (conclusion) slides.push(conclusion);
  presentation.slides = slides;
  return presentation;
}

function buildFillerSlide(layout: string, topic: string, idx: number, color: string): any {
  const base: any = { layout, title: `Aspecto clave ${idx}` };
  if (layout === "list") {
    base.listItems = [
      { icon: "check_circle", title: "Punto importante", description: `Detalle relevante sobre ${topic} que conviene profundizar en el aula.` },
      { icon: "lightbulb", title: "Idea destacada", description: `Aplicación práctica de ${topic} dentro del contexto educativo.` },
      { icon: "school", title: "Aprendizaje esperado", description: `Lo que el estudiante debe comprender al finalizar esta sección.` },
    ];
  } else if (layout === "grid") {
    base.cards = [
      { icon: "star", title: "Concepto central", description: `Definición clave relacionada con ${topic}.`, color },
      { icon: "explore", title: "Contexto", description: `Marco general en el que se aplica ${topic}.`, color },
      { icon: "build", title: "Aplicación", description: `Cómo se usa ${topic} en la práctica.`, color },
    ];
  } else if (layout === "stats") {
    base.stats = [
      { value: "100%", label: "Comprensión esperada", color },
      { value: "3+", label: "Áreas de aplicación", color },
      { value: "5", label: "Conceptos clave", color },
    ];
  } else if (layout === "process") {
    base.steps = [
      { number: 1, title: "Explorar", description: `Acercamiento inicial a ${topic}.`, color },
      { number: 2, title: "Comprender", description: `Análisis profundo de ${topic}.`, color },
      { number: 3, title: "Aplicar", description: `Uso de ${topic} en situaciones reales.`, color },
    ];
  } else {
    base.layout = "split";
    base.subtitle = `Más sobre ${topic}`;
    base.content = `Esta sección amplía la información sobre ${topic} con aspectos adicionales relevantes para el aprendizaje del estudiante.`;
    base.image = { query: topic, alt: topic, placement: "right" };
  }
  return base;
}

async function searchPexels(query: string): Promise<string | null> {
  const apiKey = Deno.env.get("PEXELS_API_KEY");
  if (!apiKey) {
    console.warn("PEXELS_API_KEY not configured");
    return null;
  }
  try {
    const encoded = encodeURIComponent(query);
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encoded}&per_page=5&orientation=landscape`,
      { headers: { Authorization: apiKey } }
    );
    if (!res.ok) {
      console.warn("Pexels API error:", res.status);
      return null;
    }
    const data = await res.json();
    const photos = data.photos || [];
    if (photos.length === 0) return null;
    const pick = photos[Math.floor(Math.random() * photos.length)];
    const imgUrl = pick?.src?.large2x || pick?.src?.large || pick?.src?.original || null;
    if (!imgUrl) return null;

    // Return direct Pexels URL — Pexels supports CORS, so the client can load with crossOrigin="anonymous"
    // (Base64 inlining was removed because encoding 8+ images on the edge worker exceeded CPU limits.)
    return imgUrl;
  } catch (e) {
    console.warn("Pexels search exception:", e);
    return null;
  }
}

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
    {
      "number": 1,
      "type": "true_false",
      "question": "Enunciado afirmativo o negativo",
      "correct": "Verdadero",
      "explanation": "Explicación"
    }
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
    {
      "number": 1,
      "type": "multiple_choice",
      "question": "Enunciado",
      "options": { "A": "opción A", "B": "opción B", "C": "opción C", "D": "opción D" },
      "correct": "A",
      "explanation": "Explicación"
    },
    {
      "number": 2,
      "type": "true_false",
      "question": "Enunciado afirmativo",
      "correct": "Falso",
      "explanation": "Explicación"
    }
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
    {
      "number": 1,
      "title": "Título de la actividad",
      "description": "Descripción detallada",
      "instructions": "Instrucciones paso a paso",
      "duration": "Tiempo estimado"
    }
  ],
  "evaluation": "Criterios de evaluación"
}`;

    case "slides":
      return getSlidesPrompt(numItems);

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
    {
      "name": "Inicio",
      "duration": "Tiempo",
      "activities": "Descripción de actividades",
      "resources": "Recursos necesarios"
    }
  ],
  "evaluation": "Estrategia de evaluación",
  "homework": "Tarea o actividad extra"
}`;

    case "rubric":
      return `${base}
Genera una rúbrica de evaluación completa y detallada según el tipo y niveles especificados en las instrucciones.
Los niveles de desempeño que aparecen en las instrucciones deben usarse exactamente como se indican.
El tipo de rúbrica especificado debe determinar la estructura:
- Rúbrica Analítica: evalúa cada criterio por separado con descripciones por nivel
- Rúbrica Holística: evalúa de forma global con una descripción general por nivel
- Lista de Verificación: criterios con cumple/no cumple
- Rúbrica Escalar: escala numérica con descriptores
- Rúbrica de Puntos: puntaje por criterio

Formato JSON requerido:
{
  "title": "Título de la rúbrica",
  "subject": "Asignatura",
  "rubricType": "Tipo de rúbrica",
  "objective": "Objetivo o competencia a evaluar",
  "levels": ["Nivel1", "Nivel2", "Nivel3"],
  "criteria": [
    {
      "name": "Criterio de evaluación",
      "descriptions": {
        "Nivel1": "Descripción detallada",
        "Nivel2": "Descripción detallada",
        "Nivel3": "Descripción detallada"
      },
      "weight": 25
    }
  ],
  "observations": "Observaciones adicionales para el evaluador"
}`;

    default:
      return base;
  }
}

function getSlidesPrompt(numItems: number): string {
  return `Eres un diseñador experto de presentaciones educativas profesionales. Genera una presentación con exactamente ${numItems} diapositivas.

IMPORTANTE: Genera JSON ESTRUCTURADO, NO HTML. Cada diapositiva usa un layout predefinido.

# FORMATO JSON REQUERIDO

{
  "title": "Título de la presentación",
  "subject": "Área o asignatura",
  "theme": {
    "primary": "#1E3A5F",
    "secondary": "#3B82F6",
    "accent": "#6366F1",
    "background": "#F0F4F8",
    "text": "#1E293B",
    "fontHeading": "'Space Grotesk', sans-serif",
    "fontBody": "'Inter', sans-serif"
  },
  "slides": [
    // Cada slide tiene un "layout" y campos de contenido según su tipo
  ]
}

# LAYOUTS DISPONIBLES

## 1. "hero" — Portada (PRIMERA diapositiva)
{
  "layout": "hero",
  "title": "Título de la Presentación",
  "subtitle": "Subtítulo descriptivo",
  "cards": [{ "icon": "school" }]
}

## 2. "grid" — Tarjetas en grid (conceptos, características)
{
  "layout": "grid",
  "title": "Conceptos Clave",
  "cards": [
    { "icon": "lightbulb", "title": "Concepto 1", "description": "Descripción detallada", "color": "#3B82F6" },
    { "icon": "eco", "title": "Concepto 2", "description": "Descripción detallada", "color": "#22C55E" }
  ]
}

## 3. "split" — Texto + imagen lado a lado
{
  "layout": "split",
  "title": "Título del Tema",
  "subtitle": "Descripción introductoria",
  "content": "Texto más largo explicando el tema",
  "image": { "query": "education classroom students", "alt": "Estudiantes en clase", "placement": "right" },
  "listItems": [
    { "icon": "check_circle", "title": "Punto 1", "description": "Detalle" }
  ]
}

## 4. "process" — Flujo de proceso con pasos numerados
{
  "layout": "process",
  "title": "Proceso de Aprendizaje",
  "steps": [
    { "number": 1, "title": "Explorar", "description": "Investigación inicial", "color": "#3B82F6" },
    { "number": 2, "title": "Analizar", "description": "Procesamiento de datos", "color": "#6366F1" },
    { "number": 3, "title": "Aplicar", "description": "Puesta en práctica", "color": "#22C55E" }
  ]
}

## 5. "comparison" — Comparación lado a lado
{
  "layout": "comparison",
  "title": "Comparación",
  "columns": [
    { "title": "Opción A", "color": "#3B82F6", "points": ["Punto 1", "Punto 2", "Punto 3"] },
    { "title": "Opción B", "color": "#F59E0B", "points": ["Punto 1", "Punto 2"] }
  ]
}

## 6. "stats" — Estadísticas con números grandes (SOLO si tienes datos verificables del documento fuente)
{
  "layout": "stats",
  "title": "Datos Importantes",
  "stats": [
    { "value": "85%", "label": "De los estudiantes mejoran sus calificaciones", "source": "MEN, 2023", "color": "#3B82F6" },
    { "value": "+50", "label": "Recursos disponibles en la plataforma", "source": "Documento fuente", "color": "#6366F1" }
  ]
}
REGLA: cada stat DEBE incluir un campo "source" con la fuente real (ej: "DANE 2023", "MEN", "OMS 2022", "Documento fuente"). Si no puedes citar fuente real, NO uses layout "stats" — usa "list" o "grid" en su lugar.

## 7. "list" — Lista con iconos
{
  "layout": "list",
  "title": "Características Principales",
  "listItems": [
    { "icon": "star", "title": "Característica 1", "description": "Explicación detallada" },
    { "icon": "trending_up", "title": "Característica 2", "description": "Explicación detallada" }
  ]
}

## 8. "timeline" — Línea de tiempo
{
  "layout": "timeline",
  "title": "Cronología",
  "timelineEvents": [
    { "date": "Fase 1", "title": "Inicio", "description": "Descripción del evento" },
    { "date": "Fase 2", "title": "Desarrollo", "description": "Descripción del evento" }
  ]
}

## 9. "conclusion" — Cierre (ÚLTIMA diapositiva)
{
  "layout": "conclusion",
  "title": "Conclusiones",
  "subtitle": "Resumen de los puntos clave",
  "content": "Texto adicional de cierre"
}

## 10. "quote" — Cita destacada (gran impacto visual)
{
  "layout": "quote",
  "title": "Reflexión",
  "content": "Una cita poderosa o frase clave de 15-30 palabras que resuma una idea central del tema.",
  "subtitle": "— Autor o contexto"
}

## 11. "imageFull" — Imagen pantalla completa con texto superpuesto
{
  "layout": "imageFull",
  "title": "Título Impactante",
  "subtitle": "Subtítulo descriptivo de una frase",
  "image": { "query": "specific topic keywords in english", "alt": "descripción", "placement": "background" }
}

## 12. "bigNumber" — Un único número/dato gigante con explicación
{
  "layout": "bigNumber",
  "title": "Dato Clave",
  "bigNumber": "73%",
  "subtitle": "De impacto medible en el aula",
  "content": "Explicación de 30-60 palabras del contexto, la fuente y la relevancia educativa de este dato."
}

## 13. "twoColumnText" — Dos columnas de texto descriptivo (sin tarjetas)
{
  "layout": "twoColumnText",
  "title": "Dos Perspectivas",
  "columns": [
    { "title": "Perspectiva A", "color": "#3B82F6", "points": ["Frase descriptiva completa.", "Otra frase con detalle."] },
    { "title": "Perspectiva B", "color": "#EC4899", "points": ["Frase descriptiva completa.", "Otra frase con detalle."] }
  ]
}

# REGLAS CRÍTICAS
1. Genera EXACTAMENTE ${numItems} slides en el array "slides". Ni una más ni una menos. Cuenta antes de responder.
2. La PRIMERA slide SIEMPRE usa layout "hero".
3. La ÚLTIMA slide SIEMPRE usa layout "conclusion".
4. VARIEDAD OBLIGATORIA en las slides intermedias: usa al menos ${Math.min(6, Math.max(3, numItems - 3))} layouts DIFERENTES de esta lista: grid, split, process, comparison, list, timeline, quote, imageFull, bigNumber, twoColumnText.
5. NUNCA repitas el mismo layout dos veces seguidas. NUNCA uses el mismo layout más de 2 veces en toda la presentación.
6. Usa iconos de Material Icons válidos (school, lightbulb, eco, star, check_circle, trending_up, science, public, groups, psychology, history, build, explore, insights, etc.).
7. Elige una paleta de colores coherente con el tema (no siempre azul: ajusta al tema — verde para naturaleza, rojo/ocre para historia, púrpura para arte).
8. Para slides "split" e "imageFull", incluye "image.query" con 3-5 palabras clave ESPECÍFICAS en INGLÉS relacionadas al tema (ej: "ancient roman colosseum", "amazon rainforest aerial", "mathematics chalkboard equations"). NO uses queries genéricos como "education" o "school".
9. Cada slide debe tener su propio "image.query" único — NO repitas el mismo query en varias slides.
10. CONTENIDO RICO Y SUSTANCIAL — esto es crítico:
    - Títulos de slide: 3-8 palabras claras.
    - Subtítulos: una frase completa (10-18 palabras).
    - Descripciones de cards/listItems/steps: 2-3 frases completas (25-50 palabras cada una).
    - "content" en split/conclusion/bigNumber: párrafo de 40-80 palabras con información real y educativa.
    - Labels de stats: frase descriptiva (5-10 palabras), nunca solo una palabra.
    - Puntos en comparison/twoColumnText: frases completas, no fragmentos.
11. Cantidad de elementos por slide:
    - grid: 3-4 cards
    - process: 3-5 steps
    - stats: 3-4 stats (SOLO con campo "source")
    - list: 3-5 listItems
    - comparison/twoColumnText: exactamente 2 columns con 3-5 points cada una
    - timeline: 3-5 events
12. El contenido debe ser informativo, real y educativamente valioso — NO uses placeholders ni texto genérico tipo "Descripción 1".
13. Si NO se proporciona documento fuente, EVITA usar el layout "stats" — usa "list", "grid", "bigNumber" (con datos generales conocidos) o "quote" en su lugar.`;
}
