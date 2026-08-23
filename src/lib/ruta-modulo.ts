/**
 * A qué módulo pertenece cada tipo de recurso.
 *
 * El asesor pidió poder abrir un recurso guardado y modificarlo, en vez de
 * "volver a crearla". Para eso el historial necesita saber a qué pantalla
 * mandar cada recurso, porque los crucigramas y los cuentos tienen la suya.
 */
export function rutaDelRecurso(tipo: string, id: string): string {
  if (tipo === "crossword") return `/resources/crossword?recurso=${id}`;
  if (tipo === "story") return `/resources/story?recurso=${id}`;
  return `/resources/generate?type=${tipo}&recurso=${id}`;
}
