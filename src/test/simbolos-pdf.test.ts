import { describe, it, expect } from "vitest";
import jsPDF from "jspdf";
import { construirPdf } from "@/lib/export-resource";
import {
  necesitaSimbolos, partirEnTramos, escribirConSimbolos, partirEnRenglones,
} from "@/lib/simbolos-pdf";

/**
 * Los símbolos matemáticos en el PDF.
 *
 * Las fuentes estándar de un PDF usan la codificación WinAnsi, que no tiene
 * √ ≠ ≤ ≥ π ∑ → ni los subíndices. jsPDF no avisa: los sustituye por otro
 * carácter y sigue. Se comprobó escribiendo un PDF y leyendo sus bytes —"√"
 * salía como los códigos 34 y 26— así que un examen de matemáticas perdía la
 * raíz cuadrada y H₂O se imprimía roto.
 *
 * Estas pruebas leen los BYTES del PDF, no lo que se le pidió escribir: es la
 * única forma de saber qué acabó dentro. Comprobar que no lanza excepción no
 * habría detectado nada, porque el fallo era silencioso.
 */

/** Lo que el PDF escribe de verdad, y con qué fuente. */
function loQueQuedaEnElPdf(escribir: (doc: jsPDF) => void) {
  const doc = new jsPDF();
  escribir(doc);
  const salida = doc.output();
  return {
    // Cada tramo dibujado aparece como (texto) Tj
    tramos: [...salida.matchAll(/\(((?:[^()\\]|\\.)*)\)\s*Tj/g)].map((m) => m[1]),
    usaSymbol: /\/F\d+\s|\/Symbol/.test(salida) && salida.includes("Symbol"),
  };
}

describe("saber cuándo hace falta la fuente de símbolos", () => {
  it("un texto corriente no la necesita", () => {
    expect(necesitaSimbolos("El área del rectángulo es base por altura")).toBe(false);
  });

  const conSimbolo = ["√16", "x ≠ 0", "x ≤ 5", "π · r²", "∑ x", "H₂O", "2⁵", "A → B"];
  for (const t of conSimbolo) {
    it(`la necesita para "${t}"`, () => expect(necesitaSimbolos(t)).toBe(true));
  }

  it("x² no la necesita: ese sí lo tiene la fuente normal", () => {
    // Se deja el glifo real, que se ve mejor que un 2 dibujado más pequeño.
    expect(necesitaSimbolos("x²")).toBe(false);
  });
});

describe("partir el texto en tramos", () => {
  it("separa lo normal de lo simbólico sin perder nada", () => {
    const tramos = partirEnTramos("x ≠ 0");
    expect(tramos.map((t) => t.tipo)).toEqual(["normal", "symbol", "normal"]);
    expect(tramos[0].texto).toBe("x ");
    expect(tramos[2].texto).toBe(" 0");
  });

  it("agrupa los caracteres seguidos del mismo tipo en un solo tramo", () => {
    // Un tramo por carácter multiplicaría las llamadas de dibujo y acumularía
    // error de posición en cada una.
    const tramos = partirEnTramos("abc≤≥def");
    expect(tramos).toHaveLength(3);
    expect(tramos[1].tipo).toBe("symbol");
  });

  it("reconoce el subíndice de una fórmula química", () => {
    const tramos = partirEnTramos("H₂O");
    expect(tramos.map((t) => t.tipo)).toEqual(["normal", "sub", "normal"]);
    expect(tramos[1].texto).toBe("2");
  });
});

describe("lo que acaba escrito en el PDF", () => {
  it("la raíz cuadrada ya no se convierte en basura", () => {
    const { tramos } = loQueQuedaEnElPdf((doc) =>
      escribirConSimbolos(doc, "√16 = 4", 10, 10, { size: 12 }),
    );
    // "Ö" es la posición de la raíz en la fuente Symbol.
    expect(tramos).toContain("Ö");
    expect(tramos.join(" ")).toContain("16 = 4");
  });

  const simbolos: [string, string][] = [
    ["distinto", "¹"],
    ["menor o igual", "£"],
    ["mayor o igual", "³"],
    ["flecha", "®"],
    ["sumatoria", "å"],
  ];
  const textos = ["x ≠ 0", "x ≤ 5", "x ≥ 5", "A → B", "∑ x"];

  simbolos.forEach(([nombre, esperado], i) => {
    it(`${nombre} se escribe con su glifo real`, () => {
      const { tramos } = loQueQuedaEnElPdf((doc) =>
        escribirConSimbolos(doc, textos[i], 10, 10, { size: 12 }),
      );
      expect(tramos).toContain(esperado);
    });
  });

  it("pi se escribe con la letra griega de la fuente Symbol", () => {
    const { tramos } = loQueQuedaEnElPdf((doc) =>
      escribirConSimbolos(doc, "π · r²", 10, 10, { size: 12 }),
    );
    expect(tramos).toContain("p");
  });

  it("H₂O conserva el subíndice como un 2, no como basura", () => {
    const { tramos } = loQueQuedaEnElPdf((doc) =>
      escribirConSimbolos(doc, "H₂O", 10, 10, { size: 12 }),
    );
    expect(tramos).toEqual(["H", "2", "O"]);
  });

  it("un texto sin símbolos se escribe de una sola vez", () => {
    // Lo habitual no debe pagar el rodeo de dibujar tramo a tramo.
    const { tramos } = loQueQuedaEnElPdf((doc) =>
      escribirConSimbolos(doc, "El area del rectangulo", 10, 10, { size: 12 }),
    );
    expect(tramos).toEqual(["El area del rectangulo"]);
  });

  it("devuelve el ancho de lo escrito, para poder seguir en la misma línea", () => {
    const doc = new jsPDF();
    const ancho = escribirConSimbolos(doc, "x ≠ 0", 10, 10, { size: 12 });
    expect(ancho).toBeGreaterThan(0);
  });
});

describe("partir en renglones midiendo bien", () => {
  it("respeta el ancho aunque el texto lleve símbolos", () => {
    const doc = new jsPDF();
    const texto = "Si x ≠ 0 entonces √x está definida y π · x² crece sin límite ".repeat(4);
    const renglones = partirEnRenglones(doc, texto, 100, { size: 11 });

    expect(renglones.length).toBeGreaterThan(1);
    // Medir con la fuente normal daba anchos equivocados y la línea se salía
    // del margen. Se comprueba con margen de holgura por el último espacio.
    doc.setFontSize(11);
    for (const r of renglones) {
      expect(doc.getTextWidth(r)).toBeLessThan(130);
    }
  });

  it("no pierde ninguna palabra al partir", () => {
    const doc = new jsPDF();
    const texto = "La raíz √49 es 7 y además 3 ≤ x ≤ 9 en el intervalo dado";
    const juntas = partirEnRenglones(doc, texto, 60, { size: 11 }).join(" ");
    expect(juntas.replace(/\s+/g, " ")).toBe(texto);
  });
});

describe("un examen de matemáticas exportado entero", () => {
  it("conserva los símbolos de las preguntas y de la hoja de respuestas", async () => {
    const examen = {
      title: "Examen de ecuaciones",
      subject: "Matemáticas",
      questions: [{
        number: 1,
        context: "Se analiza la expresión √(x² - 9) para x ≥ 3.",
        question: "¿Para qué valores está definida si x ≠ 0?",
        options: { A: "x ≤ -3", B: "x ≥ 3", C: "π < x", D: "x ∈ ∅" },
        correct: "B",
        explanation: "Porque x² - 9 ≥ 0 exige |x| ≥ 3.",
      }],
    };

    const blob = await construirPdf("Examen de ecuaciones", "icfes", examen);
    const texto = new TextDecoder("latin1").decode(await blob.arrayBuffer());

    // El PDF debe traer los glifos de la fuente Symbol, no los sustitutos.
    expect(texto).toContain("Symbol");
    // Y sigue siendo un PDF válido.
    expect(texto.startsWith("%PDF-")).toBe(true);
    expect(texto).toContain("%%EOF");
  });
});
