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
Genera una presentación educativa con exactamente ${numItems} diapositivas.
Cada diapositiva DEBE ser un documento HTML completo y autocontenido que se renderiza en un iframe a 1280x720px.

ESTRUCTURA OBLIGATORIA de cada slide HTML:
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 1280px; height: 720px; overflow: hidden; font-family: 'Inter', sans-serif; }
    /* ... estilos del slide ... */
  </style>
</head>
<body>
  <!-- contenido del slide -->
</body>
</html>

REGLAS DE DISEÑO OBLIGATORIAS:
1. body DEBE tener width:1280px; height:720px; overflow:hidden
2. TODOS los estilos deben estar en un <style> tag dentro de <head> o inline. NO uses clases CSS externas.
3. USA la etiqueta <span class="material-icons">nombre_icono</span> para iconos (ej: "star", "school", "check_circle", "arrow_forward", "notifications_active", "verified_user", "settings_suggest", "lock_open", "account_tree")
4. Usa colores de acento profesionales: primario #0F172A (azul oscuro), acento #3B82F6 (azul), secundario #6366F1 (indigo), texto #334155 (gris oscuro), fondo claro #F8FAFC
5. Crea layouts visuales ricos: tarjetas con border-radius y box-shadow, grids con CSS grid o flexbox, diagramas de flujo con flechas, badges con colores, números grandes destacados
6. Cada slide debe tener un diseño DIFERENTE: portada hero, contenido con cards, flujo de proceso con pasos numerados, comparación lado a lado, grid de iconos con texto, conclusión
7. NO uses JavaScript
8. Tipografía: títulos en 'Space Grotesk' 36-48px bold, subtítulos 20-24px, cuerpo 14-16px en 'Inter'
9. Agrega elementos decorativos: líneas de acento, círculos de color detrás de iconos, gradientes sutiles en headers, bordes laterales de color
10. Los iconos Material Icons deben tener un tamaño visible: font-size: 28-48px y deben estar dentro de contenedores con background-color y border-radius: 50% o border-radius: 12px

EJEMPLO de un slide bien diseñado (NO copies este contenido, solo la estructura):
<div style="display:flex;height:100%;background:#F8FAFC">
  <div style="width:100%;padding:60px 80px;display:flex;flex-direction:column;gap:40px">
    <div style="display:flex;align-items:center;gap:16px">
      <div style="background:linear-gradient(135deg,#3B82F6,#6366F1);border-radius:16px;padding:14px;display:flex">
        <span class="material-icons" style="color:white;font-size:32px">school</span>
      </div>
      <h1 style="font-family:'Space Grotesk';font-size:42px;font-weight:700;color:#0F172A">Título</h1>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;flex:1">
      <div style="background:white;border-radius:16px;padding:32px;box-shadow:0 4px 24px rgba(0,0,0,0.06);border:1px solid #E2E8F0">
        <span class="material-icons" style="font-size:36px;color:#3B82F6">check_circle</span>
        <h3 style="font-size:20px;font-weight:600;color:#0F172A;margin:12px 0 8px">Subtítulo</h3>
        <p style="font-size:14px;color:#64748B;line-height:1.6">Contenido descriptivo aquí.</p>
      </div>
    </div>
  </div>
</div>

Formato JSON requerido:
{
  "title": "Título de la presentación",
  "subject": "Área o asignatura",
  "slides": [
    {
      "html": "<!DOCTYPE html><html>...<\\/html>"
    }
  ]
}

IMPORTANTE:
- Cada slide.html DEBE ser un documento HTML completo y válido
- Varía los diseños: portada, contenido con cards, diagrama de flujo, comparación, grid, conclusión
- Usa una paleta de colores CONSISTENTE en todas las diapositivas
- El resultado debe verse tan profesional como Gamma.app o Z.ai`;

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
