import { supabase } from "@/integrations/supabase/client";

interface GenerateParams {
  resourceType: string;
  pdfContent?: string;
  instructions?: string;
  numItems?: number;
  theme?: string;
  /**
   * La asignatura elegida. Decide el idioma del recurso: uno de Inglés va en
   * inglés, porque es el material de la clase y no una traducción.
   */
  asignatura?: string;
  /**
   * El recurso debe salir del documento cargado, no de un tema escrito.
   *
   * Se activa cuando el docente subio un archivo y NO escribio tema. Sin
   * esta señal el servidor trata el documento como material de apoyo, y el
   * resultado sale sobre otra cosa.
   */
  desdeDocumento?: boolean;
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
  if (params.pdfContent) {
    // Cuando el documento manda va PRIMERO y se dice que es obligatorio.
    // Adjuntarlo al final como "contenido fuente" lo deja en el papel de
    // referencia, y el modelo responde sobre lo que sugieran las
    // instrucciones en vez de sobre el documento.
    if (params.desdeDocumento) {
      userParts.unshift([
        "=== DOCUMENTO FUENTE (OBLIGATORIO) ===",
        "Genera el recurso A PARTIR DE ESTE DOCUMENTO. El tema es el que trate el documento.",
        "No produzcas contenido generico ni cambies de tema.",
        "",
        params.pdfContent,
        "=== FIN DEL DOCUMENTO ===",
      ].join("\n"));
    } else {
      userParts.push(["", "Contenido fuente:", params.pdfContent].join("\n"));
    }
  }
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
    lesson_plan: `Genera un plan de clase COMPLETO y LISTO PARA APLICAR EN EL AULA. Prohibido escribir generalidades como "el docente explica el tema": di exactamente qué se hace, con qué ejemplo y qué se pregunta. Las acciones del docente son pasos ejecutables; las preguntas van redactadas literalmente. Los tiempos de las fases deben sumar la duración total. Mínimo 3 fases (Inicio, Desarrollo, Cierre), cada una con 3 a 6 acciones del docente. Contexto colombiano (MEN). JSON: {"title":"","subject":"","grade":"","duration":"","topic":"","standard":"","dba":"","objective":"","learningGoals":[],"competencies":[],"priorKnowledge":[],"materials":[],"phases":[{"name":"Inicio","duration":"","purpose":"","teacherActions":[],"studentActions":[],"questions":[],"resources":""}],"differentiation":{"support":"","extension":""},"evaluation":{"type":"","instrument":"","criteria":[{"criterion":"","indicator":""}]},"homework":"","references":[]}`,
    rubric: `Genera una rúbrica según el tipo y niveles indicados en las instrucciones. JSON: {"title":"","subject":"","rubricType":"","objective":"","levels":[],"criteria":[{"name":"","descriptions":{},"weight":25}],"observations":""}`,
    slides: `Genera ${numItems} diapositivas educativas profesionales en formato JSON ESTRUCTURADO. NO generes HTML. Usa layouts predefinidos: hero, grid, split, process, comparison, stats, list, timeline, conclusion. La primera slide es "hero", la última "conclusion". JSON: {"title":"","subject":"","theme":{"primary":"#1E3A5F","secondary":"#3B82F6","accent":"#6366F1","background":"#F0F4F8","text":"#1E293B","fontHeading":"'Space Grotesk', sans-serif","fontBody":"'Inter', sans-serif"},"slides":[{"layout":"hero","title":"","subtitle":"","cards":[{"icon":"school"}]},{"layout":"grid","title":"","cards":[{"icon":"lightbulb","title":"","description":"","color":"#3B82F6"}]},{"layout":"process","title":"","steps":[{"number":1,"title":"","description":"","color":"#3B82F6"}]},{"layout":"stats","title":"","stats":[{"value":"85%","label":"","color":"#3B82F6"}]},{"layout":"conclusion","title":"","subtitle":""}]}`,
  };

  return `${base}\n${formats[type] || ""}`;
}
