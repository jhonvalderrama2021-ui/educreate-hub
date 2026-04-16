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
    const { resourceType, pdfContent, instructions, numItems } = await req.json();

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

    // For slides: resolve image queries to real Unsplash URLs
    if (resourceType === "slides" && content.slides) {
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
  
  for (const slide of slides) {
    if (slide.image?.query) {
      try {
        const url = await searchUnsplash(slide.image.query);
        if (url) slide.image.url = url;
      } catch (e) {
        console.warn("Unsplash search failed for:", slide.image.query, e);
      }
    }
  }
  
  return presentation;
}

async function searchUnsplash(query: string): Promise<string | null> {
  // Use Unsplash Source for simple redirect-based image (no API key needed)
  // This returns a 1280x720 image URL directly
  const encoded = encodeURIComponent(query);
  const url = `https://source.unsplash.com/1280x720/?${encoded}`;
  
  try {
    // Follow redirect to get the actual image URL
    const res = await fetch(url, { redirect: "follow" });
    if (res.ok) {
      return res.url;
    }
  } catch {
    // Fallback: use direct URL (browser will follow redirect)
  }
  
  return `https://images.unsplash.com/photo-1501504905252-473c47e087f8?w=1280&h=720&fit=crop&q=80`;
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

## 6. "stats" — Estadísticas con números grandes
{
  "layout": "stats",
  "title": "Datos Importantes",
  "stats": [
    { "value": "85%", "label": "De los estudiantes mejoran", "color": "#3B82F6" },
    { "value": "+50", "label": "Recursos disponibles", "color": "#6366F1" },
    { "value": "4.8", "label": "Calificación promedio", "color": "#22C55E" }
  ]
}

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

# REGLAS CRÍTICAS
1. La PRIMERA slide SIEMPRE usa layout "hero"
2. La ÚLTIMA slide SIEMPRE usa layout "conclusion"
3. VARÍA los layouts intermedios: NO repitas el mismo layout consecutivamente
4. Usa iconos de Material Icons válidos (school, lightbulb, eco, star, check_circle, etc.)
5. Elige una paleta de colores coherente con el tema educativo
6. Para slides "split", incluye "image.query" con palabras clave en INGLÉS para búsqueda en Unsplash
7. Genera EXACTAMENTE ${numItems} slides
8. Los textos deben ser concisos: títulos max 6 palabras, descripciones max 2 líneas
9. Cada slide grid debe tener 2-4 cards, cada process 3-5 steps, cada stats 3-4 stats`;
}
