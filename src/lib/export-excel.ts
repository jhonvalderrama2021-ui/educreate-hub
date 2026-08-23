/**
 * Generación de archivos Excel presentables.
 *
 * Antes estas descargas eran CSV. Un CSV abre en Excel, sí, pero llega sin
 * formato: columnas del mismo ancho, cabeceras que se pierden al bajar, y las
 * notas tratadas como texto, de modo que ordenar por nota deja el 10 antes
 * que el 2. Para un consolidado de notas que el docente lleva a la reunión de
 * evaluación, eso no sirve.
 *
 * Aquí se produce un `.xlsx` de verdad: cabecera con color, fila fija al
 * desplazarse, filtro por columna, anchos calculados y números tratados como
 * números.
 */

/** Color institucional, el mismo morado de la plataforma. */
const COLOR_CABECERA = "FF6D4AFF";
const COLOR_FILA_ALTERNA = "FFF6F4FF";

export type ValorCelda = string | number | null | undefined;

export interface ColumnaExcel {
  titulo: string;
  /** Ancho en caracteres. Si se omite, se calcula con el contenido. */
  ancho?: number;
  /** Formato de número de Excel, p. ej. "0.0" para las notas. */
  formato?: string;
  alineacion?: "left" | "center" | "right";
}

export interface HojaExcel {
  nombre: string;
  columnas: ColumnaExcel[];
  filas: ValorCelda[][];
  /** Texto que se escribe encima de la tabla, a modo de título. */
  titulo?: string;
  /** Línea pequeña bajo el título: curso, periodo, fecha... */
  subtitulo?: string;
}

/**
 * El nombre de una hoja en Excel no admite : \ / ? * [ ] y se corta en 31
 * caracteres. Si se pasa, Excel abre el archivo como dañado.
 */
function nombreDeHoja(nombre: string): string {
  return (nombre.replace(/[:\\/?*[\]]/g, " ").trim() || "Hoja").slice(0, 31);
}

function anchoDeColumna(columna: ColumnaExcel, filas: ValorCelda[][], indice: number): number {
  if (columna.ancho) return columna.ancho;
  let maximo = columna.titulo.length;
  for (const fila of filas) {
    const largo = String(fila[indice] ?? "").length;
    if (largo > maximo) maximo = largo;
  }
  // Un tope: una columna de 80 caracteres deja la hoja inmanejable, y el
  // texto largo se lee mejor con ajuste de línea que estirando la columna.
  return Math.min(Math.max(maximo + 2, 10), 45);
}

/** Construye el libro y devuelve el Blob, sin descargarlo. Así se puede probar. */
export async function construirExcel(hojas: HojaExcel[]): Promise<Blob> {
  // Carga diferida: exceljs pesa cerca de 1 MB y solo hace falta cuando el
  // docente pulsa descargar, no cada vez que abre la pantalla.
  const ExcelJS = (await import("exceljs")).default;
  const libro = new ExcelJS.Workbook();
  libro.creator = "NexProfe";
  libro.created = new Date();

  for (const hoja of hojas) {
    const h = libro.addWorksheet(nombreDeHoja(hoja.nombre), {
      views: [{ state: "frozen", ySplit: hoja.titulo ? (hoja.subtitulo ? 4 : 3) : 1 }],
    });

    let filaActual = 1;

    if (hoja.titulo) {
      h.mergeCells(filaActual, 1, filaActual, Math.max(1, hoja.columnas.length));
      const celda = h.getCell(filaActual, 1);
      celda.value = hoja.titulo;
      celda.font = { size: 14, bold: true, color: { argb: "FF1F1235" } };
      celda.alignment = { vertical: "middle" };
      h.getRow(filaActual).height = 24;
      filaActual++;

      if (hoja.subtitulo) {
        h.mergeCells(filaActual, 1, filaActual, Math.max(1, hoja.columnas.length));
        const sub = h.getCell(filaActual, 1);
        sub.value = hoja.subtitulo;
        sub.font = { size: 10, color: { argb: "FF6B6B7B" } };
        filaActual++;
      }
      filaActual++; // una fila en blanco antes de la tabla
    }

    const filaCabecera = filaActual;
    const cabecera = h.getRow(filaCabecera);
    hoja.columnas.forEach((c, i) => {
      const celda = cabecera.getCell(i + 1);
      celda.value = c.titulo;
      celda.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_CABECERA } };
      celda.alignment = { vertical: "middle", horizontal: c.alineacion ?? "left", wrapText: true };
      celda.border = { bottom: { style: "thin", color: { argb: "FF4B32C3" } } };
    });
    cabecera.height = 22;
    filaActual++;

    hoja.filas.forEach((fila, indiceFila) => {
      const f = h.getRow(filaActual + indiceFila);
      hoja.columnas.forEach((c, i) => {
        const celda = f.getCell(i + 1);
        celda.value = fila[i] ?? "";
        celda.alignment = {
          vertical: "top",
          horizontal: c.alineacion ?? (typeof fila[i] === "number" ? "right" : "left"),
          wrapText: true,
        };
        if (c.formato) celda.numFmt = c.formato;
        // Bandas alternas: con treinta filas es la diferencia entre seguir
        // una fila con el dedo o perderla a mitad de camino.
        if (indiceFila % 2 === 1) {
          celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_FILA_ALTERNA } };
        }
      });
    });

    hoja.columnas.forEach((c, i) => {
      h.getColumn(i + 1).width = anchoDeColumna(c, hoja.filas, i);
    });

    if (hoja.filas.length > 0) {
      h.autoFilter = {
        from: { row: filaCabecera, column: 1 },
        to: { row: filaCabecera + hoja.filas.length, column: hoja.columnas.length },
      };
    }
  }

  const buffer = await libro.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/** Limpia el nombre para que sirva de archivo en cualquier sistema. */
export function nombreDeArchivo(base: string): string {
  return base
    // Se separan los acentos y se quitan: "Biología" pasa a "Biologia", que
    // es lo que abre sin problemas en cualquier sistema.
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .trim().replace(/\s+/g, "_")
    .slice(0, 80) || "descarga";
}

export async function descargarExcel(base: string, hojas: HojaExcel[]): Promise<void> {
  const blob = await construirExcel(hojas);
  const { saveAs } = await import("file-saver");
  saveAs(blob, `${nombreDeArchivo(base)}.xlsx`);
}
