/**
 * Que el recurso salga entero en español.
 *
 * Un plan de clase salió con el objetivo "Identificar y להשתמש? use verbos
 * esenciales...": una palabra en hebreo metida a mitad de la frase. Pasa de
 * vez en cuando y no hay forma de pedirle al modelo que no lo haga nunca; lo
 * que sí se puede es no dárselo al docente así.
 *
 * El pedir "escribe en español" ya estaba en las instrucciones. No basta: hay
 * que revisar lo que devuelve.
 */

/**
 * En qué idioma va el recurso, según la asignatura.
 *
 * Un recurso para la clase de Inglés va en inglés: es material para que el
 * estudiante lea y practique en ese idioma, no una traducción. Lo mismo con
 * Francés. Exigir español ahí sería romper la clase.
 *
 * El resto de asignaturas van en español, incluidas Programación y Robótica:
 * ahí el inglés aparece solo en las palabras del lenguaje de programación, y
 * eso no lo toca nadie porque va en alfabeto latino.
 */
const IDIOMA_POR_ASIGNATURA: Record<string, string> = {
  "inglés": "inglés",
  "ingles": "inglés",
  "english": "inglés",
  "francés": "francés",
  "frances": "francés",
};

/**
 * El idioma en que debe salir el recurso de esa asignatura.
 *
 * Se comprueba que la clave sea PROPIA del mapa, en vez de confiar en
 * `?? valorPorDefecto`. Un objeto corriente hereda las claves de
 * Object.prototype, así que `IDIOMA_POR_ASIGNATURA["constructor"]` NO es
 * undefined: es una función. El `??` no salta, y esa función acababa metida
 * dentro de las instrucciones que se le mandan al modelo. Basta con que la
 * asignatura venga escrita así.
 */
export function idiomaDeLaAsignatura(asignatura?: string | null): string {
  const clave = String(asignatura ?? "").trim().toLowerCase();
  const suya = Object.prototype.hasOwnProperty.call(IDIOMA_POR_ASIGNATURA, clave);
  return suya ? IDIOMA_POR_ASIGNATURA[clave] : "español de Colombia";
}

/**
 * Escrituras que no tienen nada que hacer en un recurso escolar colombiano.
 *
 * Ni en español ni en inglés ni en francés: las tres se escriben en alfabeto
 * latino, así que la misma comprobación sirve para todas.
 *
 * El griego se deja fuera a propósito: π, α, Δ y compañía aparecen con toda
 * legitimidad en matemáticas y física, y marcarlas convertiría cada plan de
 * clase de trigonometría en un falso positivo. Se persiguen alfabetos
 * enteros ajenos, no símbolos sueltos.
 *
 * Los rangos van en \u y con nombre, no como caracteres pegados: escritos
 * literalmente no hay forma de leerlos ni de comprobar que el rango es el que
 * se cree, y algunos son marcas combinantes que se funden visualmente con el
 * carácter anterior. Un error de un rango aquí se traduce en recursos buenos
 * bloqueados o en basura que pasa de largo, y de ninguna de las dos cosas se
 * enteraría nadie leyendo la línea.
 */
const RANGOS_AJENOS: { nombre: string; desde: number; hasta: number }[] = [
  { nombre: "cirílico", desde: 0x0400, hasta: 0x052f },
  { nombre: "armenio", desde: 0x0530, hasta: 0x058f },
  { nombre: "hebreo", desde: 0x0590, hasta: 0x05ff },
  { nombre: "árabe", desde: 0x0600, hasta: 0x06ff },
  { nombre: "siríaco", desde: 0x0700, hasta: 0x074f },
  { nombre: "árabe (suplemento)", desde: 0x0750, hasta: 0x077f },
  { nombre: "devanagari", desde: 0x0900, hasta: 0x097f },
  { nombre: "bengalí", desde: 0x0980, hasta: 0x09ff },
  { nombre: "tailandés", desde: 0x0e00, hasta: 0x0e7f },
  { nombre: "georgiano", desde: 0x10a0, hasta: 0x10ff },
  { nombre: "hiragana", desde: 0x3040, hasta: 0x309f },
  { nombre: "katakana", desde: 0x30a0, hasta: 0x30ff },
  { nombre: "chino (extensión A)", desde: 0x3400, hasta: 0x4dbf },
  { nombre: "chino", desde: 0x4e00, hasta: 0x9fff },
  { nombre: "hangul", desde: 0xac00, hasta: 0xd7af },
];

const enHex = (n: number) => `\\u${n.toString(16).padStart(4, "0")}`;

const ESCRITURAS_AJENAS = new RegExp(
  `[${RANGOS_AJENOS.map((r) => `${enHex(r.desde)}-${enHex(r.hasta)}`).join("")}]`,
  "u",
);

/** Los alfabetos que se persiguen, con un carácter de muestra de cada uno. */
export const ALFABETOS_VIGILADOS = RANGOS_AJENOS.map((r) => ({
  nombre: r.nombre,
  ejemplo: String.fromCodePoint(r.desde + 1),
}));

/** Un texto del recurso que salió en otro alfabeto, y dónde está. */
export interface TextoAjeno {
  ruta: (string | number)[];
  texto: string;
}

/**
 * Recorre el recurso y devuelve los textos que traen alfabetos ajenos.
 *
 * Se salta `_meta`: ahí van el modelo y la fecha, no texto para el docente.
 */
export function hallarTextosAjenos(valor: unknown, ruta: (string | number)[] = []): TextoAjeno[] {
  if (typeof valor === "string") {
    return ESCRITURAS_AJENAS.test(valor) ? [{ ruta, texto: valor }] : [];
  }
  if (Array.isArray(valor)) {
    return valor.flatMap((v, i) => hallarTextosAjenos(v, [...ruta, i]));
  }
  if (valor && typeof valor === "object") {
    return Object.entries(valor as Record<string, unknown>)
      .filter(([k]) => k !== "_meta")
      .flatMap(([k, v]) => hallarTextosAjenos(v, [...ruta, k]));
  }
  return [];
}

/** Escribe un valor en su sitio dentro del recurso. */
function ponerEn(raiz: any, ruta: (string | number)[], valor: string): void {
  let obj = raiz;
  for (let i = 0; i < ruta.length - 1; i++) obj = obj?.[ruta[i]];
  if (obj) obj[ruta[ruta.length - 1]] = valor;
}

/**
 * Pide al modelo que reescriba en español solo los textos contaminados.
 *
 * Se reescriben ESOS textos y no el recurso entero: es una llamada corta y
 * barata, y sobre todo no cambia nada de lo que ya estaba bien. Regenerar
 * todo por una palabra le daría al docente un recurso distinto del que acaba
 * de ver aparecer.
 */
async function pedirTraduccion(
  apiKey: string,
  textos: string[],
  modelo: string,
  idioma: string,
): Promise<string[]> {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelo,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Corriges textos educativos que salieron con palabras en otro alfabeto por un " +
            "fallo de generación. Devuelve JSON {\"textos\": [...]} con la MISMA cantidad de " +
            "elementos y en el MISMO orden.\n" +
            "REGLAS:\n" +
            `1. El texto va en ${idioma}. Devuélvelo en ${idioma}.\n` +
            "2. Sustituye la palabra ajena por la que corresponda en español según el sentido " +
            "de la frase. No la borres dejando un hueco ni la dejes entre paréntesis.\n" +
            "3. No cambies nada más: ni el sentido, ni el tono, ni la longitud aproximada.\n" +
            "4. Conserva las fórmulas, los símbolos matemáticos y los nombres propios.",
        },
        { role: "user", content: JSON.stringify({ textos }) },
      ],
    }),
  });

  if (!r.ok) throw new Error(`OpenAI respondio ${r.status} al corregir el idioma`);
  const datos = await r.json();
  const salida = JSON.parse(datos.choices[0].message.content);
  const corregidos = Array.isArray(salida?.textos) ? salida.textos : [];
  if (corregidos.length !== textos.length) {
    throw new Error("La correccion de idioma devolvio otra cantidad de textos");
  }
  return corregidos.map((t: unknown) => String(t ?? ""));
}

/** Se lanza cuando el recurso sigue con texto ajeno tras intentar corregirlo. */
export class IdiomaIrrecuperableError extends Error {
  constructor(public readonly muestra: string) {
    super(
      "El recurso salió con texto en otro idioma y no se pudo corregir. " +
      "No se te descontaron tokens: vuelve a generarlo.",
    );
    this.name = "IdiomaIrrecuperableError";
  }
}

/**
 * Deja el recurso en español, corrigiendo lo que haga falta.
 *
 * Modifica el objeto recibido. Devuelve cuántos textos hubo que corregir,
 * que es lo que se anota en `_meta` para poder seguirle el rastro: si un día
 * empieza a pasar a menudo, se verá en los recursos y no en una corazonada.
 *
 * Si tras dos intentos sigue contaminado, lanza. Es preferible que el docente
 * vuelva a generar —sin coste, porque el error devuelve los tokens— a que se
 * lleve al aula un plan de clase con una palabra en hebreo dentro.
 */
export async function asegurarIdioma(
  contenido: any,
  apiKey: string,
  modelo: string,
  idioma = "español de Colombia",
): Promise<number> {
  let corregidos = 0;

  for (let intento = 0; intento < 2; intento++) {
    const ajenos = hallarTextosAjenos(contenido);
    if (ajenos.length === 0) return corregidos;

    let arreglados: string[];
    try {
      arreglados = await pedirTraduccion(apiKey, ajenos.map((a) => a.texto), modelo, idioma);
    } catch (e) {
      console.warn("No se pudo corregir el idioma:", e);
      break;
    }

    ajenos.forEach((a, i) => {
      // Solo se acepta la corrección si de verdad quedó limpia: cambiar un
      // texto ajeno por otro ajeno no arregla nada y el bucle giraría en falso.
      if (arreglados[i] && !ESCRITURAS_AJENAS.test(arreglados[i])) {
        ponerEn(contenido, a.ruta, arreglados[i]);
        corregidos++;
      }
    });
  }

  const quedan = hallarTextosAjenos(contenido);
  if (quedan.length > 0) throw new IdiomaIrrecuperableError(quedan[0].texto.slice(0, 80));

  return corregidos;
}
