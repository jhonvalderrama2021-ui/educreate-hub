/**
 * Lectura de lo que respondió un estudiante en un examen del curso.
 *
 * La Edge Function `course-exam` guarda en `resource_submissions.feedback` el
 * detalle de la calificación (qué marcó, cuál era la correcta, si acertó),
 * pero NO el enunciado ni el texto de las opciones: eso vive en el recurso
 * generado. Para que el docente vea "lo que hizo el estudiante" hay que
 * cruzar ambas cosas, y para cruzarlas hay que interpretar el JSON del
 * recurso igual que lo hace la función.
 *
 * Por eso estas funciones replican las de `supabase/functions/course-exam`.
 * Si allí cambia la forma de leer una pregunta, aquí también debe cambiar,
 * o el informe mostrará una respuesta distinta de la que se calificó.
 */

export interface OpcionExamen {
  label: string;
  text: string;
}

export interface PreguntaRevisada {
  numero: number;
  enunciado: string;
  contexto: string;
  opciones: OpcionExamen[];
  /** Índice que marcó el estudiante, o -1 si dejó la pregunta en blanco. */
  marcada: number;
  /** Índice de la correcta, o -1 si el recurso no la trae. */
  correcta: number;
  acerto: boolean;
  explicacion: string;
}

export function normalizarPreguntas(contenido: any): any[] {
  if (!contenido) return [];
  if (Array.isArray(contenido)) return contenido;
  if (Array.isArray(contenido.questions)) return contenido.questions;
  if (Array.isArray(contenido.preguntas)) return contenido.preguntas;
  if (Array.isArray(contenido.items)) return contenido.items;
  return [];
}

export function esVerdaderoFalso(q: any): boolean {
  const t = String(q?.type || "").toLowerCase();
  if (t === "true_false" || t === "verdadero_falso" || t === "vf" || t === "boolean") return true;
  const c = q?.correct ?? q?.correcta ?? q?.respuesta_correcta;
  const opciones = q?.options ?? q?.opciones;
  const pareceVF = typeof c === "boolean" || /^(verdadero|falso|true|false|v|f)$/i.test(String(c ?? ""));
  const sinOpciones =
    !opciones ||
    (Array.isArray(opciones) && opciones.length === 0) ||
    (typeof opciones === "object" && Object.keys(opciones).length === 0);
  return pareceVF && sinOpciones;
}

export function opcionesDe(q: any): OpcionExamen[] {
  if (esVerdaderoFalso(q)) {
    return [{ label: "V", text: "Verdadero" }, { label: "F", text: "Falso" }];
  }
  const raw: any = q?.options ?? q?.opciones ?? [];
  if (Array.isArray(raw)) {
    return raw.map((o, i) => ({
      label: String.fromCharCode(65 + i),
      text: typeof o === "string" ? o : o?.text ?? o?.label ?? String(o),
    }));
  }
  if (raw && typeof raw === "object") {
    return Object.entries(raw).map(([k, v]: [string, any]) => ({
      label: String(k).toUpperCase(),
      text: typeof v === "string" ? v : v?.text ?? v?.label ?? String(v),
    }));
  }
  return [];
}

export function indiceCorrecto(q: any, opciones: OpcionExamen[]): number {
  const c = q?.correct ?? q?.correcta ?? q?.respuesta_correcta;
  if (c === undefined || c === null) return -1;
  if (esVerdaderoFalso(q)) {
    const s = String(c).toLowerCase().trim();
    if (s === "true" || s === "verdadero" || s === "v" || c === true) return 0;
    if (s === "false" || s === "falso" || s === "f" || c === false) return 1;
    return -1;
  }
  if (typeof c === "number") return c;
  const s = String(c).trim();
  const porEtiqueta = opciones.findIndex((p) => p.label.toLowerCase() === s.toLowerCase());
  if (porEtiqueta >= 0) return porEtiqueta;
  const porTexto = opciones.findIndex((p) => p.text.trim().toLowerCase() === s.toLowerCase());
  if (porTexto >= 0) return porTexto;
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? -1 : n;
}

export const enunciadoDe = (q: any): string => q?.text || q?.question || q?.enunciado || "";
export const contextoDe = (q: any): string => q?.context || q?.contexto || "";
export const explicacionDe = (q: any): string =>
  q?.feedback || q?.retroalimentacion || q?.explanation || q?.explicacion || "";

/**
 * Cruza el recurso original con la entrega del estudiante.
 *
 * Se prefiere siempre lo que quedó guardado en `feedback`: es el resultado
 * real de la calificación. Si el docente edita el examen después, recalcular
 * desde el contenido daría una nota distinta de la que vio el estudiante.
 * El contenido solo aporta los textos, que no afectan la calificación.
 */
export function revisarEntrega(contenido: any, entrega: any): PreguntaRevisada[] {
  const preguntas = normalizarPreguntas(contenido);
  const detalle: any[] = Array.isArray(entrega?.feedback) ? entrega.feedback : [];
  const respuestas = entrega?.answers ?? {};

  // Si el examen se borró o cambió de tamaño, mandan las entradas del detalle:
  // no se puede mostrar menos de lo que se calificó.
  const total = Math.max(preguntas.length, detalle.length);

  return Array.from({ length: total }, (_, i) => {
    const q = preguntas[i];
    const d = detalle.find((x) => Number(x?.i) === i);
    const opciones = q ? opcionesDe(q) : [];
    const marcadaCruda = d?.userIdx ?? respuestas?.[i] ?? respuestas?.[String(i)] ?? -1;
    const marcada = Number(marcadaCruda);
    const correcta = d ? Number(d.correctIdx ?? -1) : q ? indiceCorrecto(q, opciones) : -1;

    return {
      numero: i + 1,
      enunciado: q ? enunciadoDe(q) : "Pregunta no disponible (el examen cambió o se eliminó)",
      contexto: q ? contextoDe(q) : "",
      opciones: opciones.length ? opciones : d?.correctText ? [{ label: "", text: d.correctText }] : [],
      marcada: Number.isNaN(marcada) ? -1 : marcada,
      correcta: Number.isNaN(correcta) ? -1 : correcta,
      acerto: d ? Boolean(d.ok) : marcada >= 0 && marcada === correcta,
      explicacion: d?.explanation || (q ? explicacionDe(q) : ""),
    };
  });
}

/** Nota sobre 5,0, la escala del sistema educativo colombiano. */
export function notaColombiana(aciertos: number | null, total: number | null): string {
  if (aciertos === null || !total) return "—";
  return ((aciertos / total) * 5).toFixed(1);
}

export function formatearDuracion(segundos: number | null | undefined): string {
  if (!segundos && segundos !== 0) return "—";
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  // La auditoría acumula horas: "300m 0s" no se lee. Los segundos sobran a
  // partir de una hora, y a partir de un minuto siguen siendo útiles porque
  // un examen puede durar dos minutos y medio.
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/** Iniciales para el avatar del estudiante. */
export function iniciales(nombre: string | null | undefined): string {
  const partes = String(nombre || "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}
