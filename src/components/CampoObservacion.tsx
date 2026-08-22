import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquarePlus, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";

/**
 * Campo para que el docente deje observaciones sobre el módulo en el que está
 * trabajando, sin salir de la pantalla.
 *
 * Es el instrumento de recolección de retroalimentación de la prueba piloto:
 * lo que el docente escribe aquí queda en la base de datos y el equipo lo
 * consulta después desde el panel de administración.
 */
export function CampoObservacion({
  modulo,
  recursoId,
}: {
  /** Identificador del módulo, por ejemplo "examenes" o "plan_de_clase". */
  modulo: string;
  /** Recurso concreto al que se refiere la observación, si aplica. */
  recursoId?: string | null;
}) {
  const { user } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState(false);

  if (!user) return null;

  const enviar = async () => {
    const observacion = texto.trim();
    if (observacion.length < 5) {
      toast.error("Escribe un poco más de detalle para que podamos entenderlo");
      return;
    }
    setEnviando(true);
    const { error } = await (supabase as any).from("observaciones_piloto").insert({
      user_id: user.id,
      modulo,
      recurso_id: recursoId ?? null,
      observacion,
    });
    setEnviando(false);

    if (error) {
      toast.error("No se pudo guardar la observación. Intenta de nuevo.");
      return;
    }
    setTexto("");
    setEnviada(true);
    setAbierto(false);
    toast.success("Gracias, tu observación quedó registrada");
    // El aviso de recibido se retira solo, para no dejar la pantalla ocupada.
    setTimeout(() => setEnviada(false), 6000);
  };

  if (enviada) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
        <Check className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-muted-foreground">
          Observación registrada. Puedes dejar otra cuando quieras.
        </span>
      </div>
    );
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
      >
        <MessageSquarePlus className="h-4 w-4 shrink-0 text-primary" />
        <span>¿Algo que mejorar en esta sección? Cuéntanos</span>
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          Tu observación sobre esta sección
        </p>
        <button
          type="button"
          onClick={() => { setAbierto(false); setTexto(""); }}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Cuéntanos qué te faltó, qué no entendiste o qué cambiarías. Nos sirve
        para mejorar la plataforma.
      </p>
      <Textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Por ejemplo: me gustaría poder elegir el nivel de dificultad del examen…"
        rows={3}
        maxLength={1500}
        autoFocus
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{texto.length}/1500</span>
        <Button size="sm" onClick={enviar} disabled={enviando}>
          {enviando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Enviar observación
        </Button>
      </div>
    </div>
  );
}
