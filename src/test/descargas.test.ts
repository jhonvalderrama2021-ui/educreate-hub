import { describe, it, expect, vi } from "vitest";
import { construirDocx, construirPdf } from "@/lib/export-resource";
import { construirExcel, nombreDeArchivo } from "@/lib/export-excel";

/**
 * Validación de los archivos descargables.
 *
 * No basta con que la descarga no lance un error: un DOCX corrupto se
 * descarga igual de bien y solo falla al abrirlo, y para entonces el docente
 * ya está delante de sus estudiantes.
 *
 * Aquí se comprueban los bytes de verdad. Los tres formatos de Office —DOCX,
 * XLSX, PPTX— son archivos ZIP con una estructura concreta dentro; el PDF
 * empieza por una firma reconocible. Si algo de eso falta, el archivo está
 * roto aunque pese lo que debería.
 */

const FIRMA_ZIP = [0x50, 0x4b, 0x03, 0x04]; // "PK\x03\x04"

/**
 * El Blob de jsdom no implementa arrayBuffer(), asi que se lee con FileReader,
 * que es lo que tambien usaria un navegador antiguo.
 */
const bytesDe = (blob: Blob): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(new Uint8Array(lector.result as ArrayBuffer));
    lector.onerror = () => reject(lector.error);
    lector.readAsArrayBuffer(blob);
  });

const esZip = (bytes: Uint8Array) =>
  FIRMA_ZIP.every((b, i) => bytes[i] === b);

/** Busca un nombre de archivo dentro del ZIP sin descomprimirlo entero. */
const zipContiene = (bytes: Uint8Array, nombre: string) => {
  const texto = new TextDecoder("latin1").decode(bytes);
  return texto.includes(nombre);
};

const TALLER = {
  title: "Taller de fracciones",
  subject: "Matemáticas",
  grade: "5",
  methodology: "Aprendizaje Basado en Problemas",
  objective: "Resolver situaciones con fracciones",
  learningGoals: ["Representar fracciones", "Comparar fracciones"],
  duration: "90 minutos",
  materials: ["30 tarjetas", "6 pliegos de papel"],
  activities: [
    {
      number: 1,
      title: "Repartir la pizza",
      duration: "30 minutos",
      purpose: "Activar saberes previos",
      instructions: ["Formar grupos de 4", "Entregar la ficha"],
      questions: ["¿En cuántas partes iguales dividimos?"],
      product: "Tabla con los repartos",
    },
  ],
  evaluation: {
    instrument: "Lista de chequeo",
    criteria: [{ criterion: "Representa fracciones", indicator: "Divide en partes iguales" }],
  },
};

const EXAMEN = {
  title: "Examen de la célula",
  questions: [
    {
      question: "¿Qué organelo produce la energía?",
      options: ["Mitocondria", "Núcleo", "Ribosoma"],
      correct: 0,
      explanation: "La mitocondria produce ATP.",
    },
  ],
};

describe("Descarga en Word", () => {
  it("produce un DOCX válido, no un archivo vacío", async () => {
    const blob = await construirDocx("Taller de fracciones", "workshop", TALLER);
    const bytes = await bytesDe(blob);

    expect(esZip(bytes)).toBe(true);
    expect(bytes.length).toBeGreaterThan(3000);
    // Sin esta entrada Word abre el archivo como dañado
    expect(zipContiene(bytes, "word/document.xml")).toBe(true);
    expect(zipContiene(bytes, "[Content_Types].xml")).toBe(true);
  });

  it("sirve también para un examen", async () => {
    const blob = await construirDocx("Examen de la célula", "icfes", EXAMEN);
    const bytes = await bytesDe(blob);
    expect(esZip(bytes)).toBe(true);
    expect(zipContiene(bytes, "word/document.xml")).toBe(true);
  });

  it("no se cae con un recurso casi vacío", async () => {
    const blob = await construirDocx("Sin contenido", "workshop", { title: "x" });
    expect(esZip(await bytesDe(blob))).toBe(true);
  });
});

describe("Descarga en PDF", () => {
  it("produce un PDF válido con su firma", async () => {
    const blob = await construirPdf("Taller de fracciones", "workshop", TALLER);
    const bytes = await bytesDe(blob);

    // Todo PDF empieza por %PDF-
    const firma = new TextDecoder().decode(bytes.slice(0, 5));
    expect(firma).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(1000);

    // Y termina con el marcador de fin de archivo
    const cola = new TextDecoder("latin1").decode(bytes.slice(-1024));
    expect(cola).toContain("%%EOF");
  });

  it("sirve también para un examen", async () => {
    const blob = await construirPdf("Examen", "icfes", EXAMEN);
    const bytes = await bytesDe(blob);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });
});

describe("Descarga en Excel", () => {
  const HOJA = {
    nombre: "Resumen de notas",
    titulo: "Biología 9 — Consolidado",
    subtitulo: "Generado el 23 de agosto de 2026",
    columnas: [
      { titulo: "Estudiante", ancho: 28 },
      { titulo: "Actividad" },
      { titulo: "Nota", formato: "0.0", alineacion: "right" as const },
    ],
    filas: [
      ["Ana Ruiz", "Examen de la célula", 5],
      ["Luis Gómez", "Examen de la célula", 3],
      ["Pedro Sin Entregas", "(sin entregas)", null],
    ],
  };

  it("produce un XLSX válido que Excel puede abrir", async () => {
    const blob = await construirExcel([HOJA]);
    const bytes = await bytesDe(blob);

    expect(esZip(bytes)).toBe(true);
    expect(bytes.length).toBeGreaterThan(3000);
    expect(zipContiene(bytes, "xl/workbook.xml")).toBe(true);
    expect(zipContiene(bytes, "[Content_Types].xml")).toBe(true);
  });

  it("lleva el tipo MIME que Excel reconoce", async () => {
    const blob = await construirExcel([HOJA]);
    expect(blob.type).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  });

  it("admite varias hojas en un mismo libro", async () => {
    const blob = await construirExcel([
      HOJA,
      { ...HOJA, nombre: "Detalle por pregunta" },
    ]);
    expect(esZip(await bytesDe(blob))).toBe(true);
  });

  it("recorta el nombre de hoja que Excel rechazaría", async () => {
    // Más de 31 caracteres, o con : \ / ? * [ ] , y Excel lo da por dañado
    const blob = await construirExcel([{
      ...HOJA,
      nombre: "Resultados del curso: Biología 9° / grupo A [2026]",
    }]);
    expect(esZip(await bytesDe(blob))).toBe(true);
  });

  it("no se cae con una hoja sin filas", async () => {
    const blob = await construirExcel([{ ...HOJA, filas: [] }]);
    expect(esZip(await bytesDe(blob))).toBe(true);
  });
});

describe("Nombre del archivo descargado", () => {
  it("quita acentos y caracteres que dan problemas", () => {
    expect(nombreDeArchivo("Biología 9° / grupo A")).toBe("Biologia_9_grupo_A");
    expect(nombreDeArchivo("resumen: notas*")).toBe("resumen_notas");
  });

  it("nunca devuelve un nombre vacío", () => {
    expect(nombreDeArchivo("¿?¡!")).toBe("descarga");
    expect(nombreDeArchivo("")).toBe("descarga");
  });

  it("no genera nombres interminables", () => {
    expect(nombreDeArchivo("x".repeat(300)).length).toBeLessThanOrEqual(80);
  });
});
