/**
 * Saca el texto de lo que el docente sube: PDF, Word o texto plano.
 *
 * Antes el Word se "leía" con `file.text()`. Un .docx no es texto: es un ZIP
 * con XML dentro, así que eso devolvía el binario comprimido convertido a
 * caracteres. El docente veía "Archivo procesado: 48.213 caracteres
 * extraídos" y creía que había funcionado, cuando lo que se le mandaba al
 * modelo era basura. Un recurso generado sobre ruido se nota tarde y no se
 * entiende por qué salió mal.
 *
 * Ahora el .docx se descomprime de verdad. El .doc antiguo (Word 97, binario
 * y sin ZIP) no se puede leer así, y se dice en vez de fingir.
 */

/** Extensiones que se saben leer. */
export const EXTENSIONES_ACEPTADAS = [".pdf", ".docx", ".txt"] as const;

/** Para el atributo `accept` del selector de archivos. */
export const ACEPTA = EXTENSIONES_ACEPTADAS.join(",");

export class ArchivoNoLegibleError extends Error {}

const extensionDe = (nombre: string) => nombre.split(".").pop()?.toLowerCase() ?? "";

/**
 * El texto visible de un .docx.
 *
 * El contenido vive en `word/document.xml`. Cada párrafo es un `<w:p>` y el
 * texto suelto va en `<w:t>`. Se convierte cada párrafo en una línea para no
 * pegar frases que en el documento estaban separadas: sin eso, el final de un
 * título se une con el principio del párrafo siguiente y salen palabras que
 * no existen.
 */
async function textoDeDocx(file: File): Promise<string> {
  const { default: JSZip } = await import("jszip");

  let zip;
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer());
  } catch {
    throw new ArchivoNoLegibleError(
      "Ese archivo no se pudo abrir como documento de Word. Si es un .doc antiguo, " +
      "ábrelo en Word y guárdalo como .docx o expórtalo a PDF.",
    );
  }

  const documento = zip.file("word/document.xml");
  if (!documento) {
    throw new ArchivoNoLegibleError(
      "El archivo de Word no trae contenido legible. Prueba a exportarlo a PDF.",
    );
  }

  const xml = await documento.async("string");

  const texto = xml
    // Saltos de línea explícitos dentro de un párrafo
    .replace(/<w:br\s*\/?>/g, "\n")
    // Fin de párrafo → línea nueva
    .replace(/<\/w:p>/g, "\n")
    // Fin de celda de tabla → separador, para que una fila no quede pegada
    .replace(/<\/w:tc>/g, "\t")
    // Fuera el resto del marcado
    .replace(/<[^>]+>/g, "")
    // Entidades XML que quedan sueltas
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    // Tres saltos seguidos o más se quedan en dos: el .docx genera muchos
    // párrafos vacíos y llenarían el presupuesto de texto con nada.
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  if (texto.length < 20) {
    throw new ArchivoNoLegibleError(
      "El documento parece vacío o solo tiene imágenes. Si el texto está escaneado, " +
      "no se puede leer: usa un documento con texto seleccionable.",
    );
  }

  return texto;
}

/**
 * El texto de un archivo subido por el docente.
 *
 * Lanza `ArchivoNoLegibleError` con un mensaje que dice qué hacer, en vez de
 * devolver algo ilegible que pasaría por bueno.
 */
export async function extraerTextoDeArchivo(file: File): Promise<string> {
  const ext = extensionDe(file.name);

  if (ext === "pdf") {
    // Se carga solo cuando hace falta: pdfjs pesa lo suyo y no tiene por qué
    // entrar en el paquete inicial de quien nunca sube un PDF.
    const { extractTextFromPDF } = await import("@/lib/pdf-extract");
    return await extractTextFromPDF(file);
  }

  if (ext === "txt") {
    // Se decodifica como UTF-8 explícitamente en vez de usar file.text():
    // así las tildes y las eñes no dependen de lo que suponga el navegador.
    const t = new TextDecoder("utf-8").decode(await file.arrayBuffer());
    if (!t.trim()) throw new ArchivoNoLegibleError("El archivo de texto está vacío.");
    return t;
  }

  if (ext === "docx") return await textoDeDocx(file);

  if (ext === "doc") {
    // El .doc de Word 97 es un formato binario propio, no un ZIP. Fingir que
    // se lee daría ruido; es preferible pedir el paso de un minuto que
    // ahorra un recurso generado sobre nada.
    throw new ArchivoNoLegibleError(
      "Los archivos .doc antiguos no se pueden leer. Ábrelo en Word y guárdalo " +
      "como .docx, o expórtalo a PDF.",
    );
  }

  throw new ArchivoNoLegibleError(
    `No se pueden leer archivos ${ext ? `.${ext}` : "de ese tipo"}. Sube un PDF, un Word (.docx) o un .txt.`,
  );
}
