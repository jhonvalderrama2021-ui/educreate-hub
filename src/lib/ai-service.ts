import { supabase } from "@/integrations/supabase/client";

interface GenerateParams {
  resourceType: string;
  pdfContent?: string;
  instructions?: string;
  numItems?: number;
}

// Generate via OpenAI (through edge function)
export async function generateWithOpenAI(params: GenerateParams) {
  const { data, error } = await supabase.functions.invoke("generate-resource", {
    body: params,
  });

  if (error) {
    throw new Error(error.message || "Error al conectar con el servicio de IA");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

// Generate via Ollama (direct call from browser)
export async function generateWithOllama(
  params: GenerateParams,
  ollamaUrl: string,
  model: string
) {
  const systemPrompt = getOllamaPrompt(params.resourceType, params.numItems || 10);
  const userParts: string[] = [];
  if (params.instructions) userParts.push(`Instrucciones: ${params.instructions}`);
  if (params.pdfContent) userParts.push(`\nContenido fuente:\n${params.pdfContent}`);
  if (!params.pdfContent && !params.instructions) {
    userParts.push("Genera contenido educativo de ejemplo sobre un tema general.");
  }

  try {
    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userParts.join("\n") },
        ],
        format: "json",
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Error de Ollama (${response.status})`);
    }

    const data = await response.json();
    return JSON.parse(data.message.content);
  } catch (e: any) {
    const msg = e?.message || "";
    if (
      msg.includes("Failed to fetch") ||
      msg.includes("NetworkError") ||
      msg.includes("loopback") ||
      msg.includes("CORS")
    ) {
      throw new Error(
        "No se pudo conectar con Ollama desde el navegador (HTTPS → localhost está bloqueado por seguridad).\n\n" +
        "Para usar Ollama local debes configurar DOS variables de entorno y reiniciar Ollama:\n\n" +
        "1) OLLAMA_ORIGINS=* (permite CORS desde cualquier origen)\n" +
        "2) OLLAMA_HOST=0.0.0.0:11434 (escucha en todas las interfaces)\n\n" +
        "Windows (PowerShell como Admin):\n" +
        "  setx OLLAMA_ORIGINS \"*\" /M\n" +
        "  setx OLLAMA_HOST \"0.0.0.0:11434\" /M\n" +
        "  Luego cierra Ollama desde la bandeja y vuelve a abrirlo.\n\n" +
        "macOS/Linux:\n" +
        "  launchctl setenv OLLAMA_ORIGINS \"*\"\n" +
        "  launchctl setenv OLLAMA_HOST \"0.0.0.0:11434\"\n" +
        "  Reinicia Ollama.\n\n" +
        "Nota: Chrome bloquea peticiones HTTPS hacia localhost. Si el problema persiste, usa la app en http://localhost (modo desarrollo) o usa el proveedor OpenAI."
      );
    }
    throw e;
  }
}

// Fetch available Ollama models
export async function fetchOllamaModels(ollamaUrl: string): Promise<string[]> {
  try {
    const response = await fetch(`${ollamaUrl}/api/tags`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.models?.map((m: any) => m.name) || [];
  } catch {
    return [];
  }
}

function getOllamaPrompt(type: string, numItems: number): string {
  const base = "Eres un experto pedagogo colombiano. Genera contenido educativo de alta calidad en español. Responde SIEMPRE en formato JSON válido.";
  
  const formats: Record<string, string> = {
    icfes: `Genera un examen tipo ICFES con ${numItems} preguntas. NO marques la respuesta correcta en las opciones. JSON: {"title":"","subject":"","questions":[{"number":1,"context":"","question":"","options":{"A":"","B":"","C":"","D":""},"correct":"A","explanation":""}]}`,
    true_false: `Genera un examen de Verdadero o Falso con ${numItems} preguntas. JSON: {"title":"","subject":"","questions":[{"number":1,"type":"true_false","question":"","correct":"Verdadero","explanation":""}]}`,
    mixed: `Genera un examen mixto con ${numItems} preguntas alternando selección múltiple y verdadero/falso. JSON: {"title":"","subject":"","questions":[{"number":1,"type":"multiple_choice","question":"","options":{"A":"","B":"","C":"","D":""},"correct":"A","explanation":""},{"number":2,"type":"true_false","question":"","correct":"Falso","explanation":""}]}`,
    workshop: `Genera un taller educativo. JSON: {"title":"","subject":"","objective":"","duration":"","materials":[],"activities":[{"number":1,"title":"","description":"","instructions":"","duration":""}],"evaluation":""}`,
    lesson_plan: `Genera un plan de clase. JSON: {"title":"","subject":"","grade":"","duration":"","objective":"","competencies":[],"phases":[{"name":"","duration":"","activities":"","resources":""}],"evaluation":"","homework":""}`,
    rubric: `Genera una rúbrica según el tipo y niveles indicados en las instrucciones. JSON: {"title":"","subject":"","rubricType":"","objective":"","levels":[],"criteria":[{"name":"","descriptions":{},"weight":25}],"observations":""}`,
    slides: `Genera ${numItems} diapositivas educativas profesionales en formato JSON ESTRUCTURADO. NO generes HTML. Usa layouts predefinidos: hero, grid, split, process, comparison, stats, list, timeline, conclusion. La primera slide es "hero", la última "conclusion". JSON: {"title":"","subject":"","theme":{"primary":"#1E3A5F","secondary":"#3B82F6","accent":"#6366F1","background":"#F0F4F8","text":"#1E293B","fontHeading":"'Space Grotesk', sans-serif","fontBody":"'Inter', sans-serif"},"slides":[{"layout":"hero","title":"","subtitle":"","cards":[{"icon":"school"}]},{"layout":"grid","title":"","cards":[{"icon":"lightbulb","title":"","description":"","color":"#3B82F6"}]},{"layout":"process","title":"","steps":[{"number":1,"title":"","description":"","color":"#3B82F6"}]},{"layout":"stats","title":"","stats":[{"value":"85%","label":"","color":"#3B82F6"}]},{"layout":"conclusion","title":"","subtitle":""}]}`,
  };

  return `${base}\n${formats[type] || ""}`;
}
