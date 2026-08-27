import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

/*
 * jsdom no implementa Blob.arrayBuffer() ni Blob.text(), que en el navegador
 * existen desde hace años. Se rellenan con FileReader, que jsdom sí trae.
 *
 * Hace falta para poder probar la lectura de documentos con archivos DE
 * VERDAD —un .docx armado y comprimido— en vez de con simulaciones. Justo el
 * fallo que originó esas pruebas (leer un .docx como si fuera texto) es de
 * los que un archivo simulado no habría destapado.
 */
const leerComo = (metodo: "readAsArrayBuffer" | "readAsText") =>
  function (this: Blob) {
    return new Promise((resolver, rechazar) => {
      const lector = new FileReader();
      lector.onload = () => resolver(lector.result);
      lector.onerror = () => rechazar(lector.error);
      lector[metodo](this);
    });
  };

if (!Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = leerComo("readAsArrayBuffer") as Blob["arrayBuffer"];
}
if (!Blob.prototype.text) {
  Blob.prototype.text = leerComo("readAsText") as Blob["text"];
}

// Radix usa la API de Pointer Capture, que jsdom no implementa. Sin estos
// stubs cualquier prueba que abra un Select o un menú desplegable falla.
Object.assign(window.HTMLElement.prototype, {
  hasPointerCapture: () => false,
  setPointerCapture: () => {},
  releasePointerCapture: () => {},
  scrollIntoView: () => {},
});
