import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Bot, ArrowLeft, Send, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { avisarError } from "@/lib/errores";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface BotInfo {
  id: string;
  name: string;
  specialty: string;
}

export default function BotChat() {
  const { botId } = useParams<{ botId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [parametros] = useSearchParams();

  /*
   * A donde lleva la flecha de volver.
   *
   * El estudiante entra al bot desde su curso, asi que devolverlo a "Crear
   * Bot" lo dejaba en un modulo que no es suyo y sin rastro de por donde
   * habia entrado. Quien llego desde un curso vuelve al curso; quien llego
   * desde la lista de bots vuelve a la lista.
   */
  const cursoDeOrigen = parametros.get("curso");
  const volverA = cursoDeOrigen
    ? `/resources/courses/${cursoDeOrigen}/student`
    : "/resources/bots";
  const [bot, setBot] = useState<BotInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user && botId) {
      loadBot();
      loadMessages();
    }
  }, [user, botId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadBot = async () => {
    // Sin filtro por dueño a proposito: quien puede ver este bot lo decide
    // la base de datos. Es tuyo, o tu docente lo puso en un curso donde estas
    // inscrito. Si no es ninguna de las dos, la consulta no devuelve nada y
    // se cae al mensaje de "no encontrado", que es justo lo que debe pasar.
    const { data, error } = await supabase
      .from("bots")
      .select("id, name, specialty")
      .eq("id", botId!)
      .maybeSingle();
    if (error || !data) {
      avisarError(error, "No se encontró ese bot");
      navigate(volverA);
      return;
    }
    setBot(data);
  };

  const loadMessages = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("bot_messages")
      .select("*")
      .eq("bot_id", botId!)
      .eq("user_id", user!.id)
      .order("created_at", { ascending: true });
    // La columna guarda texto; en la interfaz solo existen estos dos roles.
    setMessages((data || []).map((m) => ({
      ...m,
      role: m.role === "assistant" ? "assistant" as const : "user" as const,
    })));
    setLoading(false);
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const userMessage = input.trim();
    setInput("");
    setSending(true);

    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: userMessage,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const { data, error } = await supabase.functions.invoke("chat-bot", {
        body: { botId, message: userMessage },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const assistantMsg: Message = {
        id: `temp-${Date.now()}-reply`,
        role: "assistant",
        content: data.reply,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e: any) {
      avisarError(e, "No se pudo enviar el mensaje");
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
    } finally {
      setSending(false);
    }
  };

  if (!bot && !loading) return null;

  return (
    <div className="max-w-3xl mx-auto animate-fade-in flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-border shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate(volverA)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">{bot?.name || "Cargando..."}</h1>
          <p className="text-xs text-muted-foreground">Especialidad: {bot?.specialty}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 min-h-0">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Bot className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">¡Hola! Soy {bot?.name}</p>
            <p className="text-sm mt-1">Pregúntame sobre {bot?.specialty}</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted text-foreground rounded-bl-md"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm [&>ul]:my-1 [&>ol]:my-1 [&>li]:my-0.5">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))
        )}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Pensando...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="pt-3 border-t border-border shrink-0">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Pregunta sobre ${bot?.specialty || "..."}...`}
            disabled={sending}
            className="flex-1"
          />
          <Button type="submit" disabled={sending || !input.trim()} className="gradient-primary">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
