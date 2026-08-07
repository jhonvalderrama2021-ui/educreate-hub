import * as pdfjsLib from 'pdfjs-dist';

// El worker se empaqueta con la aplicación en lugar de descargarse de un CDN:
// depender de unpkg.com hacía que la extracción fallara sin conexión o con
// conectividad intermitente, justo el escenario de las instituciones rurales.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).href;

/** Error con mensaje accionable para el docente. */
export class PdfSinTextoError extends Error {
  constructor(paginas: number) {
    super(
      `No se pudo extraer texto del PDF (${paginas} ${paginas === 1 ? "página" : "páginas"}). ` +
      `Probablemente es un documento escaneado o una imagen: el texto no se puede seleccionar ni copiar. ` +
      `Usa un PDF con texto seleccionable, o copia el contenido y pégalo en las instrucciones.`,
    );
    this.name = "PdfSinTextoError";
  }
}

export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const partes: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    try {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => (typeof item.str === "string" ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (pageText) partes.push(pageText);
    } catch (e) {
      // Una página ilegible no debe invalidar el resto del documento
      console.warn(`No se pudo leer la página ${i} del PDF:`, e);
    }
  }

  const texto = partes.join("\n\n").trim();

  // Antes se devolvía "" en silencio: el recurso se generaba ignorando el
  // documento y el docente no entendía por qué el resultado no tenía relación.
  if (!texto) throw new PdfSinTextoError(pdf.numPages);

  return texto;
}
