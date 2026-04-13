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
      return `${base}
Genera una presentación educativa con exactamente ${numItems} diapositivas visualmente atractivas.
Cada diapositiva debe tener un diseño profesional con contenido claro y conciso.
Usa colores de fondo variados y atractivos (en formato hexadecimal de 6 caracteres SIN #).
La primera diapositiva debe ser de tipo "title".
Alterna entre layouts: "title", "content", "two_columns".
Para cada diapositiva, incluye un campo "imageQuery" con una descripción corta en inglés de una imagen relevante que ilustre el contenido.

Formato JSON requerido:
{
  "title": "Título de la presentación",
  "subject": "Área o asignatura",
  "slides": [
    {
      "title": "Título de la diapositiva",
      "subtitle": "Subtítulo (solo para layout title)",
      "layout": "title",
      "bgColor": "1a1a2e",
      "imageQuery": "photosynthesis process diagram"
    },
    {
      "title": "Conceptos clave",
      "points": ["Punto 1 con información relevante", "Punto 2 con dato importante", "Punto 3 con explicación clara"],
      "layout": "content",
      "bgColor": "16213e",
      "imageQuery": "science education illustration"
    },
    {
      "title": "Comparación",
      "leftContent": "Texto columna izquierda con explicación detallada",
      "rightContent": "Texto columna derecha con comparación",
      "layout": "two_columns",
      "bgColor": "0f3460",
      "imageQuery": "comparison chart education"
    }
  ]
}

Paleta de colores sugerida (usa variaciones):
- Tonos oscuros elegantes: 1a1a2e, 16213e, 0f3460, 533483, 2c003e
- Tonos cálidos: 7b2d26, 1b4332, 3c1642, 4a0e4e
- Tonos claros (usa texto oscuro): e8f4f8, f0e6ef, fef9ef, e8f5e9
Varía los colores entre diapositivas para crear una presentación visualmente dinámica.`;

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
