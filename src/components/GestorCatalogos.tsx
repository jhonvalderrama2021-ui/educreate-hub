import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Pencil, Eye, EyeOff, Trash2, Loader2, Check, X } from "lucide-react";
import {
  ETIQUETA_CATALOGO, RESPALDO, type EntradaCatalogo, type TipoCatalogo,
} from "@/lib/catalogos";

/**
 * Mantenimiento de los catálogos de los formularios de generación.
 *
 * Pedido del asesor: *"si hay una nueva metodología que no esté aquí, ¿dónde
 * se agregaría? … que este sistema no quede congelado en el tiempo"*.
 *
 * Desactivar es la acción normal: una metodología que deja de usarse no debe
 * aparecerle al docente, pero los recursos que ya la citan siguen teniendo
 * sentido. Borrar solo se ofrece para corregir una entrada recién creada por
 * error.
 */

const TIPOS: TipoCatalogo[] = ["asignatura", "metodologia"];

export function GestorCatalogos() {
  const [tipo, setTipo] = useState<TipoCatalogo>("asignatura");

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold text-foreground">Catálogos</h2>
        <p className="text-sm text-muted-foreground">
          Opciones que ven los docentes al generar un recurso. Lo que agregues
          aquí aparece de inmediato en los formularios, sin desplegar de nuevo.
        </p>
      </div>

      <Tabs value={tipo} onValueChange={(v) => setTipo(v as TipoCatalogo)}>
        <div className="px-4 pt-4">
          <TabsList>
            {TIPOS.map((t) => (
              <TabsTrigger key={t} value={t}>{ETIQUETA_CATALOGO[t].plural}</TabsTrigger>
            ))}
          </TabsList>
        </div>
        {TIPOS.map((t) => (
          <TabsContent key={t} value={t} className="mt-0">
            <ListaCatalogo tipo={t} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function ListaCatalogo({ tipo }: { tipo: TipoCatalogo }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [nuevo, setNuevo] = useState("");
  const [agregando, setAgregando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [textoEdicion, setTextoEdicion] = useState("");

  const clave = ["catalogo_admin", tipo] as const;

  const { data: entradas = [], isLoading } = useQuery({
    queryKey: clave,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalogos")
        .select("*")
        .eq("tipo", tipo)
        .order("orden", { ascending: true })
        .order("valor", { ascending: true });
      if (error) throw error;
      return (data || []) as EntradaCatalogo[];
    },
  });

  // Las dos cachés hablan de lo mismo: la del panel y la de los formularios.
  const refrescar = () => {
    qc.invalidateQueries({ queryKey: clave });
    qc.invalidateQueries({ queryKey: ["catalogo", tipo] });
  };

  const agregar = async () => {
    const valor = nuevo.trim();
    if (!valor) return;
    if (entradas.some((e) => e.valor.toLowerCase() === valor.toLowerCase())) {
      return toast.error("Esa opción ya existe");
    }
    setAgregando(true);
    const { error } = await supabase.from("catalogos").insert({
      tipo,
      valor,
      // Al final de la lista: no reordena lo que el docente ya tiene aprendido.
      orden: Math.max(0, ...entradas.map((e) => e.orden)) + 1,
      creado_por: user?.id ?? null,
    });
    setAgregando(false);
    if (error) return toast.error("No se pudo agregar");
    setNuevo("");
    refrescar();
    toast.success(`${ETIQUETA_CATALOGO[tipo].singular} agregada`);
  };

  const renombrar = async (id: string) => {
    const valor = textoEdicion.trim();
    if (!valor) return;
    const { error } = await supabase.from("catalogos").update({ valor }).eq("id", id);
    if (error) return toast.error("No se pudo guardar");
    setEditandoId(null);
    refrescar();
    toast.success("Actualizado");
  };

  const alternarActivo = async (e: EntradaCatalogo) => {
    const { error } = await supabase
      .from("catalogos").update({ activo: !e.activo }).eq("id", e.id);
    if (error) return toast.error("No se pudo cambiar");
    refrescar();
    toast.success(e.activo ? "Oculta para los docentes" : "Visible de nuevo");
  };

  const borrar = async (e: EntradaCatalogo) => {
    if (!confirm(
      `¿Eliminar "${e.valor}" definitivamente?\n\n` +
      "Si ya la usaron en algún recurso, es preferible ocultarla: así el " +
      "recurso conserva su sentido y puedes volver a mostrarla cuando quieras."
    )) return;
    const { error } = await supabase.from("catalogos").delete().eq("id", e.id);
    if (error) return toast.error("No se pudo eliminar");
    refrescar();
    toast.success("Eliminada");
  };

  const activas = entradas.filter((e) => e.activo).length;
  // Si alguien vacía el catálogo, los formularios caen en la lista de
  // respaldo del código: conviene decirlo aquí y no dejarlo como sorpresa.
  const usandoRespaldo = activas === 0;

  return (
    <div>
      <div className="p-4 border-b border-border flex flex-wrap items-end gap-3">
        <div className="space-y-1.5 flex-1 min-w-[220px]">
          <Label htmlFor={`nuevo-${tipo}`} className="text-xs">
            Agregar {ETIQUETA_CATALOGO[tipo].singular.toLowerCase()}
          </Label>
          <Input
            id={`nuevo-${tipo}`}
            value={nuevo}
            onChange={(ev) => setNuevo(ev.target.value)}
            onKeyDown={(ev) => { if (ev.key === "Enter") agregar(); }}
            placeholder={tipo === "metodologia" ? "Ej: Aprendizaje Dialógico" : "Ej: Cátedra Afrocolombiana"}
          />
        </div>
        <Button onClick={agregar} disabled={agregando || !nuevo.trim()} className="gradient-primary">
          <Plus className="h-4 w-4 mr-1" /> Agregar
        </Button>
      </div>

      {usandoRespaldo && !isLoading && (
        <p className="px-4 py-3 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-b border-border">
          No hay ninguna opción visible. Mientras tanto los docentes ven la lista
          por defecto de {RESPALDO[tipo].length} {ETIQUETA_CATALOGO[tipo].plural.toLowerCase()},
          para que puedan seguir generando recursos.
        </p>
      )}

      {isLoading ? (
        <div className="p-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : entradas.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">
          Aún no hay opciones registradas.
        </p>
      ) : (
        <>
          <p className="px-4 pt-3 text-xs text-muted-foreground">
            {activas} visible{activas === 1 ? "" : "s"} de {entradas.length}
          </p>
          <ul className="divide-y divide-border">
            {entradas.map((e) => (
              <li
                key={e.id}
                className={`flex items-center gap-2 px-4 py-2.5 ${e.activo ? "" : "bg-muted/40"}`}
              >
                {editandoId === e.id ? (
                  <>
                    <Input
                      value={textoEdicion}
                      onChange={(ev) => setTextoEdicion(ev.target.value)}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter") renombrar(e.id);
                        if (ev.key === "Escape") setEditandoId(null);
                      }}
                      aria-label={`Nuevo nombre para ${e.valor}`}
                      className="h-8 flex-1"
                      autoFocus
                    />
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8"
                      onClick={() => renombrar(e.id)}
                      aria-label="Guardar nombre"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8"
                      onClick={() => setEditandoId(null)}
                      aria-label="Cancelar edición"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className={`flex-1 text-sm ${e.activo ? "text-foreground" : "text-muted-foreground line-through"}`}>
                      {e.valor}
                    </span>
                    {!e.activo && (
                      <span className="text-xs text-muted-foreground">oculta</span>
                    )}
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8"
                      onClick={() => { setEditandoId(e.id); setTextoEdicion(e.valor); }}
                      aria-label={`Editar ${e.valor}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8"
                      onClick={() => alternarActivo(e)}
                      aria-label={`${e.activo ? "Ocultar" : "Mostrar"} ${e.valor}`}
                    >
                      {e.activo ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => borrar(e)}
                      aria-label={`Eliminar ${e.valor}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
