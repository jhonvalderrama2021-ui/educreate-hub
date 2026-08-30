import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  hallarTextosAjenos, asegurarEspanol, IdiomaIrrecuperableError,
} from "../../supabase/functions/_compartido/idioma";

/**
 * Que el recurso salga entero en español.
 *
 * Un plan de clase salió con el objetivo "Identificar y להשתמש? use verbos
 * esenciales en oraciones sencillas": una palabra en hebreo metida a mitad de
 * la frase. El docente no puede llevar eso al aula.
 *
 * Pedirle al modelo que escriba en español ya estaba en las instrucciones y
 * no bastó, así que hay que revisar lo que devuelve. Lo delicado de una
 * revisión así es el falso positivo: si marca de más, bloquea recursos
 * buenos. Por eso la mitad de estas pruebas son cosas que NO debe marcar.
 */

const PLAN_CONTAMINADO = {
  title: "Los verbos en la oración",
  objective: "Identificar y להשתמש? use verbos esenciales en oraciones sencillas",
  learningGoals: [
    "Reconocer al menos 6 verbos como palabras que expresan acciones.",
    "Completar oraciones con el verbo adecuado según la situación",
  ],
  phases: [{ name: "Inicio", teacherActions: ["Proyectar la lista de verbos"] }],
  _meta: { modelo: "gpt-5.4", proveedor: "OpenAI" },
};

describe("detectar texto en otro alfabeto", () => {
  it("encuentra la palabra en hebreo y dice dónde está", () => {
    const hallados = hallarTextosAjenos(PLAN_CONTAMINADO);
    expect(hallados).toHaveLength(1);
    expect(hallados[0].ruta).toEqual(["objective"]);
    expect(hallados[0].texto).toContain("להשתמש");
  });

  it("busca también dentro de listas y de objetos anidados", () => {
    const hallados = hallarTextosAjenos({
      phases: [{ teacherActions: ["Explicar el 光合作用 de la planta"] }],
    });
    expect(hallados).toHaveLength(1);
    expect(hallados[0].ruta).toEqual(["phases", 0, "teacherActions", 0]);
  });

  it("no revisa _meta: ahí va el modelo y la fecha, no texto para el docente", () => {
    expect(hallarTextosAjenos({ _meta: { nota: "テスト" } })).toEqual([]);
  });

  const noDebeMarcar: [string, unknown][] = [
    ["un plan de clase normal", { objective: "Identificar y usar verbos esenciales" }],
    ["tildes, eñes y signos de apertura", { t: "¿Qué año? La niña compró más champiñones" }],
    // El griego se deja pasar a propósito: marcarlo convertiría cada plan de
    // trigonometría o de física en un falso positivo.
    ["letras griegas de matemáticas", { t: "El área del círculo es π·r², y α + β = 90°" }],
    ["fórmulas y símbolos", { t: "H₂O, 25 °C, ±3, x → y, 40 m²" }],
    // Los prompts de imagen del cuento van en inglés y deben pasar: son para
    // el modelo de imágenes, no para el niño que lee.
    ["inglés en los prompts de imagen", { imagePrompt: "a watercolor bee on a flower" }],
    ["emoji", { t: "Materiales: 📚 cuaderno y ✏️ lápiz" }],
    ["un texto vacío", { t: "" }],
  ];

  for (const [nombre, contenido] of noDebeMarcar) {
    it(`no marca ${nombre}`, () => {
      expect(hallarTextosAjenos(contenido)).toEqual([]);
    });
  }
});

describe("corregir el idioma", () => {
  beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  const respuesta = (textos: string[]) => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: JSON.stringify({ textos }) } }] }),
  });

  it("reescribe solo el texto contaminado y deja el resto intacto", async () => {
    (fetch as any).mockResolvedValue(
      respuesta(["Identificar y usar verbos esenciales en oraciones sencillas"]),
    );

    const plan = JSON.parse(JSON.stringify(PLAN_CONTAMINADO));
    const corregidos = await asegurarEspanol(plan, "clave", "gpt-5.4-mini");

    expect(corregidos).toBe(1);
    expect(plan.objective).toBe("Identificar y usar verbos esenciales en oraciones sencillas");
    // Lo que estaba bien no se toca: regenerar el recurso entero por una
    // palabra le daría al docente algo distinto de lo que vio aparecer.
    expect(plan.learningGoals).toEqual(PLAN_CONTAMINADO.learningGoals);
    expect(plan.phases[0].teacherActions[0]).toBe("Proyectar la lista de verbos");
  });

  it("solo se manda a corregir lo contaminado, no el recurso entero", async () => {
    (fetch as any).mockResolvedValue(respuesta(["Identificar y usar verbos"]));
    await asegurarEspanol(JSON.parse(JSON.stringify(PLAN_CONTAMINADO)), "clave", "gpt-5.4-mini");

    const cuerpo = JSON.parse((fetch as any).mock.calls[0][1].body);
    const enviado = JSON.parse(cuerpo.messages[1].content);
    expect(enviado.textos).toHaveLength(1);
  });

  it("si el recurso ya está en español no gasta una llamada", async () => {
    const limpio = { objective: "Identificar y usar verbos" };
    const corregidos = await asegurarEspanol(limpio, "clave", "gpt-5.4-mini");
    expect(corregidos).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rechaza una corrección que sigue contaminada en vez de darla por buena", async () => {
    // Cambiar un texto ajeno por otro ajeno no arregla nada, y aceptarlo
    // dejaría pasar el fallo justo cuando se creía resuelto.
    (fetch as any).mockResolvedValue(respuesta(["Identificar y להשתמש verbos"]));

    await expect(
      asegurarEspanol(JSON.parse(JSON.stringify(PLAN_CONTAMINADO)), "clave", "gpt-5.4-mini"),
    ).rejects.toBeInstanceOf(IdiomaIrrecuperableError);
  });

  it("si no se puede corregir, avisa que no se cobró en vez de entregar el recurso roto", async () => {
    (fetch as any).mockResolvedValue({ ok: false, status: 500, text: async () => "boom" });

    const plan = JSON.parse(JSON.stringify(PLAN_CONTAMINADO));
    await expect(asegurarEspanol(plan, "clave", "gpt-5.4-mini")).rejects.toThrow(/tokens/i);
    // Y el original no queda a medio arreglar.
    expect(plan.objective).toBe(PLAN_CONTAMINADO.objective);
  });

  it("una corrección con distinta cantidad de textos no se aplica a ciegas", async () => {
    // Emparejar por posición una lista más corta escribiría la corrección de
    // un campo encima de otro: peor que no corregir.
    (fetch as any).mockResolvedValue(respuesta(["uno", "dos"]));
    await expect(
      asegurarEspanol(JSON.parse(JSON.stringify(PLAN_CONTAMINADO)), "clave", "gpt-5.4-mini"),
    ).rejects.toBeInstanceOf(IdiomaIrrecuperableError);
  });

  it("corrige varios textos de una sola vez", async () => {
    const sucio = {
      title: "Verbos y Привет acciones",
      phases: [{ purpose: "Activar saberes 你好 previos" }],
    };
    (fetch as any).mockResolvedValue(
      respuesta(["Verbos y acciones", "Activar saberes previos"]),
    );

    const corregidos = await asegurarEspanol(sucio, "clave", "gpt-5.4-mini");
    expect(corregidos).toBe(2);
    expect(sucio.title).toBe("Verbos y acciones");
    expect(sucio.phases[0].purpose).toBe("Activar saberes previos");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
