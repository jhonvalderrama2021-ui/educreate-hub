import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Bot, Plus, Trash2, MessageCircle, Sparkles, Pencil } from "lucide-react";
import { CampoObservacion } from "@/components/CampoObservacion";

interface BotItem {
  id: string;
  name: string;
  specialty: string;
  detalle: string | null;
  nivel_educativo: string | null;
  created_at: string;
}

export default function BotList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bots, setBots] = useState<BotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [detalle, setDetalle] = useState("");
  const [nivel, setNivel] = useState("");
  const [editando, setEditando] = useState<BotItem | null>(null);

  useEffect(() => {
    if (user) loadBots();
  }, [user]);

  const loadBots = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("bots")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });
    if (error) toast.error("Error al cargar bots");
    setBots(data || []);
    setLoading(false);
  };

  /** Limpia el formulario y cierra el modo edición. */
  const limpiarFormulario = () => {
    setName(""); setSpecialty(""); setDetalle(""); setNivel("");
    setEditando(null); setShowForm(false);
  };

  /** Abre el formulario cargado con los datos del bot a corregir. */
  const empezarEdicion = (bot: BotItem) => {
    setEditando(bot);
    setName(bot.name);
    setSpecialty(bot.specialty);
    setDetalle(bot.detalle || "");
    setNivel(bot.nivel_educativo || "");
    setShowForm(true);
  };

  const handleCreate = async () => {
    if (!name.trim() || !specialty.trim()) {
      toast.error("Nombre y especialidad son obligatorios");
      return;
    }
    setCreating(true);

    const datos = {
      name: name.trim(),
      specialty: specialty.trim(),
      detalle: detalle.trim() || null,
      nivel_educativo: nivel.trim() || null,
    };

    const { error } = editando
      ? await (supabase as any).from("bots").update({ ...datos, updated_at: new Date().toISOString() }).eq("id", editando.id)
      : await (supabase as any).from("bots").insert({ user_id: user!.id, ...datos });

    if (error) {
      toast.error(editando ? "Error al guardar los cambios" : "Error al crear el bot");
    } else {
      toast.success(editando ? "Bot actualizado" : "Bot creado exitosamente");
      limpiarFormulario();
      loadBots();
    }
    setCreating(false);
  };
  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este bot y todas sus conversaciones?")) return;
    const { error } = await (supabase as any).from("bots").delete().eq("id", id);
    if (error) toast.error("Error al eliminar");
    else {
      setBots((prev) => prev.filter((b) => b.id !== id));
      toast.success("Bot eliminado");
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center">
            <Bot className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Mis Bots</h1>
            <p className="text-sm text-muted-foreground">Crea y gestiona tus bots educativos con IA</p>
          </div>
        </div>
        <Button
          onClick={() => (showForm ? limpiarFormulario() : setShowForm(true))}
          className="gradient-primary"
        >
          {showForm ? "Cerrar" : <><Plus className="h-4 w-4 mr-1" /> Nuevo Bot</>}
        </Button>
      </div>

      {showForm && (
        <div className="glass-card rounded-xl p-6 space-y-4 animate-fade-in">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> {editando ? "Editar bot" : "Nuevo Bot"}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bot-nombre">Nombre del bot <span className="text-destructive">*</span></Label>
              <Input
                id="bot-nombre"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: MateBot, HistorIA..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bot-especialidad">Especialidad <span className="text-destructive">*</span></Label>
              <Input
                id="bot-especialidad"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="Ej: Matemáticas, Historia de Colombia..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bot-nivel">Nivel educativo</Label>
            <Input
              id="bot-nivel"
              value={nivel}
              onChange={(e) => setNivel(e.target.value)}
              placeholder="Ej: Grado 8, primaria, media vocacional..."
            />
            <p className="text-xs text-muted-foreground">
              Ajusta el lenguaje del bot a la edad de tus estudiantes.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bot-detalle">Personalización</Label>
            <Textarea
              id="bot-detalle"
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Indica qué temas debe cubrir, con qué enfoque explicar, qué ejemplos usar o qué evitar. Por ejemplo: enfócate en álgebra básica, usa ejemplos de situaciones cotidianas y no resuelvas los ejercicios completos."
            />
            <p className="text-xs text-muted-foreground">
              Con solo el nombre y la especialidad el bot responde de forma genérica.
              Aquí precisas cómo quieres que se comporte. {detalle.length}/2000
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={creating} className="gradient-primary">
              {creating ? "Guardando..." : editando ? "Guardar cambios" : "Crear Bot"}
            </Button>
            <Button variant="outline" onClick={limpiarFormulario}>Cancelar</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : bots.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Bot className="h-16 w-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">No tienes bots creados</p>
          <p className="text-sm mt-1">Crea tu primer bot educativo para empezar a chatear</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {bots.map((bot) => (
            <div key={bot.id} className="glass-card rounded-xl p-5 space-y-3 hover:border-primary/30 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{bot.name}</p>
                    <p className="text-xs text-muted-foreground">{bot.specialty}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => empezarEdicion(bot)}
                    aria-label={`Editar ${bot.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive h-8 w-8"
                    onClick={() => handleDelete(bot.id)}
                    aria-label={`Eliminar ${bot.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {bot.detalle && (
                <p className="text-xs text-muted-foreground line-clamp-2 bg-muted/40 rounded-md p-2">
                  {bot.detalle}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {bot.nivel_educativo && `${bot.nivel_educativo} · `}
                Creado: {new Date(bot.created_at).toLocaleDateString("es-CO")}
              </p>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => navigate(`/resources/bot-chat/${bot.id}`)}
              >
                <MessageCircle className="h-4 w-4 mr-2" /> Chatear
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-6">
        <CampoObservacion modulo="bots" />
      </div>
    </div>
  );
}
