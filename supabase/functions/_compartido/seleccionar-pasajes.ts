import { partirEnFragmentos } from "./fragmentar.ts";

/**
 * Selecciona del documento del docente solo los pasajes que tienen que ver
 * con lo que pidió generar.
 *
 * El problema que resuelve: hasta ahora el PDF entero —hasta 150 KB, unos
 * 37.000 tokens— viajaba en cada generación. Si el docente carga la cartilla
 * completa del área y pide un taller sobre fracciones, el modelo tiene que
 * encontrar las tres páginas de fracciones entre cien páginas de todo lo
 * demás. El resultado sale más general de lo que debería, y cada generación
 * cuesta lo que cuesta procesar cien páginas.
 *
 * Con la selección, el documento se parte en fragmentos, se compara cada uno
 * con la petición del docente y solo van los más relacionados. Sale más
 * preciso y además más barato: los embeddings cuestan una fracción de lo que
 * cuesta pasar el documento entero por el modelo de generación.
 */

const MODELO_EMBEDDING = "text-embedding-3-small";
const LOTE = 96;

/**
 * Por debajo de esto no vale la pena seleccionar: el documento ya cabe
 * cómodo en el prompt y elegir solo puede quitar contexto útil.
 */
export const UMBRAL_SELECCION = 12_000;

/**
 * Cuánto texto seleccionado se manda como máximo.
 *
 * Es el mismo número que el umbral, y a propósito: si un documento de 11.000
 * caracteres va entero, no tiene sentido que uno de 200.000 mande 20.000. La
 * regla queda simple de explicar: por debajo de 12.000 va completo, por
 * encima van los 12.000 caracteres más relacionados con lo que se pidió.
 */
export const PRESUPUESTO_POR_DEFECTO = UMBRAL_SELECCION;

/**
 * Dónde se corta, medido sobre el RANGO de parecidos del documento: entra lo
 * que esté en la mitad superior entre el fragmento que menos tiene que ver y
 * el que más.
 *
 * Se mide sobre el rango y no sobre el máximo porque los parecidos reales
 * caen en una banda estrecha: en una cartilla de matemáticas, el capítulo de
 * fracciones puntúa 0,55 y el de álgebra 0,40 frente a una petición sobre
 * fracciones. Cortar en "la mitad del máximo" (0,275) los dejaría pasar a
 * todos; cortar dentro del rango (0,49) separa de verdad.
 */
export const UMBRAL_RELATIVO = 0.6;

export interface ResultadoSeleccion {
  /** El texto a incluir en el prompt. */
  texto: string;
  /** Cómo se obtuvo: útil para explicárselo al docente y para depurar. */
  metodo: "completo" | "seleccion" | "recorte";
  caracteresOriginales: number;
  caracteresUsados: number;
  fragmentosTotales: number;
  fragmentosUsados: number;
}

function productoPunto(a: number[], b: number[]): number {
  let suma = 0;
  for (let i = 0; i < a.length; i++) suma += a[i] * b[i];
  return suma;
}

async function pedirEmbeddings(textos: string[], apiKey: string): Promise<number[][]> {
  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODELO_EMBEDDING, input: textos }),
  });
  if (!r.ok) throw new Error(`OpenAI respondio ${r.status} al vectorizar`);
  const datos = await r.json();
  return datos.data
    .sort((a: any, b: any) => a.index - b.index)
    .map((d: any) => d.embedding as number[]);
}

export async function seleccionarPasajes(opciones: {
  texto: string;
  /** Lo que pidió el docente: tema, asignatura, grado, instrucciones. */
  consulta: string;
  apiKey: string;
  presupuesto?: number;
}): Promise<ResultadoSeleccion> {
  const { texto, consulta, apiKey } = opciones;
  const presupuesto = opciones.presupuesto ?? PRESUPUESTO_POR_DEFECTO;
  const limpio = String(texto ?? "").trim();

  if (limpio.length === 0) {
    return {
      texto: "", metodo: "completo", caracteresOriginales: 0,
      caracteresUsados: 0, fragmentosTotales: 0, fragmentosUsados: 0,
    };
  }

  if (limpio.length <= UMBRAL_SELECCION) {
    return {
      texto: limpio, metodo: "completo",
      caracteresOriginales: limpio.length, caracteresUsados: limpio.length,
      fragmentosTotales: 1, fragmentosUsados: 1,
    };
  }

  /*
   * Sin consulta no hay contra qué comparar, así que no se puede elegir: se
   * toma el principio del documento hasta agotar el presupuesto.
   *
   * Ocurre cuando el docente sube un archivo y no escribe tema: el recurso
   * sale del documento, y no hay tema que sirva de filtro. El principio es
   * la mejor apuesta ciega —un documento suele decir de qué trata en sus
   * primeras páginas— y sobre todo es acotada: antes se devolvía el texto
   * entero, hasta 150 KB, en cada generación.
   */
  if (!consulta.trim()) {
    const recortado = limpio.slice(0, presupuesto);
    return {
      texto: recortado,
      metodo: recortado.length < limpio.length ? "recorte" : "completo",
      caracteresOriginales: limpio.length,
      caracteresUsados: recortado.length,
      fragmentosTotales: 1, fragmentosUsados: 1,
    };
  }

  const fragmentos = partirEnFragmentos(limpio);

  try {
    const [vectorConsulta] = await pedirEmbeddings([consulta.slice(0, 4000)], apiKey);

    const vectores: number[][] = [];
    for (let i = 0; i < fragmentos.length; i += LOTE) {
      vectores.push(...await pedirEmbeddings(fragmentos.slice(i, i + LOTE), apiKey));
    }

    // Los embeddings de OpenAI vienen normalizados, así que el producto punto
    // ya es la similitud del coseno. No hace falta pgvector: son unos cientos
    // de fragmentos que existen solo durante esta petición, y una tabla para
    // eso solo añadiría trabajo de limpieza.
    const puntuados = fragmentos.map((t, i) => ({
      indice: i,
      texto: t,
      similitud: productoPunto(vectorConsulta, vectores[i]),
    }));

    const ordenados = [...puntuados].sort((a, b) => b.similitud - a.similitud);

    // Sin corte, el bucle rellena el presupuesto con lo que sea con tal de
    // gastarlo, y vuelven a colarse los capítulos que no vienen al caso:
    // justo lo que se quería evitar.
    //
    // El corte se calcula sobre el rango del propio documento, no con un
    // número fijo: la escala de parecido depende mucho del texto, y un umbral
    // absoluto que funcione en una cartilla deja fuera todo en otra.
    const mejor = ordenados[0]?.similitud ?? 0;
    const peor = ordenados[ordenados.length - 1]?.similitud ?? 0;
    const rango = mejor - peor;
    // Si todos los fragmentos se parecen igual, no hay nada que distinguir y
    // manda el presupuesto: el documento entero habla del tema.
    const corte = rango > 1e-6 ? peor + rango * UMBRAL_RELATIVO : -Infinity;

    const elegidos: typeof puntuados = [];
    let acumulado = 0;
    for (const f of ordenados) {
      // El primero entra siempre: mandar el documento en blanco sería peor.
      if (elegidos.length > 0 && f.similitud < corte) break;
      if (acumulado + f.texto.length > presupuesto && elegidos.length > 0) break;
      elegidos.push(f);
      acumulado += f.texto.length;
    }

    // Se devuelven en el orden del documento, no por parecido: un plan de área
    // o una cartilla tienen una secuencia, y desordenarla confunde al modelo.
    elegidos.sort((a, b) => a.indice - b.indice);

    const partes: string[] = [];
    let anterior = -1;
    for (const f of elegidos) {
      // Marcar los saltos evita que el modelo lea como continuo lo que no lo
      // es y termine inventando una relación entre dos temas distintos.
      if (anterior >= 0 && f.indice > anterior + 1) partes.push("[...]");
      partes.push(f.texto);
      anterior = f.indice;
    }

    return {
      texto: partes.join("\n\n"),
      metodo: "seleccion",
      caracteresOriginales: limpio.length,
      caracteresUsados: acumulado,
      fragmentosTotales: fragmentos.length,
      fragmentosUsados: elegidos.length,
    };
  } catch (e) {
    // Si la selección falla, se manda el principio del documento, que es lo
    // que se hacía antes. Quedarse sin generar por un fallo al vectorizar
    // sería mucho peor que generar con un poco menos de precisión.
    console.error("No se pudo seleccionar pasajes, se recorta el documento:", e);
    return {
      texto: limpio.slice(0, presupuesto),
      metodo: "recorte",
      caracteresOriginales: limpio.length,
      caracteresUsados: Math.min(limpio.length, presupuesto),
      fragmentosTotales: fragmentos.length,
      fragmentosUsados: 0,
    };
  }
}
