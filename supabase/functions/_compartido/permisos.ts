/**
 * Quien puede generar que. La copia que manda.
 *
 * El navegador tiene la misma lista en src/lib/permisos.ts para saber que
 * botones pintar, pero esa no protege nada: quien abra la consola puede
 * llamar la API directamente. Se comprobo con un estudiante de verdad y
 * genero un examen completo, con sus respuestas. Esta es la comprobacion
 * que lo impide.
 *
 * Si se agrega un tipo nuevo hay que tocar las dos listas. Una prueba falla
 * si dejan de coincidir, para que el olvido no pase de largo.
 */

/** Solo el docente (o el administrador) puede generarlos. */
export const TIPOS_SOLO_DOCENTE = new Set([
  "icfes",
  "quiz",
  "true_false",
  "mixed",
  "workshop",
  "lesson_plan",
  "rubric",
  "guide",
]);

const NOMBRE: Record<string, string> = {
  icfes: "exámenes",
  quiz: "cuestionarios",
  true_false: "exámenes de falso y verdadero",
  mixed: "exámenes mixtos",
  workshop: "talleres",
  lesson_plan: "planes de clase",
  rubric: "rúbricas",
  guide: "guías",
};

/** Se lanza cuando alguien pide un recurso que su rol no le permite. */
export class SinPermisoError extends Error {
  constructor(public readonly tipo: string) {
    super(
      `Solo los docentes pueden generar ${NOMBRE[tipo] ?? "este tipo de recurso"}. ` +
      `Si eres docente y ves este mensaje, pídele al administrador que revise tu rol.`,
    );
    this.name = "SinPermisoError";
  }
}

/**
 * Comprueba contra la base de datos que quien pide pueda generar este tipo.
 *
 * Se consulta el rol en cada llamada en vez de confiar en lo que venga en la
 * peticion: el JWT lo arma el cliente y el rol no viaja firmado en el.
 *
 * `cliente` debe ser el de service_role, porque user_roles no es legible por
 * su propio dueño desde el navegador.
 */
export async function exigirPermisoDeGeneracion(
  cliente: { from: (t: string) => any },
  idUsuario: string,
  tipo: string,
): Promise<void> {
  if (!TIPOS_SOLO_DOCENTE.has(tipo)) return;

  const { data, error } = await cliente
    .from("user_roles")
    .select("role")
    .eq("user_id", idUsuario);

  // Ante un fallo al leer los roles se niega el paso. Dejar pasar seria
  // convertir una caida de la base en una puerta abierta.
  if (error) throw new SinPermisoError(tipo);

  const roles = (data ?? []).map((r: { role: string }) => r.role);
  const esDocente = roles.includes("docente") || roles.includes("admin");
  if (!esDocente) throw new SinPermisoError(tipo);
}
