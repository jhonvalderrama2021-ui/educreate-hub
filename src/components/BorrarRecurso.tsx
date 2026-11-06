import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { avisarError } from "@/lib/errores";

/**
 * Borrar un recurso del historial de su módulo.
 *
 * Lo delicado no es el borrado, es lo que arrastra. Las llaves de la base
 * están encadenadas: borrar el recurso borra la fila que lo pone en el curso,
 * y eso borra **las entregas y las notas de los estudiantes** de esa
 * actividad. Sin avisar y sin vuelta atrás.
 *
 * Por eso antes de preguntar se averigua si el recurso está en algún curso y
 * cuántas entregas hay. Si no está en ninguno —el caso normal, un recurso
 * repetido o que no gustó— la confirmación es la de siempre. Si está en uso,
 * se dice con números qué se va a perder.
 */

interface Props {
  recursoId: string;
  titulo: string;
  /** Se invoca tras borrar, por si el módulo estaba mostrando ese recurso. */
  onBorrado?: (id: string) => void;
  claveCache: readonly unknown[];
  /**
   * "icono" para la franja lateral de cada modulo, donde el espacio es poco;
   * "boton" para el historial general, que muestra la palabra Eliminar junto
   * a Editar y Descargar.
   */
  modo?: "icono" | "boton";
}

interface Uso {
  cursos: string[];
  entregas: number;
}

export function BorrarRecurso({ recursoId, titulo, onBorrado, claveCache, modo = "icono" }: Props) {
  const qc = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const [revisando, setRevisando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [uso, setUso] = useState<Uso | null>(null);

  const abrir = async () => {
    setAbierto(true);
    setRevisando(true);
    setUso(null);
    try {
      const { data: enCursos } = await supabase
        .from("course_resources")
        .select("id, mini_courses(name)")
        .eq("resource_id", recursoId);

      const ids = (enCursos ?? []).map((c: { id: string }) => c.id);
      let entregas = 0;
      if (ids.length) {
        const { count } = await supabase
          .from("resource_submissions")
          .select("id", { count: "exact", head: true })
          .in("course_resource_id", ids);
        entregas = count ?? 0;
      }

      setUso({
        cursos: (enCursos ?? []).map(
          (c: { mini_courses?: { name?: string } | null }) => c.mini_courses?.name ?? "un curso",
        ),
        entregas,
      });
    } catch {
      // Si no se pudo averiguar, se avisa de la duda en vez de callarla: es
      // peor borrar creyendo que no pasa nada.
      setUso(null);
    } finally {
      setRevisando(false);
    }
  };

  const borrar = async () => {
    setBorrando(true);
    try {
      const { error } = await supabase.from("generated_resources").delete().eq("id", recursoId);
      if (error) throw error;
      toast.success("Recurso eliminado");
      setAbierto(false);
      onBorrado?.(recursoId);
      qc.invalidateQueries({ queryKey: claveCache });
    } catch (e) {
      avisarError(e, "No se pudo eliminar el recurso");
    } finally {
      setBorrando(false);
    }
  };

  const enUso = !!uso && uso.cursos.length > 0;
  const conNotas = !!uso && uso.entregas > 0;

  return (
    <>
      {modo === "boton" ? (
        <Button
          variant="outline"
          size="sm"
          className="text-destructive"
          onClick={(e) => { e.stopPropagation(); abrir(); }}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); abrir(); }}
          aria-label={`Eliminar ${titulo}`}
          title="Eliminar"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}

      <AlertDialog open={abierto} onOpenChange={setAbierto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar «{titulo}»?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {revisando ? (
                  <span className="flex items-center gap-2 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" /> Revisando si está en uso…
                  </span>
                ) : uso === null ? (
                  <span className="block text-sm">
                    No se pudo comprobar si este recurso está en algún curso. Si lo está,
                    se perderán también las entregas y notas de los estudiantes.
                  </span>
                ) : enUso ? (
                  <>
                    <span className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-foreground">
                      <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      <span>
                        Este recurso está en{" "}
                        <strong>
                          {uso.cursos.length === 1 ? "el curso" : `${uso.cursos.length} cursos`}
                        </strong>{" "}
                        ({uso.cursos.join(", ")}).
                        {conNotas ? (
                          <>
                            {" "}Al eliminarlo también se borrarán{" "}
                            <strong>
                              {uso.entregas} {uso.entregas === 1 ? "entrega" : "entregas"} de
                              estudiantes, con sus notas
                            </strong>
                            . Esto no se puede deshacer.
                          </>
                        ) : (
                          <> Los estudiantes dejarán de verlo.</>
                        )}
                      </span>
                    </span>
                    {conNotas && (
                      <span className="block text-xs">
                        Si solo quieres que deje de aparecer, quítalo desde el curso en vez
                        de eliminarlo: así conservas las notas.
                      </span>
                    )}
                  </>
                ) : (
                  <span className="block text-sm">
                    No está en ningún curso. Se eliminará solo de tu historial y no se
                    puede recuperar.
                  </span>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={borrando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); borrar(); }}
              disabled={borrando || revisando}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {borrando ? "Eliminando…" : conNotas ? "Eliminar de todos modos" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
