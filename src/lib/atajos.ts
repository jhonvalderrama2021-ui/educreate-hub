/**
 * Atajos de teclado de la plataforma.
 *
 * La lista de chequeo marcaba como incumplido el criterio de Nielsen sobre
 * flexibilidad y eficiencia: solo habia atajos dentro del visor de
 * diapositivas y del crucigrama, y en ninguna parte se le decia al usuario
 * que existian. Un atajo que nadie conoce no acelera a nadie.
 *
 * Se eligio el patron "g despues letra" (ir a) en lugar de combinaciones con
 * Alt o Control: esas chocan con los menus del navegador y con las de los
 * lectores de pantalla, mientras que una secuencia de letras sueltas no pisa
 * nada mientras no se este escribiendo.
 */

export type Atajo = {
  /** Como se muestra en la lista de atajos. */
  teclas: string[];
  descripcion: string;
  /** Ruta a la que lleva, si es un atajo de navegacion. */
  destino?: string;
};

export const ATAJOS: Atajo[] = [
  { teclas: ["?"], descripcion: "Mostrar esta lista de atajos" },
  { teclas: ["/"], descripcion: "Ir al buscador de la pantalla" },
  { teclas: ["g", "r"], descripcion: "Ir a Crear recursos", destino: "/resources" },
  { teclas: ["g", "h"], descripcion: "Ir al historial", destino: "/resources/history" },
  { teclas: ["g", "c"], descripcion: "Ir a mis cursos", destino: "/resources/courses" },
  { teclas: ["g", "b"], descripcion: "Ir a mis bots", destino: "/resources/bots" },
  { teclas: ["g", "a"], descripcion: "Ir al centro de ayuda", destino: "/resources/ayuda" },
  { teclas: ["Esc"], descripcion: "Cerrar el cuadro de diálogo abierto" },
];

/** Los que navegan, indexados por la segunda tecla de la secuencia. */
export const DESTINOS: Record<string, string> = Object.fromEntries(
  ATAJOS.filter((a) => a.destino && a.teclas[0] === "g").map((a) => [a.teclas[1], a.destino!]),
);

/**
 * Si el evento ocurre mientras el usuario escribe. Sin esta comprobacion,
 * teclear "g" en el tema de un recurso lo sacaria de la pantalla.
 */
export function estaEscribiendo(destino: EventTarget | null): boolean {
  if (!(destino instanceof HTMLElement)) return false;
  const etiqueta = destino.tagName.toLowerCase();
  if (etiqueta === "input" || etiqueta === "textarea" || etiqueta === "select") return true;
  if (destino.isContentEditable) return true;
  // Los desplegables de Radix marcan su contenido con este atributo y
  // responden a las letras para buscar dentro de la lista.
  return destino.closest('[role="listbox"], [role="dialog"], [role="menu"]') !== null;
}

/** Si el evento trae modificadores, no es uno de nuestros atajos. */
export function tieneModificador(e: KeyboardEvent): boolean {
  return e.ctrlKey || e.metaKey || e.altKey;
}
