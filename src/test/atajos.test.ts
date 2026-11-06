import { describe, it, expect, beforeEach, vi } from "vitest";
import { ATAJOS, DESTINOS, estaEscribiendo, tieneModificador } from "@/lib/atajos";
import { leerRecientes, guardarReciente, olvidarRecientes } from "@/lib/busquedas-recientes";

/**
 * Atajos de teclado y memoria de busquedas.
 *
 * El riesgo real de un atajo de una sola letra es que se dispare mientras el
 * docente escribe: teclear "g" en el tema de un recurso no puede sacarlo de
 * la pantalla y hacerle perder lo escrito. Esa es la garantia que mas importa
 * aqui, por encima de que el atajo funcione.
 */

describe("Cuándo NO deben dispararse los atajos", () => {
  const elemento = (html: string): HTMLElement => {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.firstElementChild as HTMLElement;
  };

  it("no se disparan mientras se escribe en un campo", () => {
    expect(estaEscribiendo(elemento("<input />"))).toBe(true);
    expect(estaEscribiendo(elemento("<textarea></textarea>"))).toBe(true);
    expect(estaEscribiendo(elemento("<select></select>"))).toBe(true);
  });

  it("no se disparan dentro de un desplegable o un diálogo", () => {
    const lista = elemento('<div role="listbox"><span>opción</span></div>');
    expect(estaEscribiendo(lista.querySelector("span"))).toBe(true);

    const dialogo = elemento('<div role="dialog"><button>aceptar</button></div>');
    expect(estaEscribiendo(dialogo.querySelector("button"))).toBe(true);
  });

  it("sí se disparan sobre el contenido normal de la página", () => {
    expect(estaEscribiendo(elemento("<p>texto</p>"))).toBe(false);
    expect(estaEscribiendo(elemento("<button>botón</button>"))).toBe(false);
    expect(estaEscribiendo(null)).toBe(false);
  });

  it("no se disparan si hay Control, Alt o Command", () => {
    const con = (extra: Partial<KeyboardEvent>) =>
      tieneModificador({ ctrlKey: false, metaKey: false, altKey: false, ...extra } as KeyboardEvent);
    expect(con({ ctrlKey: true })).toBe(true);
    expect(con({ altKey: true })).toBe(true);
    expect(con({ metaKey: true })).toBe(true);
    expect(con({})).toBe(false);
  });
});

describe("Catálogo de atajos", () => {
  it("todos tienen teclas y descripción", () => {
    for (const a of ATAJOS) {
      expect(a.teclas.length).toBeGreaterThan(0);
      expect(a.descripcion.length).toBeGreaterThan(5);
    }
  });

  it("los de navegación son secuencias que empiezan con g", () => {
    for (const a of ATAJOS.filter((x) => x.destino)) {
      expect(a.teclas[0]).toBe("g");
      expect(a.teclas).toHaveLength(2);
    }
  });

  it("ninguna segunda tecla se repite, porque sería ambigua", () => {
    const segundas = ATAJOS.filter((a) => a.destino).map((a) => a.teclas[1]);
    expect(new Set(segundas).size).toBe(segundas.length);
  });

  it("los destinos apuntan a rutas de la plataforma", () => {
    for (const destino of Object.values(DESTINOS)) {
      expect(destino.startsWith("/resources")).toBe(true);
    }
  });
});

describe("Memoria de búsquedas recientes", () => {
  const CLAVE = "prueba:busquedas";
  beforeEach(() => { olvidarRecientes(CLAVE); });

  it("guarda y devuelve en orden, lo más reciente primero", () => {
    guardarReciente(CLAVE, "fracciones");
    guardarReciente(CLAVE, "células");
    expect(leerRecientes(CLAVE)).toEqual(["células", "fracciones"]);
  });

  it("no repite la misma búsqueda ni cambiando mayúsculas", () => {
    guardarReciente(CLAVE, "fracciones");
    guardarReciente(CLAVE, "Fracciones");
    expect(leerRecientes(CLAVE)).toEqual(["Fracciones"]);
  });

  it("ignora las búsquedas demasiado cortas", () => {
    guardarReciente(CLAVE, "a");
    guardarReciente(CLAVE, " ");
    expect(leerRecientes(CLAVE)).toEqual([]);
  });

  it("no crece sin límite", () => {
    for (let i = 0; i < 20; i++) guardarReciente(CLAVE, `tema ${i}`);
    expect(leerRecientes(CLAVE).length).toBeLessThanOrEqual(6);
    expect(leerRecientes(CLAVE)[0]).toBe("tema 19");
  });

  it("devuelve lista vacía si lo guardado está corrupto", () => {
    localStorage.setItem(CLAVE, "{no es json");
    expect(leerRecientes(CLAVE)).toEqual([]);
    localStorage.setItem(CLAVE, '{"a":1}');
    expect(leerRecientes(CLAVE)).toEqual([]);
  });

  it("no revienta si el navegador bloquea el almacenamiento", () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = vi.fn(() => { throw new Error("almacenamiento bloqueado"); });
    expect(() => guardarReciente(CLAVE, "algo")).not.toThrow();
    Storage.prototype.setItem = original;
  });
});
