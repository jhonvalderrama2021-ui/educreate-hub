import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, X } from "lucide-react";

/**
 * Filtro de selección múltiple.
 *
 * Los desplegables anteriores solo dejaban elegir un valor: o Matemáticas o
 * Ciencias, o grado 6 o grado 7. Un docente que dicta la misma materia en
 * varios grados tenía que mirar sus recursos de a un grado por vez.
 *
 * Sin nada marcado no filtra: la lista muestra todo. Es lo que espera quien
 * abre la pantalla por primera vez.
 */

export interface OpcionFiltro {
  valor: string;
  etiqueta: string;
  /** Cuántos elementos hay con ese valor, para no elegir a ciegas. */
  cantidad?: number;
}

interface Props {
  etiqueta: string;
  opciones: OpcionFiltro[];
  seleccion: string[];
  onCambio: (seleccion: string[]) => void;
  /** Ancho del botón. Las franjas laterales necesitan uno más estrecho. */
  className?: string;
}

export function FiltroMultiple({ etiqueta, opciones, seleccion, onCambio, className }: Props) {
  if (opciones.length === 0) return null;

  const alternar = (valor: string) => {
    onCambio(
      seleccion.includes(valor)
        ? seleccion.filter((v) => v !== valor)
        : [...seleccion, valor],
    );
  };

  const resumen = seleccion.length === 0
    ? "Todos"
    : seleccion.length === 1
    ? opciones.find((o) => o.valor === seleccion[0])?.etiqueta ?? seleccion[0]
    : `${seleccion.length} seleccionados`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`justify-between gap-2 font-normal ${className ?? "w-[170px]"}`}
          aria-label={`Filtrar por ${etiqueta.toLowerCase()}`}
        >
          <span className="truncate">
            <span className="text-muted-foreground">{etiqueta}: </span>
            {resumen}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-64 p-0" align="start">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-xs font-medium text-foreground">{etiqueta}</span>
          {seleccion.length > 0 && (
            <button
              type="button"
              onClick={() => onCambio([])}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <X className="h-3 w-3" /> Quitar
            </button>
          )}
        </div>

        <div className="max-h-64 overflow-y-auto p-1">
          {opciones.map((o) => {
            const id = `filtro-${etiqueta}-${o.valor}`.replace(/\s+/g, "-").toLowerCase();
            return (
              <label
                key={o.valor}
                htmlFor={id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
              >
                <Checkbox
                  id={id}
                  checked={seleccion.includes(o.valor)}
                  onCheckedChange={() => alternar(o.valor)}
                />
                <span className="flex-1 truncate text-foreground">{o.etiqueta}</span>
                {o.cantidad !== undefined && (
                  <span className="text-xs text-muted-foreground">{o.cantidad}</span>
                )}
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Construye las opciones a partir de lo que el docente realmente tiene, con
 * el conteo de cada una. Un catálogo fijo mostraría asignaturas vacías.
 */
export function opcionesDe<T>(
  elementos: T[],
  extraer: (e: T) => string | null | undefined,
  etiquetar: (valor: string) => string = (v) => v,
): OpcionFiltro[] {
  const conteo = new Map<string, number>();
  for (const e of elementos) {
    const v = extraer(e);
    if (!v) continue;
    conteo.set(v, (conteo.get(v) ?? 0) + 1);
  }
  return [...conteo.entries()]
    .map(([valor, cantidad]) => ({ valor, etiqueta: etiquetar(valor), cantidad }))
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es", { numeric: true }));
}
