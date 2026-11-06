/**
 * Traduce los errores del sistema al lenguaje del docente.
 *
 * Antes cada pantalla armaba su propio aviso, y en veinticinco sitios se
 * mostraba el texto crudo que devolvia Supabase o la Edge Function, a menudo
 * en ingles: un docente leia "Invalid login credentials" o "duplicate key
 * value violates unique constraint" y no sabia que hacer. Los otros avisos
 * eran genericos ("Error al eliminar") y tampoco decian como seguir.
 *
 * Aqui el error se convierte en dos frases: que paso y que puede hacer quien
 * lo lee. Al estar centralizado, el dia que aparezca un error nuevo se agrega
 * en un solo lugar y todas las pantallas lo heredan.
 */
import { toast } from "sonner";

export type ErrorExplicado = {
  /** Que ocurrio, en una linea y sin tecnicismos. */
  titulo: string;
  /** Que puede hacer el usuario a continuacion. */
  accion?: string;
};

/** Saca el texto del error venga como venga: Error, string, o respuesta de Supabase. */
export function textoDelError(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object") {
    const e = error as Record<string, unknown>;
    for (const campo of ["message", "error_description", "error", "msg", "hint"]) {
      const v = e[campo];
      if (typeof v === "string" && v) return v;
    }
  }
  return "";
}

/** Codigo de PostgREST/Postgres, cuando el error lo trae. */
function codigoDelError(error: unknown): string {
  if (error && typeof error === "object") {
    const c = (error as Record<string, unknown>).code;
    if (typeof c === "string") return c;
    if (typeof c === "number") return String(c);
  }
  return "";
}

/** Codigo HTTP, cuando el error lo trae. */
function estadoDelError(error: unknown): number {
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    for (const campo of ["status", "statusCode"]) {
      const v = e[campo];
      if (typeof v === "number") return v;
    }
  }
  return 0;
}

/**
 * Errores de Postgres por codigo. Son los que llegan al tocar la base de
 * datos directamente y los que mas confunden, porque el texto crudo nombra
 * restricciones internas que el docente no conoce.
 */
const POR_CODIGO: Record<string, ErrorExplicado> = {
  // unique_violation
  "23505": {
    titulo: "Ya existe un registro con esos datos",
    accion: "Cambia el dato que se repite y vuelve a intentarlo.",
  },
  // foreign_key_violation
  "23503": {
    titulo: "No se puede completar porque hay información asociada",
    accion: "Elimina primero lo que depende de este elemento y vuelve a intentarlo.",
  },
  // check_violation
  "23514": {
    titulo: "Alguno de los datos no es válido",
    accion: "Revisa los campos del formulario y corrige el que esté fuera de rango.",
  },
  // not_null_violation
  "23502": {
    titulo: "Falta un dato obligatorio",
    accion: "Completa todos los campos marcados con asterisco.",
  },
  // insufficient_privilege: casi siempre una politica RLS
  "42501": {
    titulo: "No tienes permiso para hacer esto",
    accion: "Si crees que deberías tenerlo, avisa al administrador de la plataforma.",
  },
  // PostgREST: la consulta no devolvio filas
  PGRST116: {
    titulo: "No se encontró lo que buscabas",
    accion: "Puede que se haya eliminado. Vuelve al listado y actualiza la página.",
  },
  // PostgREST: sin permiso de lectura sobre la fila
  PGRST301: {
    titulo: "Tu sesión no es válida",
    accion: "Cierra sesión y vuelve a entrar.",
  },
};

/**
 * Errores reconocidos por su texto. La clave se busca dentro del mensaje en
 * minusculas, de modo que basta un fragmento estable del original.
 */
const POR_TEXTO: Array<[string, ErrorExplicado]> = [
  // ---- Autenticacion ----
  ["invalid login credentials", {
    titulo: "El correo o la contraseña no son correctos",
    accion: "Revisa que no haya espacios de más. Si no la recuerdas, usa «¿Olvidaste tu contraseña?».",
  }],
  ["email not confirmed", {
    titulo: "Todavía no has confirmado tu correo",
    accion: "Busca el mensaje de confirmación en tu bandeja y en la carpeta de correo no deseado.",
  }],
  ["user already registered", {
    titulo: "Ya existe una cuenta con ese correo",
    accion: "Inicia sesión con ese correo, o usa «¿Olvidaste tu contraseña?» si no la recuerdas.",
  }],
  ["already been registered", {
    titulo: "Ya existe una cuenta con ese correo",
    accion: "Inicia sesión con ese correo, o usa «¿Olvidaste tu contraseña?» si no la recuerdas.",
  }],
  ["password should be at least", {
    titulo: "La contraseña es demasiado corta",
    accion: "Usa al menos 6 caracteres.",
  }],
  ["new password should be different", {
    titulo: "La contraseña nueva es igual a la anterior",
    accion: "Escribe una contraseña distinta de la que tenías.",
  }],
  ["unable to validate email address", {
    titulo: "El correo no tiene un formato válido",
    accion: "Revisa que esté completo, con arroba y dominio.",
  }],
  ["token has expired", {
    titulo: "El enlace ya venció",
    accion: "Solicita uno nuevo desde «¿Olvidaste tu contraseña?».",
  }],
  ["invalid or has expired", {
    titulo: "El enlace ya venció o no es válido",
    accion: "Solicita uno nuevo desde «¿Olvidaste tu contraseña?».",
  }],
  ["auth session missing", {
    titulo: "Tu sesión se cerró",
    accion: "Vuelve a iniciar sesión para continuar.",
  }],
  ["jwt expired", {
    titulo: "Tu sesión expiró",
    accion: "Vuelve a iniciar sesión para continuar.",
  }],
  ["for security purposes", {
    titulo: "Debes esperar un momento antes de volver a intentarlo",
    accion: "Por seguridad hay una pausa entre intentos. Espera unos segundos.",
  }],
  ["rate limit", {
    titulo: "Se hicieron demasiados intentos seguidos",
    accion: "Espera unos minutos y vuelve a intentarlo.",
  }],

  // ---- Cuota y servicio de IA ----
  ["límite de uso alcanzado", {
    titulo: "Alcanzaste tu límite de generación por hoy",
    accion: "El límite se renueva mañana. Si necesitas más, pídele al administrador que lo amplíe.",
  }],
  ["límite de solicitudes excedido", {
    titulo: "Se hicieron demasiadas generaciones seguidas",
    accion: "Espera un minuto y vuelve a intentarlo.",
  }],
  ["créditos insuficientes", {
    titulo: "La plataforma se quedó sin créditos de inteligencia artificial",
    accion: "No es un problema de tu cuenta. Avisa al administrador para que los recargue.",
  }],
  ["sin créditos disponibles", {
    titulo: "La plataforma se quedó sin créditos de inteligencia artificial",
    accion: "No es un problema de tu cuenta. Avisa al administrador para que los recargue.",
  }],
  ["api key", {
    titulo: "La plataforma no tiene configurada su clave de inteligencia artificial",
    accion: "No es un problema de tu cuenta. Avisa al administrador.",
  }],
  ["error del modelo de ia", {
    titulo: "La inteligencia artificial no pudo completar el recurso",
    accion: "Vuelve a intentarlo. Si se repite, acorta el tema o reduce el número de preguntas.",
  }],
  ["error del servicio de ia", {
    titulo: "El servicio de inteligencia artificial no respondió",
    accion: "Espera un momento y vuelve a intentarlo.",
  }],

  // ---- Permisos y estado de la cuenta ----
  ["forbidden", {
    titulo: "No tienes acceso a esta función",
    accion: "Si tu cuenta fue desactivada, comunícate con el administrador.",
  }],
  ["no autorizado", {
    titulo: "Tu sesión no es válida",
    accion: "Cierra sesión y vuelve a entrar.",
  }],
  ["sin acceso a este recurso", {
    titulo: "Este recurso no es tuyo",
    accion: "Solo puedes abrir los recursos que tú creaste.",
  }],

  // ---- Documentos ----
  ["muy poco texto", {
    titulo: "El documento no tiene texto suficiente para usarlo como fuente",
    accion: "Puede ser un PDF de imágenes escaneadas. Prueba con un documento de Word o un PDF con texto seleccionable.",
  }],
  ["no se pudo dividir el documento", {
    titulo: "No se pudo procesar el documento",
    accion: "Prueba con un archivo más corto o en otro formato.",
  }],

  // ---- Archivos ----
  ["exceeded the maximum allowed size", {
    titulo: "El archivo pesa demasiado",
    accion: "Comprímelo o sube una versión más liviana.",
  }],
  ["payload too large", {
    titulo: "El archivo pesa demasiado",
    accion: "Comprímelo o sube una versión más liviana.",
  }],

  // ---- Red ----
  ["failed to fetch", {
    titulo: "No se pudo conectar con el servidor",
    accion: "Revisa tu conexión a internet y vuelve a intentarlo.",
  }],
  ["networkerror", {
    titulo: "No se pudo conectar con el servidor",
    accion: "Revisa tu conexión a internet y vuelve a intentarlo.",
  }],
  ["load failed", {
    titulo: "No se pudo conectar con el servidor",
    accion: "Revisa tu conexión a internet y vuelve a intentarlo.",
  }],
  ["timeout", {
    titulo: "El servidor tardó demasiado en responder",
    accion: "Vuelve a intentarlo en un momento.",
  }],
];

/** Textos internos que nunca deben llegar al docente tal cual. */
const TECNICOS = [
  "invalid json", "method not allowed", "error interno", "internal server error",
  "bad request", "unexpected token", "undefined", "null", "nan",
  "cannot read propert", "is not a function", "500", "502", "503",
];

const esTecnico = (texto: string) =>
  TECNICOS.some((t) => texto.includes(t)) || /^[A-Z_]+$/.test(texto.trim());

/**
 * Convierte cualquier error en algo que un docente pueda leer y actuar.
 *
 * @param error   lo que capturo el catch
 * @param respaldo que decir cuando el error no se reconoce; debe describir la
 *                 accion que fallo, por ejemplo "No se pudo guardar el curso"
 */
export function explicarError(error: unknown, respaldo: string): ErrorExplicado {
  const codigo = codigoDelError(error);
  if (codigo && POR_CODIGO[codigo]) return POR_CODIGO[codigo];

  const estado = estadoDelError(error);
  if (estado === 401 || estado === 403) {
    return {
      titulo: "No tienes permiso para hacer esto",
      accion: "Si tu cuenta fue desactivada, comunícate con el administrador.",
    };
  }
  if (estado === 413) {
    return { titulo: "El archivo pesa demasiado", accion: "Comprímelo o sube una versión más liviana." };
  }
  if (estado === 429) {
    return {
      titulo: "Se hicieron demasiados intentos seguidos",
      accion: "Espera unos minutos y vuelve a intentarlo.",
    };
  }

  const texto = textoDelError(error).toLowerCase();
  if (texto) {
    for (const [clave, explicado] of POR_TEXTO) {
      if (texto.includes(clave)) return explicado;
    }
  }

  // Un mensaje ya escrito en espanol y sin jerga se aprovecha: suele venir de
  // una Edge Function propia y explica mejor el caso que cualquier respaldo.
  if (texto && !esTecnico(texto) && /[áéíóúñ¿¡]|[a-z]{4,}\s+[a-z]{2,}/.test(texto) && texto.length < 160) {
    const original = textoDelError(error).trim();
    return {
      titulo: original.charAt(0).toUpperCase() + original.slice(1),
      accion: "Si el problema continúa, vuelve a intentarlo en unos minutos.",
    };
  }

  if (estado >= 500) {
    return {
      titulo: respaldo,
      accion: "El servidor tuvo un problema. Vuelve a intentarlo en unos minutos.",
    };
  }

  return {
    titulo: respaldo,
    accion: "Vuelve a intentarlo. Si el problema continúa, avisa al administrador.",
  };
}

/**
 * Muestra el error ya traducido. Sustituye a `toast.error(e.message)`.
 *
 * @param respaldo describe la accion que fallo, no el error: "No se pudo
 *                 guardar el curso", no "Error".
 */
export function avisarError(error: unknown, respaldo: string, opciones?: { duration?: number }) {
  const { titulo, accion } = explicarError(error, respaldo);
  toast.error(titulo, { description: accion, duration: opciones?.duration ?? 8000 });
}
