/**
 * Busqueda dentro del centro de ayuda.
 *
 * La lista de chequeo marcaba como incumplido el criterio de Nielsen sobre
 * ayuda y documentacion: la guia existia, pero para encontrar algo habia que
 * recorrer trece secciones desplegables a ojo. Un docente que no sabe como se
 * llama lo que busca ("lo de las preguntas de seleccion multiple") no llega.
 *
 * El contenido de la ayuda ya esta como datos, asi que se puede filtrar sin
 * duplicarlo. La busqueda ignora mayusculas y tildes a proposito: en el aula
 * se escribe "rubrica" y "crucigrama" sin acento mucho mas a menudo que con el.
 */

/** Una opcion dentro de un modulo de la ayuda. */
export interface OpcionAyuda {
  nombre: string;
  cuandoUsar: string;
}

/** Un modulo de la ayuda, tal como lo define la pantalla. */
export interface ModuloAyuda {
  id: string;
  titulo: string;
  paraQue: string;
  campos?: { nombre: string; explicacion: string }[];
  opciones?: { titulo: string; lista: OpcionAyuda[] };
  ejemploMal?: string;
  ejemploBien?: string;
  queObtienes?: string[];
  consejo?: string;
}

/** Una pregunta de la seccion "Si algo no funciona". */
export interface ProblemaAyuda {
  p: string;
  r: string;
}

/**
 * Minusculas y sin tildes, para que "rúbrica" y "rubrica" sean lo mismo.
 * Descomponer en Unicode tambien deshace la ñ (queda "n"), de modo que
 * "nino" encuentra "niño". Es deseable en un buscador: en el teclado del aula
 * la ñ se escribe mal a menudo.
 */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Todo el texto consultable de un modulo, en una sola cadena. */
export function textoDelModulo(m: ModuloAyuda): string {
  const partes: string[] = [m.titulo, m.paraQue];
  if (m.campos) for (const c of m.campos) partes.push(c.nombre, c.explicacion);
  if (m.opciones) {
    partes.push(m.opciones.titulo);
    for (const o of m.opciones.lista) partes.push(o.nombre, o.cuandoUsar);
  }
  if (m.ejemploMal) partes.push(m.ejemploMal);
  if (m.ejemploBien) partes.push(m.ejemploBien);
  if (m.queObtienes) partes.push(...m.queObtienes);
  if (m.consejo) partes.push(m.consejo);
  return normalizar(partes.join(" "));
}

/** Todo el texto consultable de una pregunta frecuente. */
export function textoDelProblema(p: ProblemaAyuda): string {
  return normalizar(`${p.p} ${p.r}`);
}

/**
 * Separa la consulta en palabras y exige que aparezcan todas. Buscar
 * "examen icfes" debe encontrar el modulo de examenes aunque las dos palabras
 * esten lejos una de otra, pero no debe traer todo lo que mencione "examen".
 */
function palabrasDe(consulta: string): string[] {
  return normalizar(consulta).split(/\s+/).filter((p) => p.length > 0);
}

/** Si el texto contiene todas las palabras de la consulta. */
export function coincide(texto: string, consulta: string): boolean {
  const palabras = palabrasDe(consulta);
  if (palabras.length === 0) return true;
  return palabras.every((p) => texto.includes(p));
}

export type ResultadoBusqueda = {
  primerosPasos: ModuloAyuda[];
  modulos: ModuloAyuda[];
  problemas: ProblemaAyuda[];
  /** Cuantos elementos coinciden en total, para anunciarlo al usuario. */
  total: number;
  /** Si hay consulta escrita; con consulta vacia se muestra la ayuda entera. */
  filtrando: boolean;
};

/** Filtra las tres secciones de la ayuda con una misma consulta. */
export function buscarEnAyuda(
  consulta: string,
  primerosPasos: ModuloAyuda[],
  modulos: ModuloAyuda[],
  problemas: ProblemaAyuda[],
): ResultadoBusqueda {
  const limpia = consulta.trim();
  if (limpia.length === 0) {
    return {
      primerosPasos, modulos, problemas,
      total: primerosPasos.length + modulos.length + problemas.length,
      filtrando: false,
    };
  }

  const pp = primerosPasos.filter((m) => coincide(textoDelModulo(m), limpia));
  const mm = modulos.filter((m) => coincide(textoDelModulo(m), limpia));
  const px = problemas.filter((p) => coincide(textoDelProblema(p), limpia));

  return {
    primerosPasos: pp,
    modulos: mm,
    problemas: px,
    total: pp.length + mm.length + px.length,
    filtrando: true,
  };
}
