import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { extraerTextoDeArchivo, ACEPTA } from "@/lib/extraer-texto";
import { exportToDocx, exportToPdf } from "@/lib/export-resource";
import { ExportOptionsDialog } from "@/components/ExportOptionsDialog";
import { CrosswordGrid } from "@/components/games/CrosswordGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Puzzle, Sparkles, Loader2, Upload, Download, Save, RefreshCcw, Eye, EyeOff } from "lucide-react";
import { CampoObservacion } from "@/components/CampoObservacion";
import { HistorialModulo, type RecursoHistorial } from "@/components/HistorialModulo";
import { avisarError } from "@/lib/errores";

export interface CrosswordClue {
  number: number;
  clue: string;
  word: string;
  display: string;
}

export interface CrosswordPlaced {
  word: string;
  display: string;
  clue: string;
  row: number;
  col: number;
  direction: "across" | "down";
  number: number;
}

export interface CrosswordContent {
  theme: string;
  difficulty: string;
  rows: number;
  cols: number;
  grid: string[][];
  numbered: { row: number; col: number; n: number }[];
  placed: CrosswordPlaced[];
  across: CrosswordClue[];
  down: CrosswordClue[];
}

export default function Crossword() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [theme, setTheme] = useState("");
  const [totalWords, setTotalWords] = useState(10);
  const [acrossCount, setAcrossCount] = useState(5);
  const [downCount, setDownCount] = useState(5);
  const [difficulty, setDifficulty] = useState("medio");
  const [pdfText, setPdfText] = useState<string>("");
  const [pdfName, setPdfName] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  // Mientras exista, guardar actualiza ese registro en vez de duplicarlo.
  const [recursoId, setRecursoId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const recursoParam = searchParams.get("recurso");
  const [content, setContent] = useState<CrosswordContent | null>(null);

  /*
   * Si se borra el crucigrama que esta en pantalla, se limpia el visor.
   * Dejarlo puesto permitiria seguir editandolo y pulsar guardar sobre una
   * fila que ya no existe.
   */
  const limpiarSiEsElAbierto = (id: string) => {
    if (id !== recursoId) return;
    setContent(null);
    setRecursoId(null);
  };
  const [showSolution, setShowSolution] = useState(false);
  const [exportFormat, setExportFormat] = useState<"pdf" | "docx" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (acrossCount + downCount !== totalWords) {
      setDownCount(Math.max(1, totalWords - acrossCount));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalWords]);

  const onPdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const text = await extraerTextoDeArchivo(f);
      setPdfText(text);
      setPdfName(f.name);
      toast.success(`Documento cargado: ${text.length.toLocaleString("es-CO")} caracteres`);
    } catch (err) {
      // Si no se pudo leer, no se deja el nombre puesto: verlo ahi hacia
      // creer que el crucigrama saldria de ese documento.
      setPdfText("");
      setPdfName("");
      toast.error(
        err instanceof Error ? err.message : "No se pudo leer el documento",
        { duration: 10000 },
      );
    }
  };

  const handleGenerate = async () => {
    // Con documento la temática sobra: sale de él. Exigirla obligaba a
    // inventarse una, y esa palabra inventada terminaba desplazando al
    // archivo que se había subido.
    const hayDocumento = pdfText.trim().length > 0;
    if (!theme.trim() && !hayDocumento) {
      toast.error("Indica una temática, o sube un documento para sacarla de él");
      return;
    }
    if (acrossCount + downCount > totalWords + 4) {
      toast.error("Las palabras horizontales + verticales no pueden superar el total");
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-crossword", {
        body: {
          theme,
          totalWords,
          acrossCount,
          downCount,
          difficulty,
          pdfContent: pdfText || undefined,
          desdeDocumento: hayDocumento && !theme.trim(),
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setContent(data as CrosswordContent);
      setShowSolution(false);
      setRecursoId(null);
      // Se guarda solo: antes, cerrar la pestana costaba el recurso y su generacion.
      const guardado = await persistir(data as CrosswordContent, null);
      setRecursoId(guardado);
      toast.success(guardado ? "Crucigrama generado y guardado" : "Crucigrama generado");
    } catch (e: any) {
      avisarError(e, "No se pudo generar el crucigrama");
    } finally {
      setGenerating(false);
    }
  };

  /** Guarda o actualiza y devuelve el id, o null si fallo. */
  const persistir = async (c: any, id: string | null): Promise<string | null> => {
    if (!c || !user) return null;
    const datos = {
      title: `Crucigrama: ${c.theme}`,
      resource_type: "crossword",
      content: c,
    };
    try {
      if (id) {
        const { error } = await supabase.from("generated_resources")
          .update(datos).eq("id", id);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["generated_resources", user.id] });
        return id;
      }
      const { data, error } = await supabase.from("generated_resources")
        .insert({ user_id: user.id, ...datos }).select("id").single();
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["generated_resources", user.id] });
      return data?.id ?? null;
    } catch (e) {
      console.error("No se pudo guardar:", e);
      return null;
    }
  };

  const handleSave = async () => {
    const id = await persistir(content, recursoId);
    if (!id) return avisarError(null, "No se pudo guardar el crucigrama");
    setRecursoId(id);
    toast.success(recursoId ? "Cambios guardados" : "Guardado en historial");
  };

  // Llegar con ?recurso=<id> abre ese recurso para modificarlo, que es el
  // camino desde el historial general.
  useEffect(() => {
    if (!recursoParam || !user || recursoId === recursoParam) return;
    let cancelado = false;
    (async () => {
      const { data, error } = await supabase
        .from("generated_resources")
        .select("*")
        .eq("id", recursoParam)
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelado) return;
      if (error || !data) {
        avisarError(null, "No se encontró ese crucigrama");
        setSearchParams({}, { replace: true });
        return;
      }
      abrirDelHistorial(data as RecursoHistorial);
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recursoParam, user]);

  /** Carga en pantalla uno de los recursos de la franja lateral. */
  const abrirDelHistorial = (r: RecursoHistorial) => {
    setRecursoId(r.id);
    setContent(r.content as CrosswordContent);
    setShowSolution(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return (
    // Formulario a la izquierda, lo ya creado a la derecha.
    <div className="max-w-7xl mx-auto animate-fade-in grid gap-6 items-start lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6 min-w-0">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center">
            <Puzzle className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Generador de Crucigramas</h1>
            <p className="text-sm text-muted-foreground">Crea crucigramas educativos en español</p>
          </div>
        </div>

        <div className="glass-card rounded-xl p-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="campo-tematica">
                Temática del crucigrama{" "}
                {pdfText.trim() ? (
                  <span className="text-muted-foreground font-normal">(opcional)</span>
                ) : (
                  <span className="text-destructive">*</span>
                )}
              </Label>
              <Input
                id="campo-tematica"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder={pdfText.trim()
                  ? "Se toma del documento"
                  : "Ej: Sistema solar, Independencia de Colombia, Animales..."}
              />
              {pdfText.trim() && (
                <p className="text-xs text-muted-foreground">
                  {theme.trim()
                    ? "Se usarán solo las partes del documento que traten esta temática."
                    : "Las palabras saldrán del documento que subiste."}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Dificultad</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fácil">Fácil</SelectItem>
                  <SelectItem value="medio">Medio</SelectItem>
                  <SelectItem value="difícil">Difícil</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Total de palabras</Label>
              <Input
                type="number" min={4} max={20}
                value={totalWords}
                onChange={(e) => setTotalWords(Number(e.target.value) || 10)}
              />
            </div>
            <div className="space-y-2">
              <Label>Horizontales</Label>
              <Input
                type="number" min={1} max={totalWords - 1}
                value={acrossCount}
                onChange={(e) => {
                  const v = Number(e.target.value) || 1;
                  setAcrossCount(v);
                  setDownCount(Math.max(1, totalWords - v));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Verticales</Label>
              <Input
                type="number" min={1} max={totalWords - 1}
                value={downCount}
                onChange={(e) => {
                  const v = Number(e.target.value) || 1;
                  setDownCount(v);
                  setAcrossCount(Math.max(1, totalWords - v));
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Documento de referencia (opcional)</Label>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-3.5 w-3.5 mr-1" /> Subir documento
              </Button>
              {pdfName && <span className="text-xs text-muted-foreground truncate">{pdfName}</span>}
              <input
                ref={fileInputRef} type="file" accept={ACEPTA}
                className="hidden" onChange={onPdfChange}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              PDF, Word (.docx) o texto. Si lo subes, las palabras saldrán de ahí
              y no hace falta escribir la temática.
            </p>
          </div>

          <Button onClick={handleGenerate} disabled={generating} className="w-full gradient-primary">
            {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generando...</> : <><Sparkles className="h-4 w-4 mr-2" /> Generar crucigrama</>}
          </Button>
        </div>

        {content && (
          <div className="glass-card rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{content.theme}</h2>
                <p className="text-xs text-muted-foreground">
                  {content.across.length} horizontales · {content.down.length} verticales · {content.difficulty}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowSolution((s) => !s)}>
                  {showSolution ? <EyeOff className="h-3.5 w-3.5 mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
                  {showSolution ? "Ocultar solución" : "Ver solución"}
                </Button>
                <Button variant="outline" size="sm" onClick={handleGenerate}>
                  <RefreshCcw className="h-3.5 w-3.5 mr-1" /> Regenerar
                </Button>
                <Button variant="outline" size="sm" onClick={handleSave}>
                  <Save className="h-3.5 w-3.5 mr-1" /> Guardar
                </Button>
                <Button variant="outline" size="sm" onClick={() => setExportFormat("docx")}>
                  <Download className="h-3.5 w-3.5 mr-1" /> Word
                </Button>
                <Button variant="outline" size="sm" onClick={() => setExportFormat("pdf")}>
                  <Download className="h-3.5 w-3.5 mr-1" /> PDF
                </Button>
              </div>
            </div>

            <CrosswordGrid content={content} showSolution={showSolution} interactive />
          </div>
        )}

        {exportFormat && content && (
          <ExportOptionsDialog
            open={!!exportFormat}
            onOpenChange={(o) => !o && setExportFormat(null)}
            format={exportFormat}
            onConfirm={async (opts) => {
              const title = `Crucigrama: ${content.theme}`;
              if (exportFormat === "docx") await exportToDocx(title, "crossword", content, opts);
              else await exportToPdf(title, "crossword", content, opts);
            }}
          />
        )}
        <div className="mt-6">
          <CampoObservacion modulo="crucigrama" />
        </div>
      </div>

      <HistorialModulo
        tipos={["crossword"]}
        onAbrir={abrirDelHistorial}
        activo={recursoId}
        titulo="Crucigramas anteriores"
        onBorrado={limpiarSiEsElAbierto}
      />
    </div>
  );
}
