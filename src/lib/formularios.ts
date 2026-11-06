/**
 * Errores de formulario junto al campo que los causa.
 *
 * Antes la validacion se avisaba con una notificacion flotante que mostraba
 * solo el primer error: el docente leia "El nombre de usuario debe tener al
 * menos 3 caracteres" sin saber cual de los seis campos era, y el aviso
 * desaparecia solo a los pocos segundos. Quien usa lector de pantalla no se
 * enteraba, porque nada conectaba el mensaje con el campo.
 *
 * Aqui el error se guarda por campo, se pinta debajo de el y se enlaza con
 * aria-describedby, que es lo que pide el criterio 3.3.1 de las WCAG.
 */
import type { ZodError } from "zod";

export type ErroresDeCampo = Record<string, string>;

/**
 * Convierte el error de un esquema de Zod en un mapa campo -> mensaje.
 * Si un campo falla por varios motivos se queda el primero, que es el que
 * conviene corregir antes.
 */
export function erroresDeZod(error: ZodError): ErroresDeCampo {
  const mapa: ErroresDeCampo = {};
  for (const problema of error.errors) {
    const campo = String(problema.path[0] ?? "");
    if (campo && !mapa[campo]) mapa[campo] = problema.message;
  }
  return mapa;
}

/**
 * Atributos que marcan un campo como invalido y lo enlazan con su mensaje.
 * Se esparcen sobre el input: `{...propsDeCampo("email", errores)}`.
 */
export function propsDeCampo(nombre: string, errores: ErroresDeCampo) {
  const hayError = Boolean(errores[nombre]);
  return {
    "aria-invalid": hayError || undefined,
    "aria-describedby": hayError ? `${nombre}-error` : undefined,
  };
}

/** Identificador del parrafo de error de un campo, para enlazarlo y pintarlo. */
export const idDelError = (nombre: string) => `${nombre}-error`;

/**
 * Lleva el foco al primer campo con error y lo desplaza a la vista.
 * Sin esto, en el formulario de registro el error puede quedar fuera de
 * pantalla y el docente no ve por que no avanza.
 */
export function enfocarPrimerError(errores: ErroresDeCampo, orden: string[]) {
  const primero = orden.find((campo) => errores[campo]);
  if (!primero) return;
  const elemento = document.getElementById(primero);
  if (elemento) {
    elemento.focus({ preventScroll: true });
    elemento.scrollIntoView({ block: "center", behavior: "smooth" });
  }
}
