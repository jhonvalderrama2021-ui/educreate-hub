import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { extractTextFromPDF } from "@/lib/pdf-extract";
import { exportToDocx, exportToPdf } from "@/lib/export-resource";
import { ExportOptionsDialog } from "@/components/ExportOptionsDialog";
import { CrosswordGrid } from "@/components/games/CrosswordGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Puzzle, Sparkles, Loader2, Upload, Download, Save, RefreshCcw, Eye, EyeOff } from "lucide-react";

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
  const [theme, setTheme] = useState("");
  const [totalWords, setTotalWords] = useState(10);
  const [acrossCount, setAcrossCount] = useState(5);
  const [downCount, setDownCount] = useState(5);
  const [difficulty, setDifficulty] = useState("medio");
  const [pdfText, setPdfText] = useState<string>("");
  const [pdfName, setPdfName] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [content, setContent] = useState<CrosswordContent | null>(null);
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
      const text = await extractTextFromPDF(f);
      setPdfText(text);
      setPdfName(f.name);
      toast.success("PDF cargado");
    } catch {
      toast.error("No se pudo leer el PDF");
    }
  };

  const handleGenerate = async () => {
    if (!theme.trim()) {
      toast.error("Indica una temática");
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
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setContent(data as CrosswordContent);
      setShowSolution(false);
      toast.success("Crucigrama generado");
    } catch (e: any) {
      toast.error(e.message || "Error al generar");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!content || !user) return;
    const { error } = await (supabase as any).from("generated_resources").insert({
      user_id: user.id,
      title: `Crucigrama: ${content.theme}`,
      resource_type: "crossword",
      content,
    });
    if (error) toast.error("Error al guardar");
    else toast.success("Guardado en historial");
  };

  return (
    <div className="max-w-6xl mx-auto animate-fade-in space-y-6">
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
            <Label>Temática del crucigrama *</Label>
            <Input
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="Ej: Sistema solar, Independencia de Colombia, Animales..."
            />
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
          <Label>PDF de referencia (opcional)</Label>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5 mr-1" /> Subir PDF
            </Button>
            {pdfName && <span className="text-xs text-muted-foreground truncate">{pdfName}</span>}
            <input
              ref={fileInputRef} type="file" accept=".pdf,.txt"
              className="hidden" onChange={onPdfChange}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Si lo subes, las palabras se extraerán del contenido del PDF.
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
    </div>
  );
}
