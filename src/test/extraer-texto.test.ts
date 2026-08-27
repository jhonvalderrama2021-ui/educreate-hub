import { describe, it, expect } from "vitest";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { extraerTextoDeArchivo, ArchivoNoLegibleError, ACEPTA } from "@/lib/extraer-texto";

/**
 * Leer el documento que sube el docente.
 *
 * El fallo que origina estas pruebas: el Word se "leía" con `file.text()`.
 * Un .docx es un ZIP, así que eso devolvía el binario comprimido convertido
 * a caracteres. El docente veía "Archivo procesado: 48.213 caracteres
 * extraídos", creía que iba bien, y al modelo le llegaba ruido. Un recurso
 * generado sobre ruido se descubre tarde y no se entiende por qué salió mal.
 *
 * Por eso las pruebas usan un .docx CONSTRUIDO DE VERDAD y comprueban que
 * salga el texto que se metió. Con un archivo simulado pasarían igual sin
 * demostrar nada.
 */

/** Un .docx real, armado con la misma librería que usa la exportación. */
async function docxCon(parrafos: string[]): Promise<File> {
  const doc = new Document({
    sections: [{
      children: parrafos.map((t) => new Paragraph({ children: [new TextRun(t)] })),
    }],
  });
  const blob = await Packer.toBlob(doc);
  return new File([blob], "manual.docx", {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

const archivoDeTexto = (contenido: string, nombre = "apuntes.txt") =>
  new File([contenido], nombre, { type: "text/plain" });

describe("leer el documento del docente", () => {
  it("saca el texto de un .docx de verdad", async () => {
    const file = await docxCon([
      "La colmena Langstroth",
      "El espacio abeja mide entre 6 y 9 milimetros.",
      "La varroasis la causa el acaro Varroa destructor.",
    ]);

    const texto = await extraerTextoDeArchivo(file);

    expect(texto).toContain("colmena Langstroth");
    expect(texto).toContain("espacio abeja");
    expect(texto).toContain("Varroa destructor");
  });

  it("no devuelve el marcado XML del documento", async () => {
    const file = await docxCon(["Fotosintesis en plantas C4"]);
    const texto = await extraerTextoDeArchivo(file);

    // Si esto falla, al modelo le estarían llegando etiquetas en vez de texto.
    expect(texto).not.toMatch(/<w:|<\/w:|xmlns/);
    expect(texto.trim()).toBe("Fotosintesis en plantas C4");
  });

  it("separa los párrafos en vez de pegarlos", async () => {
    const file = await docxCon(["Titulo del capitulo", "Primera frase del cuerpo"]);
    const texto = await extraerTextoDeArchivo(file);

    // Pegados darían "capituloPrimera", una palabra que no existe y que el
    // modelo intentaría interpretar.
    expect(texto).not.toContain("capituloPrimera");
    expect(texto.split("\n").filter((l) => l.trim()).length).toBe(2);
  });

  it("avisa cuando el .docx viene vacío en vez de devolver nada", async () => {
    const file = await docxCon([""]);
    await expect(extraerTextoDeArchivo(file)).rejects.toBeInstanceOf(ArchivoNoLegibleError);
  });

  it("rechaza un archivo que dice ser .docx pero no lo es", async () => {
    // Es justo lo que antes pasaba por bueno: contenido ilegible con nombre
    // de Word.
    const falso = new File([new Uint8Array([1, 2, 3, 4, 5])], "trampa.docx");
    await expect(extraerTextoDeArchivo(falso)).rejects.toBeInstanceOf(ArchivoNoLegibleError);
  });

  it("con un .doc antiguo dice qué hacer, no finge que lo lee", async () => {
    const viejo = new File([new Uint8Array([0xd0, 0xcf, 0x11, 0xe0])], "tesis.doc");
    await expect(extraerTextoDeArchivo(viejo)).rejects.toThrow(/\.docx|PDF/i);
  });

  it("lee un .txt tal cual", async () => {
    const texto = await extraerTextoDeArchivo(archivoDeTexto("Ecuaciones cuadraticas"));
    expect(texto).toBe("Ecuaciones cuadraticas");
  });

  it("un .txt vacío avisa en vez de generar sobre nada", async () => {
    await expect(extraerTextoDeArchivo(archivoDeTexto("   "))).rejects
      .toBeInstanceOf(ArchivoNoLegibleError);
  });

  it("un tipo que no se sabe leer se rechaza nombrándolo", async () => {
    const hoja = new File(["x"], "notas.xlsx");
    await expect(extraerTextoDeArchivo(hoja)).rejects.toThrow(/xlsx/);
  });

  it("el selector de archivos ofrece exactamente lo que se sabe leer", () => {
    // Si divergen, el docente puede elegir un archivo que luego se rechaza,
    // o se le esconde uno que sí funcionaría.
    expect(ACEPTA).toBe(".pdf,.docx,.txt");
  });
});
