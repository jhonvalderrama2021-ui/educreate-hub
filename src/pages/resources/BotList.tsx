import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Bot, Plus, Trash2, MessageCircle, Sparkles } from "lucide-react";
import { CampoObservacion } from "@/components/CampoObservacion";

interface BotItem {
  id: string;
  name: string;
  specialty: string;
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

  const handleCreate = async () => {
    if (!name.trim() || !specialty.trim()) {
      toast.error("Nombre y especialidad son obligatorios");
      return;
    }
    setCreating(true);
    const { error } = await (supabase as any).from("bots").insert({
      user_id: user!.id,
      name: name.trim(),
      specialty: specialty.trim(),
    });
    if (error) {
      toast.error("Error al crear el bot");
    } else {
      toast.success("Bot creado exitosamente");
      setName("");
      setSpecialty("");
      setShowForm(false);
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
        <Button onClick={() => setShowForm(!showForm)} className="gradient-primary">
          <Plus className="h-4 w-4 mr-1" /> Crear Bot
        </Button>
      </div>

      {showForm && (
        <div className="glass-card rounded-xl p-6 space-y-4 animate-fade-in">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Nuevo Bot
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre del bot <span className="text-destructive">*</span></Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: MateBot, HistorIA..."
              />
            </div>
            <div className="space-y-2">
              <Label>Especialidad <span className="text-destructive">*</span></Label>
              <Input
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="Ej: Matemáticas, Historia de Colombia..."
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            El bot solo responderá preguntas relacionadas con su especialidad.
          </p>
          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={creating} className="gradient-primary">
              {creating ? "Creando..." : "Crear Bot"}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive h-8 w-8"
                  onClick={() => handleDelete(bot.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
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
