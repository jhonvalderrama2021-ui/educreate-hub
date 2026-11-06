import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  FileText, Upload, Trash2, Loader2, CheckCircle2, AlertCircle,
} from "lucide-react";
import { avisarError } from "@/lib/errores";

/**
 * Documentos que sirven de fuente a un bot.
 *
 * Último punto de la tarea 8 de la reunión: *"el bot puede partir de un
 * documento que yo pueda anexar"*, y la advertencia del asesor: *"nos tocaría
 * hacerle como una vectorización a los PDF"*.
 *
 * El texto se extrae aquí, en el navegador, con la misma biblioteca que usan
 * los demás módulos. Al servidor viaja texto plano, no el archivo: procesar
 * PDF en la Edge Function sería más frágil y más lento.
 */

interface DocumentoBot {
  id: string;
  nombre: string;
  caracteres: number;
  fragmentos: number;
  estado: "procesando" | "listo" | "error";
  detalle_error: string | null;
  created_at: string;
}

const TIPOS_ACEPTADOS = ".pdf,.txt,.md";

export function GestorDocumentosBot({ botId }: { botId: string }) {
  const [documentos, setDocumentos] = useState<DocumentoBot[]>([]);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState<string | null>(null);

  const cargar = async () => {
    const { data, error } = await supabase
      .from("bot_documentos")
      .select("*")
      .eq("bot_id", botId)
      .order("created_at", { ascending: false });
    if (error) avisarError(error, "No se pudieron cargar los documentos del bot");
    setDocumentos((data || []) as DocumentoBot[]);
    setCargando(false);
  };

  useEffect(() => {
    cargar();
    // `cargar` se redefine en cada render: incluirla en las dependencias
    // dispararía la consulta en bucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId]);

  const subir = async (archivo: File) => {
    setProcesando("Leyendo el archivo...");
    try {
      let texto: string;
      if (archivo.name.toLowerCase().endsWith(".pdf")) {
        // El lector de PDF pesa 453 kB. Se carga solo cuando el docente
        // anexa uno de verdad, no cada vez que abre la lista de bots.
        const { extractTextFromPDF } = await import("@/lib/pdf-extract");
        texto = await extractTextFromPDF(archivo);
      } else {
        texto = await archivo.text();
      }

      setProcesando("Analizando el documento...");
      const { data, error } = await supabase.functions.invoke("procesar-documento-bot", {
        body: { botId, nombre: archivo.name, texto },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const resultado = data as any;
      toast.success(
        `Documento listo: ${resultado.fragmentos} fragmento${resultado.fragmentos === 1 ? "" : "s"}` +
        (resultado.recortado ? ". Era muy largo y se tomó la primera parte." : ""),
      );
      cargar();
    } catch (e: any) {
      // El error del PDF escaneado —el caso más común— ya trae la explicación
      // completa para el docente, así que basta con mostrarlo tal cual.
      avisarError(e, "No se pudo procesar el documento");
    } finally {
      setProcesando(null);
    }
  };

  const eliminar = async (d: DocumentoBot) => {
    if (!confirm(
      `¿Quitar "${d.nombre}" de este bot?\n\n` +
      "El bot dejará de responder a partir de ese documento."
    )) return;
    const { error } = await supabase.from("bot_documentos").delete().eq("id", d.id);
    if (error) return avisarError(error, "No se pudo eliminar el documento");
    setDocumentos((prev) => prev.filter((x) => x.id !== d.id));
    toast.success("Documento eliminado");
  };

  const listos = documentos.filter((d) => d.estado === "listo").length;

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div>
        <h3 className="text-sm font-medium text-foreground">Documentos del bot</h3>
        <p className="text-xs text-muted-foreground">
          El bot responderá a partir de lo que digan estos documentos. Sirve para
          que trabaje sobre tu plan de área, una cartilla o una guía concreta, en
          vez de responder de forma general.
        </p>
      </div>

      <label
        className={`flex items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-sm transition-colors ${
          procesando
            ? "border-border text-muted-foreground"
            : "border-border hover:border-primary/50 cursor-pointer text-muted-foreground"
        }`}
      >
        <input
          type="file"
          accept={TIPOS_ACEPTADOS}
          className="hidden"
          disabled={!!procesando}
          onChange={(e) => {
            const archivo = e.target.files?.[0];
            e.target.value = "";
            if (archivo) subir(archivo);
          }}
        />
        {procesando ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{procesando}</span>
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            <span>Anexar documento (PDF, TXT o MD)</span>
          </>
        )}
      </label>

      {cargando ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : documentos.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">
          Sin documentos. El bot responde desde su especialidad.
        </p>
      ) : (
        <>
          <ul className="space-y-1.5">
            {documentos.map((d) => (
              <li key={d.id} className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground truncate">{d.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.estado === "listo" && (
                      <>
                        {d.fragmentos} fragmento{d.fragmentos === 1 ? "" : "s"} ·{" "}
                        {d.caracteres.toLocaleString("es-CO")} caracteres
                      </>
                    )}
                    {d.estado === "procesando" && "Procesando..."}
                    {d.estado === "error" && (d.detalle_error || "No se pudo procesar")}
                  </p>
                </div>
                {d.estado === "listo" && (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-label="Listo" />
                )}
                {d.estado === "procesando" && (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                )}
                {d.estado === "error" && (
                  <AlertCircle className="h-4 w-4 shrink-0 text-destructive" aria-label="Con error" />
                )}
                <Button
                  variant="ghost" size="icon"
                  className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => eliminar(d)}
                  aria-label={`Eliminar ${d.nombre}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
          {listos > 0 && (
            <p className="text-xs text-muted-foreground">
              Ante cada pregunta el bot busca los fragmentos más relacionados y
              responde con esos. Si la respuesta no está en el material, lo dice.
            </p>
          )}
        </>
      )}
    </div>
  );
}
