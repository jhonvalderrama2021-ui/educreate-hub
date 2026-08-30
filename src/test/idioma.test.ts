import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  hallarTextosAjenos, asegurarIdioma, idiomaDeLaAsignatura, ALFABETOS_VIGILADOS, IdiomaIrrecuperableError,
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
    const corregidos = await asegurarIdioma(plan, "clave", "gpt-5.4-mini");

    expect(corregidos).toBe(1);
    expect(plan.objective).toBe("Identificar y usar verbos esenciales en oraciones sencillas");
    // Lo que estaba bien no se toca: regenerar el recurso entero por una
    // palabra le daría al docente algo distinto de lo que vio aparecer.
    expect(plan.learningGoals).toEqual(PLAN_CONTAMINADO.learningGoals);
    expect(plan.phases[0].teacherActions[0]).toBe("Proyectar la lista de verbos");
  });

  it("solo se manda a corregir lo contaminado, no el recurso entero", async () => {
    (fetch as any).mockResolvedValue(respuesta(["Identificar y usar verbos"]));
    await asegurarIdioma(JSON.parse(JSON.stringify(PLAN_CONTAMINADO)), "clave", "gpt-5.4-mini");

    const cuerpo = JSON.parse((fetch as any).mock.calls[0][1].body);
    const enviado = JSON.parse(cuerpo.messages[1].content);
    expect(enviado.textos).toHaveLength(1);
  });

  it("si el recurso ya está en español no gasta una llamada", async () => {
    const limpio = { objective: "Identificar y usar verbos" };
    const corregidos = await asegurarIdioma(limpio, "clave", "gpt-5.4-mini");
    expect(corregidos).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rechaza una corrección que sigue contaminada en vez de darla por buena", async () => {
    // Cambiar un texto ajeno por otro ajeno no arregla nada, y aceptarlo
    // dejaría pasar el fallo justo cuando se creía resuelto.
    (fetch as any).mockResolvedValue(respuesta(["Identificar y להשתמש verbos"]));

    await expect(
      asegurarIdioma(JSON.parse(JSON.stringify(PLAN_CONTAMINADO)), "clave", "gpt-5.4-mini"),
    ).rejects.toBeInstanceOf(IdiomaIrrecuperableError);
  });

  it("si no se puede corregir, avisa que no se cobró en vez de entregar el recurso roto", async () => {
    (fetch as any).mockResolvedValue({ ok: false, status: 500, text: async () => "boom" });

    const plan = JSON.parse(JSON.stringify(PLAN_CONTAMINADO));
    await expect(asegurarIdioma(plan, "clave", "gpt-5.4-mini")).rejects.toThrow(/tokens/i);
    // Y el original no queda a medio arreglar.
    expect(plan.objective).toBe(PLAN_CONTAMINADO.objective);
  });

  it("una corrección con distinta cantidad de textos no se aplica a ciegas", async () => {
    // Emparejar por posición una lista más corta escribiría la corrección de
    // un campo encima de otro: peor que no corregir.
    (fetch as any).mockResolvedValue(respuesta(["uno", "dos"]));
    await expect(
      asegurarIdioma(JSON.parse(JSON.stringify(PLAN_CONTAMINADO)), "clave", "gpt-5.4-mini"),
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

    const corregidos = await asegurarIdioma(sucio, "clave", "gpt-5.4-mini");
    expect(corregidos).toBe(2);
    expect(sucio.title).toBe("Verbos y acciones");
    expect(sucio.phases[0].purpose).toBe("Activar saberes previos");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("el idioma lo decide la asignatura", () => {
  /*
   * Al reforzar "escribe todo en español" se rompió la clase de Inglés: un
   * taller de inglés va EN INGLÉS, es material para que el estudiante lea y
   * practique en ese idioma, no una traducción.
   */
  it("un recurso de Inglés va en inglés", () => {
    expect(idiomaDeLaAsignatura("Inglés")).toBe("inglés");
  });

  it("uno de Francés, en francés", () => {
    expect(idiomaDeLaAsignatura("Francés")).toBe("francés");
  });

  it("da igual cómo venga escrito el nombre", () => {
    // El docente puede escribirla a mano en "Otras", sin tilde o en minúscula.
    for (const escrito of ["inglés", "INGLES", " Ingles ", "english"]) {
      expect(idiomaDeLaAsignatura(escrito), escrito).toBe("inglés");
    }
  });

  const enEspanol = [
    "Matemáticas", "Ciencias Naturales", "Lengua Castellana", "Química",
    // Programación y Robótica llevan palabras en inglés del lenguaje de
    // programación, pero el recurso se explica en español.
    "Programación y Computación", "Robótica",
  ];
  for (const asignatura of enEspanol) {
    it(`${asignatura} va en español`, () => {
      expect(idiomaDeLaAsignatura(asignatura)).toBe("español de Colombia");
    });
  }

  it("sin asignatura, español por defecto", () => {
    expect(idiomaDeLaAsignatura(null)).toBe("español de Colombia");
    expect(idiomaDeLaAsignatura(undefined)).toBe("español de Colombia");
    expect(idiomaDeLaAsignatura("")).toBe("español de Colombia");
  });

  it("la comprobación de alfabetos vale igual para inglés y francés", () => {
    // Los tres idiomas usan alfabeto latino, así que una palabra en hebreo
    // sigue siendo un fallo en un taller de inglés.
    expect(hallarTextosAjenos({ t: "Write five sentences using the verb to be" })).toEqual([]);
    expect(hallarTextosAjenos({ t: "Écris cinq phrases avec le verbe être" })).toEqual([]);
    expect(hallarTextosAjenos({ t: "Write five להשתמש sentences" })).toHaveLength(1);
  });
});

describe("cada alfabeto vigilado se detecta de verdad", () => {
  /*
   * Los rangos se escribían como caracteres pegados dentro de la expresión.
   * Así no hay forma de leerlos ni de comprobar que el rango es el que se
   * cree, y algunos son marcas combinantes que se funden con el carácter
   * anterior —el linter lo señalaba—. Un rango mal puesto se traduce en
   * recursos buenos bloqueados, o en basura que pasa de largo, y de ninguna
   * de las dos cosas se entera nadie leyendo la línea.
   *
   * Se recorre la lista y se comprueba uno por uno, en vez de fiarse.
   */
  it("la lista no está vacía ni se quedó a medias", () => {
    expect(ALFABETOS_VIGILADOS.length).toBeGreaterThanOrEqual(15);
  });

  for (const { nombre, ejemplo } of ALFABETOS_VIGILADOS) {
    it(`detecta ${nombre}`, () => {
      const hallados = hallarTextosAjenos({ t: `Texto normal con ${ejemplo} dentro` });
      expect(hallados, `no se detectó ${nombre} (${ejemplo})`).toHaveLength(1);
    });
  }

  it("no se cuela nada del alfabeto latino ni de la puntuación española", () => {
    const español = "áéíóúüñÁÉÍÓÚÜÑ ¿? ¡! «» — … 0123456789 abcXYZ";
    expect(hallarTextosAjenos({ t: español })).toEqual([]);
  });

  it("los símbolos matemáticos y científicos siguen pasando", () => {
    const ciencia = "√49 ≤ x ≠ 0, π·r², ∑ ∫ ∞ ± × ÷ ° H₂O 2⁵ α β Δ Ω → ∈ ∅";
    expect(hallarTextosAjenos({ t: ciencia })).toEqual([]);
  });
});

describe("claves heredadas de Object.prototype", () => {
  /*
   * Un objeto corriente responde a "constructor", "toString" o "valueOf" con
   * lo que hereda de Object.prototype. Así que `MAPA[clave] ?? porDefecto` NO
   * cae en el valor por defecto para esas claves: devuelve una función.
   *
   * Aquí eso significaba que una asignatura llamada "constructor" metía el
   * código fuente de una función dentro de las instrucciones que se le mandan
   * al modelo. Basta con escribirla así en el formulario.
   */
  const heredadas = ["constructor", "toString", "valueOf", "hasOwnProperty", "__proto__"];

  for (const clave of heredadas) {
    it(`"${clave}" cae en español, no en una función heredada`, () => {
      const idioma = idiomaDeLaAsignatura(clave);
      expect(typeof idioma).toBe("string");
      expect(idioma).toBe("español de Colombia");
    });
  }

  it("y las asignaturas de verdad siguen funcionando", () => {
    expect(idiomaDeLaAsignatura("Inglés")).toBe("inglés");
    expect(idiomaDeLaAsignatura("Matemáticas")).toBe("español de Colombia");
  });
});
