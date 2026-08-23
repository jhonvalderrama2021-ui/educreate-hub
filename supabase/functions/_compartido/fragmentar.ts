/**
 * Partición de un documento en fragmentos vectorizables.
 *
 * Vive en su propio archivo, sin nada de Deno, para poder probarlo con el
 * resto del proyecto. Si esta función corta mal, el bot responde mal y el
 * fallo es difícil de rastrear: los vectores no se pueden leer a simple
 * vista, así que el error se manifiesta solo como "el bot contesta cosas
 * raras".
 */

/**
 * Un fragmento debe ser lo bastante grande para tener sentido por sí solo y
 * lo bastante pequeño para que cinco de ellos quepan cómodos en el prompt.
 */
export const TAMANO_FRAGMENTO = 1200;

/**
 * El solape evita que una idea partida justo por la mitad se pierda: la
 * frase que cierra un fragmento vuelve a aparecer al inicio del siguiente.
 */
export const SOLAPE = 200;

export function partirEnFragmentos(texto: string): string[] {
  const limpio = String(texto ?? "").replace(/\s+/g, " ").trim();
  if (limpio.length === 0) return [];
  if (limpio.length <= TAMANO_FRAGMENTO) return [limpio];

  const fragmentos: string[] = [];
  let inicio = 0;

  while (inicio < limpio.length) {
    let fin = Math.min(inicio + TAMANO_FRAGMENTO, limpio.length);

    if (fin < limpio.length) {
      // Se busca un corte natural en el último tercio del fragmento. Cortar a
      // la brava en mitad de una palabra degrada el vector y con él la
      // calidad de la búsqueda.
      const desde = inicio + Math.floor(TAMANO_FRAGMENTO * 0.6);
      const ventana = limpio.slice(desde, fin);
      const relativo = Math.max(
        ventana.lastIndexOf(". "),
        ventana.lastIndexOf("? "),
        ventana.lastIndexOf("! "),
      );
      if (relativo > 0) fin = desde + relativo + 1;
    }

    const trozo = limpio.slice(inicio, fin).trim();
    if (trozo) fragmentos.push(trozo);

    if (fin >= limpio.length) break;
    // El +1 garantiza avance aunque el solape sea mayor que lo recorrido:
    // sin él, un corte desafortunado dejaría el bucle girando para siempre.
    inicio = Math.max(fin - SOLAPE, inicio + 1);
  }

  return fragmentos;
}
