import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResourceContentViewer } from "@/components/ResourceContentViewer";
import { SlideViewer } from "@/components/SlideViewer";
import { Save, X } from "lucide-react";

/**
 * Edición de un recurso en un panel propio.
 *
 * Antes la edición se abría debajo del recurso: el docente pulsaba "Editar" y
 * tenía que desplazarse para encontrar los campos, con la vista de lectura
 * todavía ocupando la pantalla. Ahora la edición ocupa su propio espacio y al
 * cerrarla —guardando o descartando— se vuelve a la vista del recurso.
 *
 * Se trabaja sobre una copia: si el docente cierra sin guardar, el recurso
 * queda como estaba. Editar sobre el original haría que cancelar no
 * cancelara nada.
 */

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  tipo: string;
  contenidoOriginal: any;
  tituloOriginal: string;
  /** Persiste el recurso. Devuelve true si se guardó. */
  onGuardar: (contenido: any, titulo: string) => Promise<boolean>;
}

export function DialogoEditarRecurso({
  abierto, onCerrar, tipo, contenidoOriginal, tituloOriginal, onGuardar,
}: Props) {
  // Copia profunda: el visor edita en sitio y sin copia se modificaría el
  // recurso aunque el docente cancele.
  const [contenido, setContenido] = useState(() =>
    JSON.parse(JSON.stringify(contenidoOriginal ?? {})));
  const [titulo, setTitulo] = useState(tituloOriginal || "");
  const [guardando, setGuardando] = useState(false);

  const huboCambios =
    JSON.stringify(contenido) !== JSON.stringify(contenidoOriginal ?? {}) ||
    titulo !== (tituloOriginal || "");

  const intentarCerrar = () => {
    if (huboCambios && !confirm("Tienes cambios sin guardar. ¿Descartarlos?")) return;
    onCerrar();
  };

  const guardar = async () => {
    setGuardando(true);
    const ok = await onGuardar(contenido, titulo);
    setGuardando(false);
    if (ok) onCerrar();
  };

  return (
    <Dialog open={abierto} onOpenChange={(o) => { if (!o) intentarCerrar(); }}>
      <DialogContent
        className="max-w-5xl h-[90vh] flex flex-col gap-0 p-0"
        // Cerrar sin querer con Escape o un clic fuera perdería el trabajo:
        // se pasa por la misma confirmación que el botón de cerrar.
        onEscapeKeyDown={(e) => { e.preventDefault(); intentarCerrar(); }}
        onInteractOutside={(e) => { e.preventDefault(); }}
      >
        <DialogHeader className="border-b border-border p-4 space-y-3">
          <div>
            <DialogTitle>Editar recurso</DialogTitle>
            <DialogDescription>
              Los cambios se guardan sobre este mismo recurso, sin crear una copia.
            </DialogDescription>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="editar-titulo-recurso" className="text-xs">Título</Label>
            <Input
              id="editar-titulo-recurso"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título del recurso"
            />
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {tipo === "slides" ? (
            <SlideViewer
              slides={contenido?.slides || []}
              title={contenido?.title}
              theme={contenido?.theme}
              editable
              onSlideChange={(idx, actualizada) => {
                setContenido((previo: any) => {
                  const siguientes = [...(previo.slides || [])];
                  siguientes[idx] = actualizada;
                  return { ...previo, slides: siguientes };
                });
              }}
            />
          ) : (
            <ResourceContentViewer
              type={tipo}
              content={contenido}
              editable
              onContentChange={setContenido}
            />
          )}
        </div>

        <DialogFooter className="border-t border-border p-4 sm:justify-between">
          <span className="text-xs text-muted-foreground self-center">
            {huboCambios ? "Tienes cambios sin guardar" : "Sin cambios"}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={intentarCerrar}>
              <X className="h-4 w-4 mr-1" /> Cerrar
            </Button>
            <Button className="gradient-primary" onClick={guardar} disabled={guardando || !huboCambios}>
              <Save className="h-4 w-4 mr-1" />
              {guardando ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
