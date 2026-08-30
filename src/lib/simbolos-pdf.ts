import type jsPDF from "jspdf";

/**
 * Escribir símbolos matemáticos en el PDF sin que se conviertan en basura.
 *
 * Las fuentes estándar de un PDF (Helvetica y compañía) usan la codificación
 * WinAnsi, que NO tiene √ ≠ ≤ ≥ π ∑ → ni los subíndices. jsPDF no avisa: los
 * sustituye por otro carácter y sigue. Comprobado escribiendo un PDF y
 * leyendo sus bytes: "√" salía como los códigos 34 y 26, "π" como 3 y 192.
 *
 * Un examen de matemáticas exportado a PDF perdía la raíz cuadrada, el
 * "distinto de" y el "menor o igual"; química perdía el subíndice, así que
 * H₂O se imprimía roto. En Word no pasa —ahí el Unicode viaja entero—, solo
 * en el PDF.
 *
 * La solución no añade ni un byte al programa: los PDF llevan de serie una
 * fuente **Symbol** con esos glifos, en posiciones propias. Se parte la línea
 * en tramos y cada uno se dibuja con la fuente que le corresponde.
 */

/** Dónde vive cada símbolo dentro de la fuente Symbol. */
const EN_FUENTE_SYMBOL: Record<string, string> = {
  "√": "Ö", "≠": "¹", "≤": "£", "≥": "³",
  "≈": "»", "∞": "¥", "∑": "å", "∏": "Õ",
  "∫": "ò", "∂": "¶", "∆": "D", "∇": "Ñ",
  "→": "®", "←": "¬", "↔": "«", "⇒": "Þ",
  "∈": "Î", "∉": "Ï", "⊂": "Ì", "∪": "È", "∩": "Ç",
  // Ojo: en la fuente Symbol, "por lo tanto" ocupa la posición de la barra
  // invertida, así que va escapada.
  "∅": "Æ", "∴": "\\", "∠": "Ð", "⊥": "^", "·": "×",
  // Griegas: aparecen en matemáticas y física con toda normalidad.
  "α": "a", "β": "b", "γ": "g", "δ": "d", "ε": "e", "θ": "q", "λ": "l",
  "μ": "m", "π": "p", "ρ": "r", "σ": "s", "τ": "t", "φ": "f", "ω": "w",
  "Δ": "D", "Σ": "S", "Ω": "W", "Φ": "F", "Θ": "Q", "Λ": "L", "Π": "P",
};

/** Subíndices y superíndices: se dibujan como dígitos pequeños, movidos. */
const SUBINDICES: Record<string, string> = {
  "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4",
  "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
  "₊": "+", "₋": "-", "₌": "=", "ₙ": "n", "ₓ": "x",
};

/**
 * Superíndices que WinAnsi NO trae. ² ³ ¹ sí los tiene y se dejan en paz:
 * salen mejor con el glifo real de la fuente.
 */
const SUPERINDICES: Record<string, string> = {
  "⁰": "0", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
  "⁺": "+", "⁻": "-", "ⁿ": "n",
};

type Tramo =
  | { tipo: "normal"; texto: string }
  | { tipo: "symbol"; texto: string }
  | { tipo: "sub"; texto: string }
  | { tipo: "sup"; texto: string };

/** Si el texto trae algo que la fuente normal no sabe escribir. */
export function necesitaSimbolos(texto: string): boolean {
  for (const ch of texto) {
    if (EN_FUENTE_SYMBOL[ch] || SUBINDICES[ch] || SUPERINDICES[ch]) return true;
  }
  return false;
}

/** Parte el texto en tramos según con qué fuente hay que dibujar cada uno. */
export function partirEnTramos(texto: string): Tramo[] {
  const tramos: Tramo[] = [];
  let actual: Tramo | null = null;

  const empujar = (tipo: Tramo["tipo"], ch: string) => {
    if (actual && actual.tipo === tipo) actual.texto += ch;
    else { actual = { tipo, texto: ch } as Tramo; tramos.push(actual); }
  };

  for (const ch of texto) {
    if (EN_FUENTE_SYMBOL[ch]) empujar("symbol", EN_FUENTE_SYMBOL[ch]);
    else if (SUBINDICES[ch]) empujar("sub", SUBINDICES[ch]);
    else if (SUPERINDICES[ch]) empujar("sup", SUPERINDICES[ch]);
    else empujar("normal", ch);
  }
  return tramos;
}

/**
 * Escribe una línea que puede llevar símbolos, y devuelve su ancho.
 *
 * Se dibuja tramo a tramo avanzando la posición: es la única forma de mezclar
 * dos fuentes en un renglón. Cuando no hay símbolos se escribe de una sola
 * vez, que es lo habitual y no tiene por qué pagar este rodeo.
 */
export function escribirConSimbolos(
  doc: jsPDF,
  texto: string,
  x: number,
  y: number,
  opciones: { size: number; bold?: boolean },
): number {
  const { size, bold = false } = opciones;
  const normal = bold ? "bold" : "normal";

  if (!necesitaSimbolos(texto)) {
    doc.setFont("helvetica", normal);
    doc.setFontSize(size);
    doc.text(texto, x, y);
    return doc.getTextWidth(texto);
  }

  let cursor = x;
  for (const tramo of partirEnTramos(texto)) {
    if (tramo.tipo === "normal") {
      doc.setFont("helvetica", normal);
      doc.setFontSize(size);
      doc.text(tramo.texto, cursor, y);
      cursor += doc.getTextWidth(tramo.texto);
    } else if (tramo.tipo === "symbol") {
      // La fuente Symbol no tiene negrita; se usa la redonda y no pasa nada:
      // un signo de raíz no se lee distinto por no ir en negrita.
      doc.setFont("symbol", "normal");
      doc.setFontSize(size);
      doc.text(tramo.texto, cursor, y);
      cursor += doc.getTextWidth(tramo.texto);
    } else {
      // Sub y superíndices: dos tercios del tamaño, y desplazados en vertical
      // lo justo para que se lean como tales sin salirse del renglón.
      const pequeno = size * 0.65;
      doc.setFont("helvetica", normal);
      doc.setFontSize(pequeno);
      const dy = tramo.tipo === "sub" ? size * 0.12 : -size * 0.22;
      doc.text(tramo.texto, cursor, y + dy);
      cursor += doc.getTextWidth(tramo.texto);
    }
  }

  doc.setFont("helvetica", normal);
  doc.setFontSize(size);
  return cursor - x;
}

/**
 * Cuánto ocupa el texto ya contando los símbolos.
 *
 * Hace falta para partir en renglones: medir con la fuente normal un texto
 * con símbolos da un ancho equivocado y la línea se sale del margen.
 */
export function anchoConSimbolos(
  doc: jsPDF,
  texto: string,
  opciones: { size: number; bold?: boolean },
): number {
  const { size, bold = false } = opciones;
  const normal = bold ? "bold" : "normal";
  let ancho = 0;

  for (const tramo of partirEnTramos(texto)) {
    if (tramo.tipo === "symbol") doc.setFont("symbol", "normal");
    else doc.setFont("helvetica", normal);
    doc.setFontSize(tramo.tipo === "sub" || tramo.tipo === "sup" ? size * 0.65 : size);
    ancho += doc.getTextWidth(tramo.texto);
  }

  doc.setFont("helvetica", normal);
  doc.setFontSize(size);
  return ancho;
}

/**
 * Parte el texto en renglones que quepan en `maxWidth`, midiendo bien los
 * símbolos. Equivale a `splitTextToSize` pero sin equivocarse con ellos.
 */
export function partirEnRenglones(
  doc: jsPDF,
  texto: string,
  maxWidth: number,
  opciones: { size: number; bold?: boolean },
): string[] {
  if (!necesitaSimbolos(texto)) {
    doc.setFont("helvetica", opciones.bold ? "bold" : "normal");
    doc.setFontSize(opciones.size);
    return doc.splitTextToSize(texto, maxWidth) as string[];
  }

  const renglones: string[] = [];
  for (const parrafo of texto.split("\n")) {
    let linea = "";
    for (const palabra of parrafo.split(" ")) {
      const intento = linea ? `${linea} ${palabra}` : palabra;
      if (anchoConSimbolos(doc, intento, opciones) > maxWidth && linea) {
        renglones.push(linea);
        linea = palabra;
      } else {
        linea = intento;
      }
    }
    renglones.push(linea);
  }
  return renglones;
}
