/**
 * Memoria de las ultimas busquedas del docente.
 *
 * La lista de chequeo marcaba como incumplido el criterio de Nielsen sobre
 * flexibilidad: los buscadores de la plataforma no ofrecian historial ni
 * sugerencias, asi que cada busqueda habia que escribirla entera otra vez.
 * Un docente que revisa "fracciones" varias veces a la semana la reescribe
 * cada vez.
 *
 * Se guarda en el navegador y no en la base de datos a proposito: es una
 * comodidad local, no un dato del usuario, y asi no viaja ni ocupa espacio
 * en el servidor. El acceso va envuelto en try/catch porque en modo privado
 * o con el almacenamiento bloqueado lanza excepcion, y quedarse sin
 * historial nunca debe impedir buscar.
 */

const MAXIMO = 6;

/** Lee el historial de una clave. Devuelve lista vacia si algo falla. */
export function leerRecientes(clave: string): string[] {
  try {
    const crudo = localStorage.getItem(clave);
    if (!crudo) return [];
    const valor: unknown = JSON.parse(crudo);
    if (!Array.isArray(valor)) return [];
    return valor.filter((v): v is string => typeof v === "string" && v.length > 0).slice(0, MAXIMO);
  } catch {
    return [];
  }
}

/**
 * Agrega una busqueda al principio, sin repetirla y sin pasar del maximo.
 * Devuelve la lista nueva para que la pantalla la use de inmediato.
 */
export function guardarReciente(clave: string, consulta: string): string[] {
  const limpia = consulta.trim();
  if (limpia.length < 2) return leerRecientes(clave);

  const previas = leerRecientes(clave);
  // Se compara sin distinguir mayusculas para no acumular "Fracciones" y
  // "fracciones" como dos entradas distintas.
  const sinRepetir = previas.filter((p) => p.toLowerCase() !== limpia.toLowerCase());
  const nuevas = [limpia, ...sinRepetir].slice(0, MAXIMO);

  try {
    localStorage.setItem(clave, JSON.stringify(nuevas));
  } catch {
    // El almacenamiento lleno o bloqueado no es motivo para fallar.
  }
  return nuevas;
}

/** Borra el historial de una clave. */
export function olvidarRecientes(clave: string): void {
  try {
    localStorage.removeItem(clave);
  } catch {
    // Igual que arriba: si no se puede, no pasa nada.
  }
}
