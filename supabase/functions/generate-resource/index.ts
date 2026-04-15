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
  return `Eres un diseñador experto de presentaciones educativas. Genera una presentación profesional con exactamente ${numItems} diapositivas.

CADA diapositiva DEBE ser un documento HTML completo y autocontenido renderizado a 1280×720px.

# PALETA DE COLORES
Usa UNA paleta consistente en TODAS las diapositivas. Elige una de estas o crea una propia:
- Azul profesional: fondo #F0F4F8, primario #1E3A5F, acento #3B82F6, texto #1E293B
- Verde educativo: fondo #F0FDF4, primario #14532D, acento #22C55E, texto #1E293B
- Índigo moderno: fondo #EEF2FF, primario #312E81, acento #6366F1, texto #1E293B

# ESTRUCTURA HTML OBLIGATORIA
Cada slide debe seguir esta estructura exacta:
\`\`\`html
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1280px;height:720px;overflow:hidden;font-family:'Inter',sans-serif;background:#F0F4F8}
h1,h2,h3{font-family:'Space Grotesk',sans-serif}
.icon{font-family:'Material Icons';font-style:normal;font-weight:normal;font-size:32px;line-height:1;display:inline-block}
</style>
</head>
<body>
<!-- contenido -->
</body>
</html>
\`\`\`

# TIPOS DE LAYOUT (usa uno DIFERENTE por diapositiva)

## 1. PORTADA HERO (solo para la primera diapositiva)
Título grande centrado con subtítulo, icono decorativo grande, gradiente de fondo.
Ejemplo de body:
<div style="height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1E3A5F 0%,#3B82F6 100%);padding:80px;text-align:center">
  <div>
    <div style="background:rgba(255,255,255,0.15);border-radius:24px;width:80px;height:80px;display:flex;align-items:center;justify-content:center;margin:0 auto 32px">
      <span class="icon" style="color:white;font-size:48px">school</span>
    </div>
    <h1 style="font-size:52px;font-weight:700;color:white;margin-bottom:16px;line-height:1.2">Título de la Presentación</h1>
    <p style="font-size:22px;color:rgba(255,255,255,0.85);max-width:700px;margin:0 auto">Subtítulo descriptivo aquí</p>
  </div>
</div>

## 2. TARJETAS EN GRID (para conceptos, características)
2-4 tarjetas con icono, título y descripción en grid.
Ejemplo de body:
<div style="height:100%;padding:60px 70px;display:flex;flex-direction:column;gap:36px">
  <div style="display:flex;align-items:center;gap:16px">
    <div style="background:linear-gradient(135deg,#3B82F6,#6366F1);border-radius:14px;padding:12px;display:flex"><span class="icon" style="color:white;font-size:28px">auto_awesome</span></div>
    <h2 style="font-size:36px;font-weight:700;color:#1E293B">Conceptos Clave</h2>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;flex:1">
    <div style="background:white;border-radius:16px;padding:28px;box-shadow:0 2px 12px rgba(0,0,0,0.06);border:1px solid #E2E8F0">
      <div style="background:#EFF6FF;border-radius:12px;width:48px;height:48px;display:flex;align-items:center;justify-content:center;margin-bottom:16px"><span class="icon" style="color:#3B82F6;font-size:24px">lightbulb</span></div>
      <h3 style="font-size:18px;font-weight:600;color:#1E293B;margin-bottom:8px">Concepto 1</h3>
      <p style="font-size:14px;color:#64748B;line-height:1.6">Descripción del concepto con detalle educativo relevante.</p>
    </div>
    <div style="background:white;border-radius:16px;padding:28px;box-shadow:0 2px 12px rgba(0,0,0,0.06);border:1px solid #E2E8F0">
      <div style="background:#F0FDF4;border-radius:12px;width:48px;height:48px;display:flex;align-items:center;justify-content:center;margin-bottom:16px"><span class="icon" style="color:#22C55E;font-size:24px">eco</span></div>
      <h3 style="font-size:18px;font-weight:600;color:#1E293B;margin-bottom:8px">Concepto 2</h3>
      <p style="font-size:14px;color:#64748B;line-height:1.6">Descripción del concepto con detalle educativo relevante.</p>
    </div>
  </div>
</div>

## 3. FLUJO DE PROCESO (para pasos, etapas, workflows)
Pasos numerados conectados con flechas horizontales.
Ejemplo de body:
<div style="height:100%;padding:60px 70px;display:flex;flex-direction:column;gap:40px">
  <h2 style="font-size:36px;font-weight:700;color:#1E293B;text-align:center">Proceso de Aprendizaje</h2>
  <div style="display:flex;align-items:center;justify-content:center;gap:12px;flex:1">
    <div style="background:white;border-radius:16px;padding:24px 20px;text-align:center;flex:1;box-shadow:0 2px 12px rgba(0,0,0,0.06);border-top:4px solid #3B82F6">
      <div style="background:#3B82F6;color:white;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-weight:700;font-size:18px">1</div>
      <h3 style="font-size:16px;font-weight:600;color:#1E293B;margin-bottom:6px">Explorar</h3>
      <p style="font-size:13px;color:#64748B">Investigación inicial del tema</p>
    </div>
    <span class="icon" style="color:#CBD5E1;font-size:28px">arrow_forward</span>
    <div style="background:white;border-radius:16px;padding:24px 20px;text-align:center;flex:1;box-shadow:0 2px 12px rgba(0,0,0,0.06);border-top:4px solid #6366F1">
      <div style="background:#6366F1;color:white;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-weight:700;font-size:18px">2</div>
      <h3 style="font-size:16px;font-weight:600;color:#1E293B;margin-bottom:6px">Analizar</h3>
      <p style="font-size:13px;color:#64748B">Procesamiento de información</p>
    </div>
    <span class="icon" style="color:#CBD5E1;font-size:28px">arrow_forward</span>
    <div style="background:white;border-radius:16px;padding:24px 20px;text-align:center;flex:1;box-shadow:0 2px 12px rgba(0,0,0,0.06);border-top:4px solid #22C55E">
      <div style="background:#22C55E;color:white;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-weight:700;font-size:18px">3</div>
      <h3 style="font-size:16px;font-weight:600;color:#1E293B;margin-bottom:6px">Aplicar</h3>
      <p style="font-size:13px;color:#64748B">Puesta en práctica</p>
    </div>
  </div>
</div>

## 4. COMPARACIÓN LADO A LADO (para pros/contras, antes/después)
Dos columnas con encabezado y lista de puntos.
Ejemplo de body:
<div style="height:100%;padding:60px 70px;display:flex;flex-direction:column;gap:32px">
  <h2 style="font-size:36px;font-weight:700;color:#1E293B;text-align:center">Comparación</h2>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;flex:1">
    <div style="background:white;border-radius:16px;padding:32px;border-left:5px solid #3B82F6;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
      <h3 style="font-size:22px;font-weight:700;color:#3B82F6;margin-bottom:20px">Opción A</h3>
      <div style="display:flex;flex-direction:column;gap:14px">
        <div style="display:flex;align-items:flex-start;gap:10px"><span class="icon" style="color:#22C55E;font-size:20px">check_circle</span><p style="font-size:14px;color:#475569;line-height:1.5">Punto a favor explicado</p></div>
        <div style="display:flex;align-items:flex-start;gap:10px"><span class="icon" style="color:#22C55E;font-size:20px">check_circle</span><p style="font-size:14px;color:#475569;line-height:1.5">Otro punto a favor</p></div>
      </div>
    </div>
    <div style="background:white;border-radius:16px;padding:32px;border-left:5px solid #F59E0B;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
      <h3 style="font-size:22px;font-weight:700;color:#F59E0B;margin-bottom:20px">Opción B</h3>
      <div style="display:flex;flex-direction:column;gap:14px">
        <div style="display:flex;align-items:flex-start;gap:10px"><span class="icon" style="color:#22C55E;font-size:20px">check_circle</span><p style="font-size:14px;color:#475569;line-height:1.5">Punto a favor explicado</p></div>
      </div>
    </div>
  </div>
</div>

## 5. ESTADÍSTICAS / DATOS DESTACADOS (para cifras, métricas)
Números grandes con etiquetas.
Ejemplo de body:
<div style="height:100%;padding:60px 70px;display:flex;flex-direction:column;gap:40px">
  <h2 style="font-size:36px;font-weight:700;color:#1E293B;text-align:center">Datos Importantes</h2>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px;flex:1;align-items:center">
    <div style="text-align:center;background:white;border-radius:16px;padding:40px 24px;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
      <div style="font-size:56px;font-weight:700;color:#3B82F6;font-family:'Space Grotesk',sans-serif">85%</div>
      <p style="font-size:16px;color:#64748B;margin-top:8px">De los estudiantes mejoran</p>
    </div>
    <div style="text-align:center;background:white;border-radius:16px;padding:40px 24px;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
      <div style="font-size:56px;font-weight:700;color:#6366F1;font-family:'Space Grotesky',sans-serif">+50</div>
      <p style="font-size:16px;color:#64748B;margin-top:8px">Recursos disponibles</p>
    </div>
    <div style="text-align:center;background:white;border-radius:16px;padding:40px 24px;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
      <div style="font-size:56px;font-weight:700;color:#22C55E;font-family:'Space Grotesk',sans-serif">4.8</div>
      <p style="font-size:16px;color:#64748B;margin-top:8px">Calificación promedio</p>
    </div>
  </div>
</div>

## 6. LISTA CON ICONOS (para características, beneficios)
Lista vertical con iconos a la izquierda.
Ejemplo de body:
<div style="height:100%;padding:60px 70px;display:flex;flex-direction:column;gap:32px">
  <h2 style="font-size:36px;font-weight:700;color:#1E293B">Características Principales</h2>
  <div style="display:flex;flex-direction:column;gap:16px;flex:1">
    <div style="display:flex;align-items:center;gap:20px;background:white;border-radius:14px;padding:20px 24px;box-shadow:0 2px 8px rgba(0,0,0,0.04);border:1px solid #E2E8F0">
      <div style="background:#EFF6FF;border-radius:12px;width:52px;height:52px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><span class="icon" style="color:#3B82F6;font-size:26px">star</span></div>
      <div><h3 style="font-size:17px;font-weight:600;color:#1E293B;margin-bottom:4px">Punto importante</h3><p style="font-size:14px;color:#64748B;line-height:1.5">Explicación detallada del punto con contexto educativo.</p></div>
    </div>
  </div>
</div>

## 7. TIMELINE VERTICAL (para historia, cronología)
Línea vertical con eventos a los lados.

## 8. CONCLUSIÓN / CIERRE (para la última diapositiva)
Resumen con llamado a la acción, similar a portada pero con fondo más suave.

# REGLAS CRÍTICAS
1. body SIEMPRE width:1280px; height:720px; overflow:hidden
2. TODOS los estilos inline o en <style> tag. NO uses clases CSS externas excepto los links de Google Fonts y Material Icons
3. USA <span class="icon">nombre_icono</span> para Material Icons
4. Cada slide DEBE tener un layout DIFERENTE. NO repitas el mismo diseño
5. NO uses JavaScript
6. VARÍA los diseños: portada hero → tarjetas grid → flujo proceso → lista iconos → comparación → estadísticas → timeline → conclusión
7. Mantén la paleta de colores CONSISTENTE en todas las diapositivas
8. Los elementos deben estar bien distribuidos sin overflow ni contenido cortado
9. Usa border-radius: 12-16px en tarjetas, box-shadow sutil, espaciado generoso
10. Los iconos Material Icons van DENTRO de contenedores con background-color y border-radius

# FORMATO JSON
{
  "title": "Título de la presentación",
  "subject": "Área o asignatura",
  "slides": [
    { "html": "<!DOCTYPE html><html lang=\\"es\\">...</html>" }
  ]
}

IMPORTANTE: Genera exactamente ${numItems} objetos en el array "slides". Cada "html" DEBE ser un documento HTML completo y válido.`;
}
