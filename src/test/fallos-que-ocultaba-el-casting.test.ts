import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Regresión de dos fallos que solo aparecieron al regenerar los tipos de
 * Supabase y quitar los `(supabase as any)`.
 *
 * Los dos rompían en ejecución y ninguna prueba los veía, porque el casting
 * apagaba al comprobador de tipos y `vite build` no comprueba tipos: usa
 * esbuild, que solo transpila. El proyecto no tenía ninguna barrera de tipos.
 *
 * Se comprueban leyendo el archivo y no ejecutando el componente porque son
 * fallos de forma —un import que falta, un método que no existe— y montar
 * media aplicación para verlos costaría más de lo que aporta.
 */

const leer = (ruta: string) => readFileSync(ruta, "utf8");

describe("Fallos que ocultaba el casting a any", () => {
  it("el módulo de Cuentos importa useEffect antes de usarlo", () => {
    // Usaba useEffect sin importarlo: abrir Cuentos lanzaba un ReferenceError
    // y la pantalla quedaba en blanco.
    const fuente = leer("src/pages/resources/Story.tsx");
    expect(fuente).toContain("useEffect");
    expect(fuente).toMatch(/import \{[^}]*useEffect[^}]*\} from "react"/);
  });

  it("todos los módulos que usan useEffect lo importan", () => {
    const modulos = [
      "src/pages/resources/Story.tsx",
      "src/pages/resources/Crossword.tsx",
      "src/pages/resources/GenerateResource.tsx",
      "src/pages/resources/BotList.tsx",
      "src/components/HistorialModulo.tsx",
      "src/components/GestorDocumentosBot.tsx",
    ];
    for (const m of modulos) {
      const fuente = leer(m);
      if (!/\buseEffect\(/.test(fuente)) continue;
      expect(fuente, `${m} usa useEffect sin importarlo`)
        .toMatch(/import \{[^}]*useEffect[^}]*\} from "react"/);
    }
  });

  it("el latido de auditoría no encadena .catch sobre una consulta", () => {
    // El constructor de consultas de Supabase solo implementa `then`. Encadenar
    // .catch lanzaba un TypeError en cada latido y la tabla `accesos` se
    // quedaba vacía sin que nadie lo notara.
    const fuente = leer("src/hooks/useRegistroAcceso.ts");
    expect(fuente).not.toMatch(/\.rpc\([^)]*\)\.catch/);
    expect(fuente).toContain("try {");
  });

  it("no queda ningún .catch encadenado a una consulta de Supabase", () => {
    const sospechosos = [
      "src/hooks/useRegistroAcceso.ts",
      "src/hooks/useAuth.tsx",
      "src/hooks/useCatalogo.ts",
      "src/components/HistorialModulo.tsx",
      "src/pages/resources/GenerateResource.tsx",
    ];
    for (const s of sospechosos) {
      expect(leer(s), `${s} encadena .catch a una consulta`)
        .not.toMatch(/supabase[\s\S]{0,120}?\)\s*\.catch\(/);
    }
  });

  it("Mis datos consulta mini_courses por teacher_id, no por user_id", () => {
    // mini_courses guarda al docente en teacher_id. Un ayudante genérico
    // suponía user_id en las cuatro tablas, así que la página de habeas data
    // informaba cero cursos y no los exportaba, en silencio.
    const fuente = leer("src/pages/MisDatos.tsx");
    expect(fuente).toMatch(/from\("mini_courses"\)[\s\S]{0,80}?eq\("teacher_id"/);
    expect(fuente).not.toMatch(/from\("mini_courses"\)[\s\S]{0,80}?eq\("user_id"/);
  });

  it("la comprobación de tipos apunta al proyecto que sí incluye src", () => {
    // `tsc --noEmit` a secas no comprobaba nada: tsconfig.json tiene
    // "files": [] y solo referencia a los subproyectos.
    const raiz = JSON.parse(leer("tsconfig.json"));
    expect(raiz.files).toEqual([]);

    const paquete = JSON.parse(leer("package.json"));
    expect(paquete.scripts.typecheck).toContain("tsconfig.app.json");
    // Y la compilación debe pasar por ahí: vite no comprueba tipos
    expect(paquete.scripts.build).toContain("typecheck");
  });

  it("no quedan castings (supabase as any) que apaguen al comprobador", () => {
    const fuente = leer("src/pages/courses/CourseDetailTeacher.tsx");
    expect(fuente).not.toContain("supabase as any");
  });
});
