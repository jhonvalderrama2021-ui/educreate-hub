import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { seleccionarPasajes } from "../_compartido/seleccionar-pasajes.ts";
import { cobrarTokens, devolverTokens, SinTokensError, type Cobro } from "../_compartido/tokens.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Normalize Spanish word: uppercase, strip accents, keep Ñ
function normalizeWord(w: string): string {
  return w
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-ZÑ]/g, "");
}

interface WordItem {
  word: string;       // normalized
  display: string;    // original (with accents)
  clue: string;
}

interface PlacedWord {
  word: string;
  display: string;
  clue: string;
  row: number;
  col: number;
  direction: "across" | "down";
  number: number;
}

// Backtracking placement — tries to satisfy exact across/down quotas
function attemptBuild(words: WordItem[], wantedAcross: number, wantedDown: number, seedIdx: number) {
  const sorted = [...words].sort((a, b) => b.word.length - a.word.length);
  const SIZE = Math.max(18, Math.min(28, Math.ceil(Math.max(...sorted.map((w) => w.word.length)) * 1.5) + 6));
  const grid: string[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(""));
  const placed: PlacedWord[] = [];

  function canPlace(word: string, row: number, col: number, dir: "across" | "down"): boolean {
    if (row < 0 || col < 0) return false;
    if (dir === "across" && col + word.length > SIZE) return false;
    if (dir === "down" && row + word.length > SIZE) return false;

    if (dir === "across") {
      if (col > 0 && grid[row][col - 1] !== "") return false;
      if (col + word.length < SIZE && grid[row][col + word.length] !== "") return false;
    } else {
      if (row > 0 && grid[row - 1][col] !== "") return false;
      if (row + word.length < SIZE && grid[row + word.length][col] !== "") return false;
    }

    let intersections = 0;
    for (let i = 0; i < word.length; i++) {
      const r = dir === "across" ? row : row + i;
      const c = dir === "across" ? col + i : col;
      const cell = grid[r][c];
      if (cell === "") {
        if (dir === "across") {
          if (r > 0 && grid[r - 1][c] !== "") return false;
          if (r < SIZE - 1 && grid[r + 1][c] !== "") return false;
        } else {
          if (c > 0 && grid[r][c - 1] !== "") return false;
          if (c < SIZE - 1 && grid[r][c + 1] !== "") return false;
        }
      } else if (cell !== word[i]) {
        return false;
      } else {
        intersections++;
      }
    }
    return placed.length === 0 || intersections > 0;
  }

  function place(word: string, row: number, col: number, dir: "across" | "down") {
    for (let i = 0; i < word.length; i++) {
      const r = dir === "across" ? row : row + i;
      const c = dir === "across" ? col + i : col;
      grid[r][c] = word[i];
    }
  }

  // Place seed word
  const first = sorted[seedIdx % sorted.length];
  if (!first) return null;
  const firstDir: "across" | "down" = wantedAcross >= wantedDown ? "across" : "down";
  const startRow = firstDir === "across" ? Math.floor(SIZE / 2) : Math.floor((SIZE - first.word.length) / 2);
  const startCol = firstDir === "across" ? Math.floor((SIZE - first.word.length) / 2) : Math.floor(SIZE / 2);
  place(first.word, startRow, startCol, firstDir);
  placed.push({ word: first.word, display: first.display, clue: first.clue, row: startRow, col: startCol, direction: firstDir, number: 0 });

  let acrossCount = firstDir === "across" ? 1 : 0;
  let downCount = firstDir === "down" ? 1 : 0;

  function findPlacement(w: string, dir: "across" | "down"): { row: number; col: number; score: number } | null {
    let best: { row: number; col: number; score: number } | null = null;
    for (let pi = 0; pi < placed.length; pi++) {
      const p = placed[pi];
      if (p.direction === dir) continue;
      for (let pc = 0; pc < p.word.length; pc++) {
        const pLetter = p.word[pc];
        for (let wc = 0; wc < w.length; wc++) {
          if (w[wc] !== pLetter) continue;
          let row: number, col: number;
          if (dir === "down") {
            row = p.row - wc;
            col = p.col + pc;
          } else {
            row = p.row + pc;
            col = p.col - wc;
          }
          if (canPlace(w, row, col, dir)) {
            let score = 0;
            for (let i = 0; i < w.length; i++) {
              const r = dir === "across" ? row : row + i;
              const c = dir === "across" ? col + i : col;
              if (grid[r][c] === w[i]) score++;
            }
            if (!best || score > best.score) best = { row, col, score };
          }
        }
      }
    }
    return best;
  }

  // Pool of remaining words (mutable). We'll also track which are still available.
  const remaining = sorted.slice().filter((_, i) => i !== (seedIdx % sorted.length));

  const tryPlaceFromPool = (dir: "across" | "down"): boolean => {
    let bestIdx = -1;
    let bestScore = -1;
    let bestPos: { row: number; col: number; score: number } | null = null;
    // pick the candidate with the highest intersection score
    for (let i = 0; i < remaining.length; i++) {
      const pos = findPlacement(remaining[i].word, dir);
      if (pos && pos.score > bestScore) {
        bestScore = pos.score;
        bestIdx = i;
        bestPos = pos;
      }
    }
    if (bestIdx === -1 || !bestPos) return false;
    const item = remaining[bestIdx];
    place(item.word, bestPos.row, bestPos.col, dir);
    placed.push({ word: item.word, display: item.display, clue: item.clue, row: bestPos.row, col: bestPos.col, direction: dir, number: 0 });
    if (dir === "across") acrossCount++; else downCount++;
    remaining.splice(bestIdx, 1);
    return true;
  };

  // Phase 1: satisfy exact quotas, alternating to whichever direction is most under quota
  let safety = sorted.length * 6;
  while (safety-- > 0 && (acrossCount < wantedAcross || downCount < wantedDown)) {
    const acrossDeficit = wantedAcross - acrossCount;
    const downDeficit = wantedDown - downCount;
    const order: ("across" | "down")[] = acrossDeficit >= downDeficit ? ["across", "down"] : ["down", "across"];
    let placedOne = false;
    for (const dir of order) {
      const need = dir === "across" ? wantedAcross - acrossCount : wantedDown - downCount;
      if (need <= 0) continue;
      if (tryPlaceFromPool(dir)) { placedOne = true; break; }
    }
    if (!placedOne) break;
  }

  // Phase 2: if we still haven't reached the TOTAL count, fill with whatever direction works
  // (prefer the direction still under quota, but accept either)
  const totalWanted = wantedAcross + wantedDown;
  safety = sorted.length * 4;
  while (safety-- > 0 && placed.length < totalWanted) {
    const acrossUnder = acrossCount < wantedAcross;
    const downUnder = downCount < wantedDown;
    const order: ("across" | "down")[] = acrossUnder && !downUnder ? ["across", "down"]
      : downUnder && !acrossUnder ? ["down", "across"]
      : acrossCount <= downCount ? ["across", "down"] : ["down", "across"];
    let placedOne = false;
    for (const dir of order) {
      if (tryPlaceFromPool(dir)) { placedOne = true; break; }
    }
    if (!placedOne) break;
  }

  return { grid, placed, size: SIZE, acrossCount, downCount };
}

function buildGrid(words: WordItem[], wantedAcross: number, wantedDown: number) {
  const totalWanted = wantedAcross + wantedDown;
  // Try multiple seeds and keep the best result (closest to total wanted, then best balance)
  let best: ReturnType<typeof attemptBuild> | null = null;
  const maxSeeds = Math.min(8, words.length);
  for (let s = 0; s < maxSeeds; s++) {
    const r = attemptBuild(words, wantedAcross, wantedDown, s);
    if (!r) continue;
    if (!best) { best = r; continue; }
    // Prefer the result where placed count is closer to totalWanted
    const bestPlaced = best.placed.length;
    const rPlaced = r.placed.length;
    if (rPlaced > bestPlaced) best = r;
    else if (rPlaced === bestPlaced) {
      // tie-break: better balance with the requested across/down
      const bestErr = Math.abs(best.acrossCount - wantedAcross) + Math.abs(best.downCount - wantedDown);
      const rErr = Math.abs(r.acrossCount - wantedAcross) + Math.abs(r.downCount - wantedDown);
      if (rErr < bestErr) best = r;
    }
    if (best.placed.length >= totalWanted) break;
  }

  if (!best) {
    return { grid: [[]], placed: [], numbered: [], rows: 0, cols: 0 };
  }

  const { grid, placed, size: SIZE } = best;

  // Crop grid to bounding box
  let minR = SIZE, maxR = 0, minC = SIZE, maxC = 0;
  for (const p of placed) {
    minR = Math.min(minR, p.row);
    minC = Math.min(minC, p.col);
    if (p.direction === "across") {
      maxR = Math.max(maxR, p.row);
      maxC = Math.max(maxC, p.col + p.word.length - 1);
    } else {
      maxR = Math.max(maxR, p.row + p.word.length - 1);
      maxC = Math.max(maxC, p.col);
    }
  }
  minR = Math.max(0, minR - 1);
  minC = Math.max(0, minC - 1);
  maxR = Math.min(SIZE - 1, maxR + 1);
  maxC = Math.min(SIZE - 1, maxC + 1);

  const rows = maxR - minR + 1;
  const cols = maxC - minC + 1;
  const cropped: string[][] = Array.from({ length: rows }, () => Array(cols).fill(""));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cropped[r][c] = grid[minR + r][minC + c];
    }
  }
  const adjusted = placed.map((p) => ({ ...p, row: p.row - minR, col: p.col - minC }));

  const numbered: { row: number; col: number; n: number }[] = [];
  let n = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!cropped[r][c]) continue;
      const startsAcross = (c === 0 || !cropped[r][c - 1]) && c + 1 < cols && cropped[r][c + 1];
      const startsDown = (r === 0 || !cropped[r - 1][c]) && r + 1 < rows && cropped[r + 1][c];
      if (startsAcross || startsDown) {
        numbered.push({ row: r, col: c, n });
        n++;
      }
    }
  }
  for (const p of adjusted) {
    const found = numbered.find((x) => x.row === p.row && x.col === p.col);
    if (found) p.number = found.n;
  }

  return { grid: cropped, placed: adjusted, numbered, rows, cols };
}

/** Error con el estado que corresponde, para distinguirlo de un fallo del servidor. */
class ErrorDePeticion extends Error {
  constructor(public estado: number, mensaje: string) { super(mensaje); }
}

/**
 * Lee el cuerpo como JSON. Un cuerpo vacio o mal formado es culpa de quien
 * llama: se responde 400, no 500, para no confundirlo con un fallo real del
 * servidor al revisar los registros.
 */
async function leerJson(req: Request): Promise<Record<string, unknown>> {
  const texto = await req.text();
  if (!texto.trim()) throw new ErrorDePeticion(400, "El cuerpo de la petición está vacío");
  try {
    const datos = JSON.parse(texto);
    if (!datos || typeof datos !== "object" || Array.isArray(datos)) {
      throw new ErrorDePeticion(400, "El cuerpo debe ser un objeto JSON");
    }
    return datos as Record<string, unknown>;
  } catch (e) {
    if (e instanceof ErrorDePeticion) throw e;
    throw new ErrorDePeticion(400, "El cuerpo no es JSON válido");
  }
}


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Todas estas funciones son POST. Un GET devolvia 500 al intentar leer un
  // cuerpo que no existe, y eso ensucia los registros con errores que no son
  // del servidor.
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json", Allow: "POST, OPTIONS" },
    });
  }

  let cobro: Cobro | null = null;
  let idCobrado = "";

  try {
    // Require authenticated caller to prevent abuse of the paid AI gateway
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let idUsuario = "";
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
      idUsuario = data.claims.sub as string;
    }


    // El administrador puede desactivar una cuenta sin borrarla (tarea 10 de
    // la reunion de asesoria). Se comprueba aqui, no solo en la interfaz.
    {
      const { createClient: crearClienteAdmin } = await import("https://esm.sh/@supabase/supabase-js@2");
      const revisor = crearClienteAdmin(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: activo } = await revisor.rpc("es_usuario_activo", { p_id: idUsuario });
      if (activo === false) {
        return new Response(JSON.stringify({ error: "Tu cuenta esta desactivada. Comunicate con el administrador de la plataforma." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { theme, totalWords, acrossCount, downCount, difficulty, pdfContent, desdeDocumento } =
      await leerJson(req);

    /*
     * O hay tema, o hay documento del que sacarlo. Antes el tema era
     * obligatorio siempre, así que quien subía un PDF tenía que inventarse
     * una palabra para poder continuar, y el crucigrama salía sobre esa
     * palabra en vez de sobre su documento.
     */
    const hayDocumento = typeof pdfContent === "string" && pdfContent.trim().length > 0;
    const mandaElDocumento = desdeDocumento === true && hayDocumento;
    const temaLimpio = typeof theme === "string" ? theme.trim() : "";

    if (temaLimpio.length < 2 && !hayDocumento) {
      return new Response(JSON.stringify({
        error: "Indica una temática, o sube un documento para sacarla de él",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const total = Math.max(4, Math.min(20, Number(totalWords) || 10));
    const across = Math.max(1, Math.min(total - 1, Number(acrossCount) || Math.ceil(total / 2)));
    const down = Math.max(1, Math.min(total - across, Number(downCount) || total - across));

    // La clave de OpenAI la administra el panel de administración (tabla platform_settings)
    const { createClient: createAdminClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseAdmin = createAdminClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
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

    const difficultyLabel = difficulty || "medio";
    {
      const { createClient: crearCliente } = await import("https://esm.sh/@supabase/supabase-js@2");
      idCobrado = idUsuario;
      cobro = await cobrarTokens(
        crearCliente(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!),
        idUsuario, "crossword", String(theme).slice(0, 200),
      );
    }

    // Del documento solo se toman los pasajes que hablan del tema del
    // crucigrama: con la cartilla entera las palabras salían de cualquier
    // capítulo, no del que el docente está trabajando.
    //
    // Salvo cuando el documento manda: no hay tema contra el cual elegir, y
    // filtrar por un tema vacío dejaría fuera justo lo que se quiere usar.
    const seleccion = await seleccionarPasajes({
      texto: typeof pdfContent === "string" ? pdfContent : "",
      consulta: mandaElDocumento ? "" : `Tema del crucigrama: ${temaLimpio}`,
      apiKey,
      presupuesto: 8000,
    });

    const sourceContext = seleccion.texto
      ? (mandaElDocumento
          // Encabezado como obligatorio y no como un "basado en": el modelo
          // trata de forma muy distinta un material de referencia y un
          // material del que tiene que salir todo.
          ? `\n\n=== DOCUMENTO FUENTE (OBLIGATORIO) ===\n` +
            `Las palabras y las pistas deben salir DE ESTE DOCUMENTO. El tema es el que trate el documento.\n` +
            `No uses palabras de otros temas.\n\n${seleccion.texto}\n=== FIN DEL DOCUMENTO ===`
          : `\n\nBasado en el siguiente material:\n${seleccion.texto}`)
      : "";

    // Ask the AI for MANY more words than needed so the backtracking algorithm
    // has a large pool to satisfy the exact across/down quotas.
    const poolSize = Math.min(60, total * 3);
    const systemPrompt = `Eres un generador de crucigramas en español. Genera EXACTAMENTE ${poolSize} palabras únicas relacionadas con el tema dado, variadas en longitud (entre 3 y 10 letras es lo ideal). Cada palabra debe ser una sola palabra (sustantivo común o propio), sin espacios, guiones ni tildes en la palabra misma. Usa palabras españolas comunes. Las pistas deben ser definiciones claras y educativas en español, dificultad ${difficultyLabel}. NUNCA incluyas la palabra dentro de su propia pista. Es CRÍTICO devolver al menos ${poolSize} palabras para que el algoritmo pueda armar el crucigrama.`;

    const userPrompt = mandaElDocumento
      ? `${sourceContext}\n\nGenera ${poolSize} palabras con sus pistas para un crucigrama a partir del documento de arriba (necesitamos un pool grande para encontrar combinaciones que se crucen).`
      : `Tema: ${temaLimpio}\nGenera ${poolSize} palabras con sus pistas para un crucigrama (necesitamos un pool grande para encontrar combinaciones que se crucen)${sourceContext}`;

    const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.4-mini",
        max_completion_tokens: 8000,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "submit_words",
            description: "Devuelve la lista de palabras y pistas para el crucigrama.",
            parameters: {
              type: "object",
              properties: {
                words: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      word: { type: "string", description: "Palabra en español, una sola palabra, 3-12 letras" },
                      clue: { type: "string", description: "Pista o definición clara, sin contener la palabra" },
                    },
                    required: ["word", "clue"],
                    additionalProperties: false,
                  },
                },
                // Cuando el crucigrama sale de un documento no hay tema
                // escrito, y el titulo quedaria en "Crucigrama: " a secas.
                // Se le pide al modelo que lo nombre a partir de lo que leyo.
                tema: {
                  type: "string",
                  description:
                    "De que trata el crucigrama, en 2 a 5 palabras. Si viene de un documento, " +
                    "describe el contenido del documento (ej: 'Industrias 4.0').",
                },
              },
              required: ["words", "tema"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "submit_words" } },
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
      if (aiResp.status === 401) {
        return new Response(JSON.stringify({ error: "La API Key de OpenAI no es válida. El administrador debe revisarla en el panel." }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402 || aiResp.status === 403) {
        return new Response(JSON.stringify({ error: "Sin créditos disponibles en la cuenta de OpenAI." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Error del modelo de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No se obtuvieron palabras");
    const parsed = JSON.parse(toolCall.function.arguments);
    const rawWords: { word: string; clue: string }[] = parsed.words || [];

    /*
     * Cómo se llama el crucigrama.
     *
     * Manda lo que escribió el docente. Si no escribió nada —porque subió un
     * documento— vale el nombre que le puso el modelo tras leerlo. Y si
     * tampoco eso, un rótulo antes que dejar el título a medias: el docente
     * puede renombrarlo, pero un "Crucigrama: " colgando no lo puede
     * interpretar nadie.
     */
    const temaFinal =
      temaLimpio || String(parsed.tema ?? "").trim() || "el documento cargado";

    // Normalize and dedupe
    const seen = new Set<string>();
    const items: WordItem[] = [];
    for (const w of rawWords) {
      const norm = normalizeWord(w.word);
      if (norm.length < 3 || norm.length > 12) continue;
      if (seen.has(norm)) continue;
      seen.add(norm);
      items.push({ word: norm, display: w.word.trim(), clue: w.clue.trim() });
    }

    if (items.length < 4) throw new Error("Pocas palabras generadas");

    const result = buildGrid(items, across, down);

    // Drop words that didn't get a number (i.e. weren't placed)
    const placedFinal = result.placed.filter((p) => p.number > 0);

    const acrossClues = placedFinal
      .filter((p) => p.direction === "across")
      .sort((a, b) => a.number - b.number)
      .map((p) => ({ number: p.number, clue: p.clue, word: p.word, display: p.display }));
    const downClues = placedFinal
      .filter((p) => p.direction === "down")
      .sort((a, b) => a.number - b.number)
      .map((p) => ({ number: p.number, clue: p.clue, word: p.word, display: p.display }));

    return new Response(
      JSON.stringify({
        theme: temaFinal,
        difficulty: difficultyLabel,
        rows: result.rows,
        cols: result.cols,
        grid: result.grid,
        numbered: result.numbered,
        placed: placedFinal,
        across: acrossClues,
        down: downClues,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-crossword error:", e);

    if (e instanceof SinTokensError) {
      return new Response(JSON.stringify({ error: e.message, sinTokens: true }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // La generacion fallo: se devuelve lo cobrado. El docente no debe pagar
    // una generacion que no recibio.
    if (cobro && idCobrado) {
      const { createClient: crearCliente } = await import("https://esm.sh/@supabase/supabase-js@2");
      await devolverTokens(
        crearCliente(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!),
        idCobrado, cobro, "crossword",
        e instanceof Error ? e.message : "Error desconocido",
      );
    }

    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: e instanceof ErrorDePeticion ? e.estado : 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
