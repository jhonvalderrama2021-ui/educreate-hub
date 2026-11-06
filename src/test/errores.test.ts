import { describe, it, expect } from "vitest";
import { explicarError, textoDelError } from "@/lib/errores";

/**
 * Traduccion de errores al lenguaje del docente.
 *
 * La lista de chequeo de usabilidad marcaba como incumplidos dos criterios de
 * Nielsen: los mensajes de error mostraban el texto crudo del sistema, a
 * menudo en ingles, y ninguno decia que hacer a continuacion. Un docente que
 * lee "Invalid login credentials" no sabe si se equivoco de contrasena, si su
 * cuenta no existe o si la plataforma esta caida.
 *
 * Lo que estas pruebas protegen no es la redaccion de cada frase, sino tres
 * garantias: que los errores conocidos se reconozcan, que ninguno llegue sin
 * una accion que el usuario pueda ejecutar, y sobre todo que el texto tecnico
 * nunca se filtre a la pantalla. Esa ultima es la que se rompe sola en cuanto
 * alguien agrega un caso nuevo.
 */

const RESPALDO = "No se pudo guardar el curso";

describe("Traducción de errores conocidos", () => {
  it("reconoce las credenciales incorrectas y no repite el texto en inglés", () => {
    const r = explicarError(new Error("Invalid login credentials"), RESPALDO);
    expect(r.titulo).toContain("correo o la contraseña");
    expect(r.titulo.toLowerCase()).not.toContain("invalid");
    expect(r.accion).toBeTruthy();
  });

  it("distingue el correo sin confirmar del error de contraseña", () => {
    const sinConfirmar = explicarError(new Error("Email not confirmed"), RESPALDO);
    const credenciales = explicarError(new Error("Invalid login credentials"), RESPALDO);
    expect(sinConfirmar.titulo).not.toBe(credenciales.titulo);
    expect(sinConfirmar.accion).toMatch(/correo no deseado|bandeja/i);
  });

  it("explica la cuota diaria sin hablar de tokens", () => {
    const r = explicarError(new Error("Límite de uso alcanzado, intenta más tarde."), RESPALDO);
    expect(r.titulo).toMatch(/límite/i);
    expect(r.accion).toBeTruthy();
  });

  it("aclara que la falta de créditos no es culpa del docente", () => {
    const r = explicarError(new Error("Sin créditos disponibles en la cuenta de OpenAI."), RESPALDO);
    expect(r.titulo).not.toMatch(/OpenAI/);
    expect(r.accion).toMatch(/administrador/i);
  });

  it("traduce la violación de unicidad de Postgres por su código", () => {
    const r = explicarError(
      { code: "23505", message: 'duplicate key value violates unique constraint "profiles_username_key"' },
      RESPALDO,
    );
    expect(r.titulo).toMatch(/ya existe/i);
    expect(r.titulo).not.toMatch(/constraint|duplicate key/i);
  });

  it("convierte el fallo de política RLS en una frase comprensible", () => {
    const r = explicarError({ code: "42501", message: "new row violates row-level security policy" }, RESPALDO);
    expect(r.titulo).toMatch(/permiso/i);
    expect(r.titulo).not.toMatch(/row-level|policy/i);
  });

  it("reconoce la caída de red", () => {
    const r = explicarError(new TypeError("Failed to fetch"), RESPALDO);
    expect(r.titulo).toMatch(/conectar/i);
    expect(r.accion).toMatch(/internet/i);
  });

  it("usa el código HTTP cuando el mensaje no dice nada", () => {
    expect(explicarError({ status: 403 }, RESPALDO).titulo).toMatch(/permiso/i);
    expect(explicarError({ status: 429 }, RESPALDO).titulo).toMatch(/demasiados/i);
    expect(explicarError({ status: 413 }, RESPALDO).titulo).toMatch(/pesa demasiado/i);
  });
});

describe("Errores desconocidos", () => {
  it("usa el respaldo cuando no reconoce nada", () => {
    const r = explicarError(new Error("PGRST999 unknown"), RESPALDO);
    expect(r.titulo).toBe(RESPALDO);
    expect(r.accion).toBeTruthy();
  });

  it("aprovecha un mensaje propio que ya venía en español", () => {
    const r = explicarError(new Error("Indica una temática, o sube un documento para sacarla de él"), RESPALDO);
    expect(r.titulo).toMatch(/temática/i);
    expect(r.titulo).not.toBe(RESPALDO);
  });

  it("no deja pasar el texto técnico a la pantalla", () => {
    const tecnicos = [
      "Invalid JSON",
      "Method Not Allowed",
      "Internal Server Error",
      "Cannot read properties of undefined (reading 'id')",
      "x is not a function",
      "PGRST000",
    ];
    for (const t of tecnicos) {
      const r = explicarError(new Error(t), RESPALDO);
      expect(r.titulo, `fugó el mensaje técnico: ${t}`).toBe(RESPALDO);
    }
  });

  it("avisa de un fallo del servidor sin culpar al usuario", () => {
    const r = explicarError({ status: 500, message: "Internal Server Error" }, RESPALDO);
    expect(r.accion).toMatch(/servidor/i);
  });
});

describe("Garantías transversales", () => {
  const casos: unknown[] = [
    new Error("Invalid login credentials"),
    new Error("Email not confirmed"),
    new Error("User already registered"),
    new Error("Failed to fetch"),
    new Error("Límite de uso alcanzado, intenta más tarde."),
    { code: "23505" },
    { code: "23503" },
    { code: "42501" },
    { code: "PGRST116" },
    { status: 403 },
    { status: 429 },
    { status: 500 },
    new Error("algo que nadie previó"),
    null,
    undefined,
    "",
  ];

  it("todo error produce un título y una acción", () => {
    for (const caso of casos) {
      const r = explicarError(caso, RESPALDO);
      expect(r.titulo, `sin título: ${JSON.stringify(caso)}`).toBeTruthy();
      expect(r.accion, `sin acción: ${JSON.stringify(caso)}`).toBeTruthy();
    }
  });

  it("ningún título queda en inglés ni expone jerga", () => {
    const prohibidas = /\b(error|invalid|failed|unauthorized|forbidden|constraint|policy|null|undefined|exception)\b/i;
    for (const caso of casos) {
      const { titulo } = explicarError(caso, RESPALDO);
      expect(titulo, `jerga en: ${titulo}`).not.toMatch(prohibidas);
    }
  });

  it("ninguna acción queda vacía ni es un simple «intenta de nuevo»", () => {
    for (const caso of casos) {
      const { accion } = explicarError(caso, RESPALDO);
      expect(accion!.length).toBeGreaterThan(20);
    }
  });
});

describe("Lectura del error venga como venga", () => {
  it("saca el texto de las formas que usa Supabase", () => {
    expect(textoDelError(new Error("uno"))).toBe("uno");
    expect(textoDelError("dos")).toBe("dos");
    expect(textoDelError({ message: "tres" })).toBe("tres");
    expect(textoDelError({ error_description: "cuatro" })).toBe("cuatro");
    expect(textoDelError({ error: "cinco" })).toBe("cinco");
    expect(textoDelError(null)).toBe("");
    expect(textoDelError({})).toBe("");
  });
});
