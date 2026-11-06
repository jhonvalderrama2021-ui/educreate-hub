import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Bot, Plus, Trash2, Pencil, MessageSquare, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { avisarError } from "@/lib/errores";

/**
 * Los bots que el docente pone a disposición de su curso.
 *
 * El bot lo crea y lo entrena el docente en su propio módulo, con sus
 * documentos. Aquí solo decide cuáles de ellos entran a este curso y cómo se
 * los presenta a los estudiantes: el mismo bot de biología puede aparecer
 * como "Dudas de la unidad 3" en un curso y como "Repaso final" en otro.
 *
 * Se guarda la relación, no una copia: si el docente le carga un documento
 * nuevo al bot, los estudiantes del curso lo tienen al instante.
 */

interface Props {
  courseId: string;
}

interface BotDelCurso {
  id: string;
  bot_id: string;
  titulo: string | null;
  descripcion: string | null;
  position: number;
  bots: { id: string; name: string; specialty: string | null } | null;
}

export function BotsDelCurso({ courseId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<BotDelCurso | null>(null);
  const [botElegido, setBotElegido] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [guardando, setGuardando] = useState(false);

  const clave = ["course_bots", courseId] as const;

  const { data: asignados = [], isLoading } = useQuery({
    queryKey: clave,
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_bots")
        .select("id, bot_id, titulo, descripcion, position, bots(id, name, specialty)")
        .eq("course_id", courseId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as BotDelCurso[];
    },
  });

  // Los bots propios del docente, para elegir de ahí.
  const { data: misBots = [] } = useQuery({
    queryKey: ["mis_bots", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bots")
        .select("id, name, specialty")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const yaPuestos = new Set(asignados.map((a) => a.bot_id));
  const disponibles = misBots.filter((b) => !yaPuestos.has(b.id));

  const abrirNuevo = () => {
    setEditando(null);
    setBotElegido("");
    setTitulo("");
    setDescripcion("");
    setAbierto(true);
  };

  const abrirEdicion = (cb: BotDelCurso) => {
    setEditando(cb);
    setBotElegido(cb.bot_id);
    setTitulo(cb.titulo ?? "");
    setDescripcion(cb.descripcion ?? "");
    setAbierto(true);
  };

  const guardar = async () => {
    if (!editando && !botElegido) {
      toast.error("Elige cuál de tus bots quieres poner en el curso");
      return;
    }
    setGuardando(true);
    try {
      if (editando) {
        // Al editar solo cambian el nombre y la descripción con que se
        // presenta: cambiar el bot por otro sería quitarlo y poner uno nuevo,
        // y se llevaría por delante el hilo de conversación de cada estudiante.
        const { error } = await supabase
          .from("course_bots")
          .update({ titulo: titulo.trim() || null, descripcion: descripcion.trim() || null })
          .eq("id", editando.id);
        if (error) throw error;
        toast.success("Bot actualizado");
      } else {
        const { error } = await supabase.from("course_bots").insert({
          course_id: courseId,
          bot_id: botElegido,
          titulo: titulo.trim() || null,
          descripcion: descripcion.trim() || null,
          position: asignados.length,
        });
        if (error) throw error;
        toast.success("Bot agregado al curso");
      }
      setAbierto(false);
      qc.invalidateQueries({ queryKey: clave });
    } catch (e) {
      avisarError(e, "No se pudo guardar el bot del curso");
    } finally {
      setGuardando(false);
    }
  };

  const quitar = async (cb: BotDelCurso) => {
    const nombre = cb.titulo || cb.bots?.name || "este bot";
    if (!confirm(
      `¿Quitar "${nombre}" del curso?\n\nEl bot no se borra: sigue en tu módulo de bots. ` +
      `Los estudiantes de este curso dejarán de verlo.`,
    )) return;
    const { error } = await supabase.from("course_bots").delete().eq("id", cb.id);
    if (error) { avisarError(error, "No se pudo quitar el bot del curso"); return; }
    toast.success("Bot quitado del curso");
    qc.invalidateQueries({ queryKey: clave });
  };

  if (isLoading) {
    return <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">Cargando…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Los estudiantes del curso podrán conversar con estos bots. Cada uno tiene
          su propia conversación privada; tú no la ves.
        </p>
        <Button onClick={abrirNuevo} className="gradient-primary shrink-0" disabled={misBots.length === 0}>
          <Plus className="h-4 w-4 mr-2" />Agregar bot
        </Button>
      </div>

      {misBots.length === 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm flex gap-2.5">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-foreground font-medium">Todavía no tienes bots</p>
            <p className="text-muted-foreground mt-0.5">
              Primero crea un bot en{" "}
              <Link to="/resources/bots" className="text-primary underline underline-offset-2">
                Crear Bot
              </Link>
              , cárgale los documentos de tu clase, y luego vuelve aquí para ponerlo en el curso.
            </p>
          </div>
        </div>
      )}

      {asignados.length === 0 ? (
        misBots.length > 0 && (
          <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
            Este curso todavía no tiene bots.
          </div>
        )
      ) : (
        <div className="space-y-2">
          {asignados.map((cb) => (
            <div key={cb.id} className="glass-card rounded-lg p-4 flex items-center gap-3">
              <Bot className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground line-clamp-1">
                  {cb.titulo || cb.bots?.name || "Bot"}
                </div>
                <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                  {/* Si el docente le puso otro nombre en el curso, se recuerda
                      cuál bot es en realidad: con varios bots parecidos, el
                      nombre de vitrina no basta para saber cuál se está tocando. */}
                  {cb.titulo && cb.bots?.name && <span>Bot: {cb.bots.name}</span>}
                  {cb.bots?.specialty && <span>{cb.bots.specialty}</span>}
                </div>
                {cb.descripcion && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{cb.descripcion}</p>
                )}
              </div>
              <Link to={`/resources/bot-chat/${cb.bot_id}`}>
                <Button variant="ghost" size="icon" title="Probarlo">
                  <MessageSquare className="h-4 w-4" />
                </Button>
              </Link>
              <Button variant="ghost" size="icon" onClick={() => abrirEdicion(cb)} title="Editar">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => quitar(cb)} className="text-destructive" title="Quitar del curso">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? "Editar bot del curso" : "Agregar un bot al curso"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {!editando && (
              <div className="space-y-1.5">
                <Label htmlFor="cb-bot">¿Cuál de tus bots?</Label>
                <Select value={botElegido} onValueChange={setBotElegido}>
                  <SelectTrigger id="cb-bot">
                    <SelectValue placeholder="Elige un bot" />
                  </SelectTrigger>
                  <SelectContent>
                    {disponibles.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}{b.specialty ? ` · ${b.specialty}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {disponibles.length === 0 && misBots.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Ya pusiste todos tus bots en este curso.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="cb-titulo">Cómo se llamará en el curso (opcional)</Label>
              <Input
                id="cb-titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Dudas de la unidad 3"
                maxLength={120}
              />
              <p className="text-xs text-muted-foreground">
                Si lo dejas vacío se usa el nombre del bot.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cb-desc">Para qué sirve (opcional)</Label>
              <Textarea
                id="cb-desc"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Pregúntale sobre la lectura de la semana antes del taller."
                rows={3}
                maxLength={500}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAbierto(false)}>Cancelar</Button>
            <Button onClick={guardar} disabled={guardando} className="gradient-primary">
              {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Agregar al curso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
