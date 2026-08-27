/**
 * Quien puede crear que.
 *
 * Un estudiante entra a la plataforma para RESPONDER lo que su docente le
 * puso en el curso, no para fabricar examenes ni planes de clase. Puede en
 * cambio armar diapositivas, un crucigrama, un cuento o un bot: son
 * herramientas de estudio y no dan ninguna ventaja sobre una evaluacion.
 *
 * Esta lista es la unica fuente de verdad del lado del navegador. La copia
 * que manda de verdad esta en supabase/functions/_compartido/permisos.ts,
 * porque ocultar un boton no impide nada: basta abrir la consola y llamar la
 * API a mano. Las dos listas deben decir lo mismo, y hay una prueba que
 * falla si dejan de coincidir.
 */

/** Solo el docente (o el administrador) puede generarlos. */
export const TIPOS_SOLO_DOCENTE = [
  "icfes",
  "quiz",
  "true_false",
  "mixed",
  "workshop",
  "lesson_plan",
  "rubric",
  "guide",
] as const;

/** Los puede generar cualquiera con cuenta. */
export const TIPOS_ABIERTOS = ["slides", "crossword", "story"] as const;

export type TipoRecurso = (typeof TIPOS_SOLO_DOCENTE)[number] | (typeof TIPOS_ABIERTOS)[number];

const SOLO_DOCENTE = new Set<string>(TIPOS_SOLO_DOCENTE);

/** Si este tipo de recurso esta reservado al docente. */
export function esSoloDeDocente(tipo: string | null | undefined): boolean {
  return !!tipo && SOLO_DOCENTE.has(tipo);
}

/**
 * Si la persona puede generar este tipo.
 *
 * `esDocente` ya incluye al administrador: asi lo devuelve useUserRole.
 */
export function puedeGenerar(tipo: string | null | undefined, esDocente: boolean): boolean {
  return esDocente || !esSoloDeDocente(tipo);
}

/** Nombre en español, para poder explicarle a la persona por que no puede. */
export const NOMBRE_DEL_TIPO: Record<string, string> = {
  icfes: "Exámenes",
  quiz: "Cuestionarios",
  true_false: "Exámenes de falso y verdadero",
  mixed: "Exámenes mixtos",
  workshop: "Talleres",
  lesson_plan: "Planes de clase",
  rubric: "Rúbricas",
  guide: "Guías",
  slides: "Diapositivas",
  crossword: "Crucigramas",
  story: "Cuentos",
};
