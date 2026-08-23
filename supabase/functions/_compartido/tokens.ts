/**
 * Cobro de tokens de generación.
 *
 * Se cobra ANTES de llamar a OpenAI y se devuelve si la generación falla.
 * Al revés —cobrar al terminar— dejaría disparar veinte peticiones a la vez
 * antes de que la primera descontara nada, y el tope no serviría de nada.
 *
 * Vive en el servidor porque es lo único que no se puede saltar: un contador
 * en el navegador se manipula abriendo la consola.
 */

export interface Cobro {
  /** Cuántos tokens se descontaron. 0 si el recurso es gratuito. */
  cobrado: number;
  /** Cuántos le quedan a la persona después del cobro. */
  disponibles: number;
}

export class SinTokensError extends Error {
  constructor(public necesarios: number, public disponibles: number) {
    super(
      `No te alcanzan los tokens: esta generación cuesta ${necesarios} y te ` +
      `quedan ${disponibles}. Se recargan mañana, o pídele al administrador ` +
      `que te amplíe el cupo.`,
    );
    this.name = "SinTokensError";
  }
}

/** Descuenta el costo del recurso. Lanza SinTokensError si no alcanza. */
export async function cobrarTokens(
  admin: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> },
  userId: string,
  recurso: string,
  detalle?: string,
): Promise<Cobro> {
  const { data, error } = await admin.rpc("consumir_tokens", {
    p_user: userId,
    p_recurso: recurso,
    p_detalle: detalle ?? null,
  });

  if (error) {
    // La función señala la falta de saldo con un mensaje reconocible en vez
    // de un código propio: SINTOKENS:<necesarios>:<disponibles>
    const mensaje = String((error as { message?: string }).message ?? "");
    const m = mensaje.match(/SIN_TOKENS:(\d+):(\d+)/);
    if (m) throw new SinTokensError(Number(m[1]), Number(m[2]));
    throw new Error(mensaje || "No se pudo verificar tus tokens");
  }

  const fila = Array.isArray(data) ? data[0] : data;
  return {
    cobrado: Number((fila as { cobrado?: number })?.cobrado ?? 0),
    disponibles: Number((fila as { disponibles?: number })?.disponibles ?? 0),
  };
}

/**
 * Devuelve lo cobrado cuando la generación falla.
 *
 * Nunca lanza: si la devolución falla, el error real es el de la generación y
 * es el que tiene que llegar al docente. Se registra para poder revisarlo.
 */
export async function devolverTokens(
  admin: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: unknown }> },
  userId: string,
  cobro: Cobro | null,
  recurso: string,
  motivo: string,
): Promise<void> {
  if (!cobro || cobro.cobrado <= 0) return;
  try {
    await admin.rpc("devolver_tokens", {
      p_user: userId,
      p_tokens: cobro.cobrado,
      p_recurso: recurso,
      p_detalle: motivo.slice(0, 300),
    });
  } catch (e) {
    console.error("No se pudieron devolver los tokens:", e);
  }
}
