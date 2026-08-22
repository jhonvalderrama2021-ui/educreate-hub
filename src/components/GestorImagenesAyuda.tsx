import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImagePlus, Trash2, Loader2, Image as IconoImagen } from "lucide-react";
import { toast } from "sonner";
import { SECCIONES_AYUDA } from "@/lib/ayuda-secciones";

interface ImagenAyuda {
  id: string;
  seccion: string;
  ruta: string;
  descripcion: string | null;
  orden: number;
}

const BUCKET = "ayuda-imagenes";
const TAMANO_MAXIMO = 3 * 1024 * 1024; // 3 MB

/** URL pública de una imagen del bucket. */
export function urlImagenAyuda(ruta: string) {
  return supabase.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl;
}

/**
 * Permite al administrador subir las capturas de pantalla que ilustran cada
 * sección del centro de ayuda, sin necesidad de tocar el código ni volver a
 * desplegar cuando la interfaz cambie.
 */
export function GestorImagenesAyuda() {
  const [imagenes, setImagenes] = useState<ImagenAyuda[]>([]);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [seccion, setSeccion] = useState<string>(SECCIONES_AYUDA[0].id);
  const [descripcion, setDescripcion] = useState("");

  const cargar = async () => {
    setCargando(true);
    const { data, error } = await (supabase as any)
      .from("ayuda_imagenes").select("*").order("seccion").order("orden");
    if (error) toast.error("No se pudieron cargar las imágenes");
    setImagenes(data || []);
    setCargando(false);
  };

  useEffect(() => { cargar(); }, []);

  const subir = async (archivo: File) => {
    if (!archivo.type.startsWith("image/")) {
      toast.error("Solo se admiten imágenes");
      return;
    }
    if (archivo.size > TAMANO_MAXIMO) {
      toast.error("La imagen supera los 3 MB. Reduce su tamaño antes de subirla.");
      return;
    }

    setSubiendo(true);
    const extension = archivo.name.split(".").pop() || "png";
    const ruta = `${seccion}/${Date.now()}.${extension}`;

    const { error: errorSubida } = await supabase.storage
      .from(BUCKET).upload(ruta, archivo, { upsert: false });

    if (errorSubida) {
      setSubiendo(false);
      toast.error("No se pudo subir la imagen");
      return;
    }

    const siguienteOrden = imagenes.filter((i) => i.seccion === seccion).length;
    const { error } = await (supabase as any).from("ayuda_imagenes").insert({
      seccion, ruta, descripcion: descripcion.trim() || null, orden: siguienteOrden,
    });

    setSubiendo(false);
    if (error) {
      // Si falla el registro, se retira el archivo para no dejar huérfanos
      await supabase.storage.from(BUCKET).remove([ruta]);
      toast.error("No se pudo registrar la imagen");
      return;
    }

    setDescripcion("");
    toast.success("Imagen agregada a la ayuda");
    cargar();
  };

  const eliminar = async (imagen: ImagenAyuda) => {
    if (!confirm("¿Eliminar esta imagen de la ayuda?")) return;
    await supabase.storage.from(BUCKET).remove([imagen.ruta]);
    const { error } = await (supabase as any)
      .from("ayuda_imagenes").delete().eq("id", imagen.id);
    if (error) { toast.error("No se pudo eliminar"); return; }
    toast.success("Imagen eliminada");
    cargar();
  };

  const nombreSeccion = (id: string) =>
    SECCIONES_AYUDA.find((s) => s.id === id)?.titulo || id;

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border p-4 space-y-3">
        <h3 className="font-medium text-foreground text-sm">Agregar una captura</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Las imágenes aparecen dentro de la sección que elijas en el centro de
          ayuda. Sirven para mostrarle al docente cómo se ve cada pantalla.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Sección de la ayuda</Label>
            <Select value={seccion} onValueChange={setSeccion}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SECCIONES_AYUDA.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.titulo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="descripcion">Descripción (opcional)</Label>
            <Input
              id="descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Formulario de exámenes"
              maxLength={120}
            />
          </div>
        </div>

        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
          {subiendo ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Subiendo…</>
          ) : (
            <><ImagePlus className="h-4 w-4 text-primary" /> Elegir imagen (máximo 3 MB)</>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={subiendo}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) subir(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {cargando ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : imagenes.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <IconoImagen className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Todavía no hay imágenes en la ayuda</p>
        </div>
      ) : (
        <div className="space-y-4">
          {SECCIONES_AYUDA.filter((s) => imagenes.some((i) => i.seccion === s.id)).map((s) => (
            <div key={s.id} className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">{s.titulo}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {imagenes.filter((i) => i.seccion === s.id).map((img) => (
                  <div key={img.id} className="rounded-lg border border-border overflow-hidden">
                    <img
                      src={urlImagenAyuda(img.ruta)}
                      alt={img.descripcion || nombreSeccion(img.seccion)}
                      className="w-full h-28 object-cover bg-muted"
                      loading="lazy"
                    />
                    <div className="flex items-center justify-between gap-2 p-2">
                      <span className="text-xs text-muted-foreground truncate">
                        {img.descripcion || "Sin descripción"}
                      </span>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 shrink-0 text-destructive"
                        onClick={() => eliminar(img)}
                        aria-label="Eliminar imagen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
