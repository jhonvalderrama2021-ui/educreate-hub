import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

// Backtracking placement
function buildGrid(words: WordItem[], wantedAcross: number, wantedDown: number) {
  // Sort by length desc to place harder words first
  const sorted = [...words].sort((a, b) => b.word.length - a.word.length);

  const SIZE = Math.max(15, Math.min(25, Math.ceil(Math.max(...sorted.map((w) => w.word.length)) * 1.3) + 4));
  const grid: string[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(""));
  const placed: PlacedWord[] = [];

  function canPlace(word: string, row: number, col: number, dir: "across" | "down"): boolean {
    if (row < 0 || col < 0) return false;
    if (dir === "across" && col + word.length > SIZE) return false;
    if (dir === "down" && row + word.length > SIZE) return false;

    // Cells before/after must be empty
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
        // Adjacent perpendicular cells must be empty (unless this cell intersects)
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

  // Place first word horizontally near center
  const first = sorted[0];
  if (!first) return { grid, placed, size: SIZE };
  const startCol = Math.floor((SIZE - first.word.length) / 2);
  const startRow = Math.floor(SIZE / 2);
  place(first.word, startRow, startCol, "across");
  placed.push({
    word: first.word,
    display: first.display,
    clue: first.clue,
    row: startRow,
    col: startCol,
    direction: "across",
    number: 0,
  });

  let acrossCount = 1;
  let downCount = 0;

  // Try to place each remaining word at all valid intersections
  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    const w = item.word;
    let bestPos: { row: number; col: number; dir: "across" | "down" } | null = null;

    outer: for (let pi = 0; pi < placed.length; pi++) {
      const p = placed[pi];
      for (let pc = 0; pc < p.word.length; pc++) {
        const pLetter = p.word[pc];
        for (let wc = 0; wc < w.length; wc++) {
          if (w[wc] !== pLetter) continue;
          // Determine candidate direction (perpendicular)
          if (p.direction === "across") {
            const row = p.row - wc;
            const col = p.col + pc;
            if (downCount < wantedDown && canPlace(w, row, col, "down")) {
              bestPos = { row, col, dir: "down" };
              break outer;
            }
          } else {
            const row = p.row + pc;
            const col = p.col - wc;
            if (acrossCount < wantedAcross && canPlace(w, row, col, "across")) {
              bestPos = { row, col, dir: "across" };
              break outer;
            }
          }
        }
      }
    }

    if (bestPos) {
      place(w, bestPos.row, bestPos.col, bestPos.dir);
      placed.push({
        word: w,
        display: item.display,
        clue: item.clue,
        row: bestPos.row,
        col: bestPos.col,
        direction: bestPos.dir,
        number: 0,
      });
      if (bestPos.dir === "across") acrossCount++;
      else downCount++;
    }
  }

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
  // Add 1-cell padding
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

  // Number cells: scan row by row; cell is numbered if it starts an across or down word
  const numbered: { row: number; col: number; n: number }[] = [];
  let n = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!cropped[r][c]) continue;
      const startsAcross =
        (c === 0 || !cropped[r][c - 1]) && c + 1 < cols && cropped[r][c + 1];
      const startsDown =
        (r === 0 || !cropped[r - 1][c]) && r + 1 < rows && cropped[r + 1][c];
      if (startsAcross || startsDown) {
        numbered.push({ row: r, col: c, n });
        n++;
      }
    }
  }
  // Assign numbers to placed words by their starting cell
  for (const p of adjusted) {
    const found = numbered.find((x) => x.row === p.row && x.col === p.col);
    if (found) p.number = found.n;
  }

  // Filter out any word that didn't get placed in cropped grid
  return { grid: cropped, placed: adjusted, numbered, rows, cols };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { theme, totalWords, acrossCount, downCount, difficulty, pdfContent } = await req.json();

    if (typeof theme !== "string" || theme.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Tema requerido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const total = Math.max(4, Math.min(20, Number(totalWords) || 10));
    const across = Math.max(1, Math.min(total - 1, Number(acrossCount) || Math.ceil(total / 2)));
    const down = Math.max(1, Math.min(total - across, Number(downCount) || total - across));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY no configurada");

    const difficultyLabel = difficulty || "medio";
    const sourceContext = pdfContent
      ? `\n\nBasado en el siguiente material:\n${String(pdfContent).slice(0, 6000)}`
      : "";

    const systemPrompt = `Eres un generador de crucigramas en español. Genera exactamente ${total} palabras relacionadas con el tema dado. Cada palabra debe ser un sustantivo común o propio (1 sola palabra, sin espacios ni guiones), entre 3 y 12 letras. Usa palabras españolas. Las pistas deben ser definiciones claras y educativas, en español, dificultad ${difficultyLabel}. NUNCA incluyas la palabra dentro de su propia pista.`;

    const userPrompt = `Tema: ${theme}\nGenera ${total} palabras con sus pistas para un crucigrama${sourceContext}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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
              },
              required: ["words"],
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
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos agotados. Agrega fondos en tu workspace de Lovable." }), {
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
        theme,
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
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
