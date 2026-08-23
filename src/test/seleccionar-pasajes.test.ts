import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  seleccionarPasajes, UMBRAL_SELECCION,
} from "../../supabase/functions/_compartido/seleccionar-pasajes";

/**
 * Selección de pasajes del PDF que carga el docente en cada módulo.
 *
 * El problema: hasta ahora el documento entero —hasta 150 KB— viajaba en cada
 * generación. Si el docente carga la cartilla completa del área y pide un
 * taller de fracciones, el modelo tiene que encontrar esas tres páginas entre
 * cien, y el recurso sale más general de lo que debería.
 *
 * Lo que estas pruebas protegen:
 *  - que un documento corto siga yendo completo (seleccionar solo podría
 *    quitarle contexto útil, y encima costaría una llamada de más)
 *  - que los pasajes elegidos vuelvan en el ORDEN DEL DOCUMENTO: una cartilla
 *    tiene una secuencia, y desordenarla confunde al modelo
 *  - que un fallo al vectorizar NO impida generar el recurso
 */

const PARRAFOS = {
  fracciones: "Las fracciones representan partes de un todo. El numerador indica cuántas partes se toman y el denominador en cuántas partes se dividió la unidad. Para sumar fracciones con distinto denominador hay que hallar el mínimo común múltiplo. ",
  geometria: "Los polígonos son figuras planas cerradas formadas por segmentos de recta. El área de un triángulo se calcula multiplicando la base por la altura y dividiendo entre dos. La circunferencia es el contorno del círculo. ",
  estadistica: "La media aritmética se obtiene sumando todos los valores y dividiendo entre la cantidad de datos. La moda es el valor que más se repite en un conjunto. La mediana es el valor central al ordenar los datos. ",
};

/** Un documento largo con tres temas separados, para ver cuál se elige. */
function documentoLargo(): string {
  return [
    PARRAFOS.geometria.repeat(30),
    PARRAFOS.fracciones.repeat(30),
    PARRAFOS.estadistica.repeat(30),
  ].join(" ");
}

/**
 * Se simula la respuesta de OpenAI: cada texto se convierte en un vector de
 * tres dimensiones según de qué tema hable. Así la prueba comprueba la lógica
 * de selección sin depender de la red ni gastar en llamadas reales.
 */
function simularEmbeddings() {
  return vi.fn(async (url: string, opciones: any) => {
    const cuerpo = JSON.parse(opciones.body);
    const entradas: string[] = Array.isArray(cuerpo.input) ? cuerpo.input : [cuerpo.input];

    const vector = (t: string) => {
      const texto = t.toLowerCase();
      const v = [
        /fracci|numerador|denominador/.test(texto) ? 1 : 0,
        /pol[ií]gono|tri[áa]ngulo|circunferencia|geometr/.test(texto) ? 1 : 0,
        /media|moda|mediana|estad[íi]stic/.test(texto) ? 1 : 0,
      ];
      const norma = Math.hypot(...v) || 1;
      return v.map((x) => x / norma);
    };

    return {
      ok: true,
      json: async () => ({
        data: entradas.map((t, index) => ({ index, embedding: vector(t) })),
      }),
    } as any;
  });
}

describe("Selección de pasajes del documento", () => {
  beforeEach(() => { vi.stubGlobal("fetch", simularEmbeddings()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("manda completo un documento corto, sin vectorizar nada", async () => {
    const texto = PARRAFOS.fracciones.repeat(3);
    expect(texto.length).toBeLessThan(UMBRAL_SELECCION);

    const r = await seleccionarPasajes({ texto, consulta: "Tema: geometría", apiKey: "x" });

    expect(r.metodo).toBe("completo");
    expect(r.texto).toBe(texto.trim());
    // Ni una llamada: seleccionar aquí solo quitaría contexto y costaría más
    expect(fetch).not.toHaveBeenCalled();
  });

  it("de un documento largo elige los pasajes del tema pedido", async () => {
    const r = await seleccionarPasajes({
      texto: documentoLargo(),
      consulta: "Tema: suma de fracciones. Asignatura: Matemáticas. Grado: 5",
      apiKey: "x",
      presupuesto: 4000,
    });

    expect(r.metodo).toBe("seleccion");
    expect(r.texto).toContain("numerador");
    // Lo que no viene al caso se queda fuera: eso es lo que gana precisión
    expect(r.texto).not.toContain("circunferencia");
    expect(r.texto).not.toContain("mediana");
    expect(r.caracteresUsados).toBeLessThan(r.caracteresOriginales);
  });

  it("cambia de pasajes si cambia lo que pide el docente", async () => {
    const texto = documentoLargo();

    const geo = await seleccionarPasajes({
      texto, consulta: "Tema: área del triángulo", apiKey: "x", presupuesto: 4000,
    });
    const est = await seleccionarPasajes({
      texto, consulta: "Tema: media, moda y mediana", apiKey: "x", presupuesto: 4000,
    });

    expect(geo.texto).toContain("triángulo");
    expect(geo.texto).not.toContain("numerador");
    expect(est.texto).toContain("mediana");
    expect(est.texto).not.toContain("numerador");
  });

  it("devuelve los pasajes en el orden del documento, no por parecido", async () => {
    // El tema pedido aparece al principio y al final, separado por otro:
    // los pasajes elegidos no son contiguos.
    const texto = [
      PARRAFOS.fracciones.repeat(12),
      PARRAFOS.geometria.repeat(45),
      PARRAFOS.fracciones.repeat(12),
    ].join(" ");
    expect(texto.length).toBeGreaterThan(UMBRAL_SELECCION);

    const r = await seleccionarPasajes({
      texto, consulta: "Tema: fracciones", apiKey: "x", presupuesto: 8000,
    });

    // Se marcan los saltos: sin la marca el modelo leería como continuo lo
    // que en el documento está separado por otro tema.
    expect(r.texto).toContain("[...]");
    expect(r.fragmentosUsados).toBeGreaterThan(1);
  });

  it("respeta el presupuesto de caracteres", async () => {
    const r = await seleccionarPasajes({
      texto: documentoLargo(), consulta: "Tema: fracciones", apiKey: "x", presupuesto: 3000,
    });
    expect(r.caracteresUsados).toBeLessThanOrEqual(3000);
  });

  it("nunca devuelve vacío, aunque el presupuesto sea ridículo", async () => {
    // Antes que mandar el documento en blanco, va al menos un fragmento
    const r = await seleccionarPasajes({
      texto: documentoLargo(), consulta: "Tema: fracciones", apiKey: "x", presupuesto: 10,
    });
    expect(r.texto.length).toBeGreaterThan(0);
    expect(r.fragmentosUsados).toBe(1);
  });

  it("si falla la vectorización recorta, pero no impide generar", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, text: async () => "caida" })));

    const texto = documentoLargo();
    const r = await seleccionarPasajes({
      texto, consulta: "Tema: fracciones", apiKey: "x", presupuesto: 5000,
    });

    expect(r.metodo).toBe("recorte");
    expect(r.texto.length).toBe(5000);
    // Quedarse sin generar por un fallo al vectorizar sería mucho peor que
    // generar con un poco menos de precisión.
    expect(r.texto).toContain("polígonos");
  });

  it("sin consulta manda el documento completo: no hay con qué comparar", async () => {
    const r = await seleccionarPasajes({
      texto: documentoLargo(), consulta: "   ", apiKey: "x",
    });
    expect(r.metodo).toBe("completo");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("no se cae con un documento vacío", async () => {
    const r = await seleccionarPasajes({ texto: "", consulta: "Tema: algo", apiKey: "x" });
    expect(r.texto).toBe("");
    expect(r.caracteresOriginales).toBe(0);
  });
});
