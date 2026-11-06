import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Explicacion breve junto a un campo que no se entiende de entrada.
 *
 * La lista de chequeo marcaba como incumplido el criterio de Nielsen sobre
 * ayudas contextuales: la unica explicacion vivia en el centro de ayuda, a
 * dos pantallas del formulario, y en los botones con icono solo estaba el
 * atributo `title` nativo.
 *
 * Se usa un popover y no un tooltip a proposito. El tooltip de Radix se abre
 * al pasar el raton o al enfocar con el teclado, pero NO al tocar la pantalla:
 * en un celular es invisible. Los docentes de la prueba piloto del 8 de
 * octubre trabajaron con sus telefonos, asi que una ayuda que solo funcione
 * con raton no sirve. El popover se abre con clic, con toque y con Enter o
 * barra espaciadora, y se cierra con Escape.
 */
export function Explicacion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          // El nombre accesible dice de que campo se explica, porque varios
          // de estos botones conviven en una misma pantalla y "más información"
          // repetido seis veces no orienta a nadie.
          aria-label={`Qué es ${titulo}`}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="max-w-xs text-sm leading-relaxed">
        <p className="font-medium text-foreground mb-1">{titulo}</p>
        <div className="text-muted-foreground space-y-1.5">{children}</div>
      </PopoverContent>
    </Popover>
  );
}
