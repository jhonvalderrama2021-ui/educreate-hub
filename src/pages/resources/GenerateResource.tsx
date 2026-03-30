import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { extractTextFromPDF } from "@/lib/pdf-extract";
import { generateWithOpenAI, generateWithOllama, fetchOllamaModels } from "@/lib/ai-service";
import { exportToDocx, exportToPdf } from "@/lib/export-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Sparkles, Upload, FileText, Loader2, Download, Save, Eye, EyeOff,
  BookOpen, ClipboardList, Table2, FileCheck, HelpCircle, FileEdit, Server, Cloud,
} from "lucide-react";

const RESOURCE_TYPES = [
  { value: "icfes", label: "Examen tipo ICFES", icon: FileCheck },
  { value: "quiz", label: "Cuestionario", icon: HelpCircle },
  { value: "workshop", label: "Taller", icon: FileEdit },
  { value: "guide", label: "Guía educativa", icon: BookOpen },
  { value: "lesson_plan", label: "Plan de clase", icon: ClipboardList },
  { value: "rubric", label: "Rúbrica", icon: Table2 },
];

export default function GenerateResource() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const typeParam = searchParams.get("type");

  const [resourceType, setResourceType] = useState(typeParam || "icfes");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [numItems, setNumItems] = useState(10);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfText, setPdfText] = useState("");
  const [extractingPdf, setExtractingPdf] = useState(false);

  // AI engine
  const [aiProvider, setAiProvider] = useState<"openai" | "ollama">("openai");
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [ollamaModel, setOllamaModel] = useState("llama3");
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load user preferences
  useEffect(() => {
    if (!user) return;
    (supabase as any).from("user_ai_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single()
      .then(({ data }: any) => {
        if (data) {
          setAiProvider(data.provider || "openai");
          setOllamaUrl(data.ollama_url || "http://localhost:11434");
          setOllamaModel(data.ollama_model || "llama3");
        }
      });
  }, [user]);

  // Keep resource type in sync with the URL (?type=...)
  useEffect(() => {
    setResourceType(typeParam || "icfes");
    setGeneratedContent(null);
  }, [typeParam]);

  // Detect Ollama models when selected
  useEffect(() => {
    if (aiProvider === "ollama") {
      fetchOllamaModels(ollamaUrl).then(setOllamaModels);
    }
  }, [aiProvider, ollamaUrl]);

  const handlePdfUpload = useCallback(async (file: File) => {
    setPdfFile(file);
    setExtractingPdf(true);
    try {
      const text = await extractTextFromPDF(file);
      setPdfText(text);
      toast.success(`PDF procesado: ${text.length} caracteres extraídos`);
    } catch (e: any) {
      toast.error("Error al procesar el PDF: " + e.message);
      setPdfText("");
    } finally {
      setExtractingPdf(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type === "application/pdf") handlePdfUpload(file);
    else toast.error("Solo se permiten archivos PDF");
  }, [handlePdfUpload]);

  const handleGenerate = async () => {
    if (!user) return;
    setGenerating(true);
    setGeneratedContent(null);

    try {
      const params = {
        resourceType,
        pdfContent: pdfText || undefined,
        instructions: instructions || undefined,
        numItems,
      };

      let result;
      if (aiProvider === "openai") {
        result = await generateWithOpenAI(params);
      } else {
        result = await generateWithOllama(params, ollamaUrl, ollamaModel);
      }

      if (!title && result.title) setTitle(result.title);
      setGeneratedContent(result);
      toast.success("¡Recurso generado exitosamente!");
    } catch (e: any) {
      toast.error(e.message || "Error al generar el recurso");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!user || !generatedContent) return;
    setSaving(true);

    try {
      let sourcePdfUrl = null;
      if (pdfFile) {
        const filePath = `${user.id}/${Date.now()}_${pdfFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("resource-pdfs")
          .upload(filePath, pdfFile);
        if (!uploadError) sourcePdfUrl = filePath;
      }

      const { error } = await (supabase as any).from("generated_resources").insert({
        user_id: user.id,
        title: title || generatedContent.title || "Recurso sin título",
        resource_type: resourceType,
        content: generatedContent,
        source_pdf_url: sourcePdfUrl,
        is_public: isPublic,
      });

      if (error) throw error;
      toast.success("Recurso guardado en tu historial");
    } catch (e: any) {
      toast.error("Error al guardar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  // Save AI preferences
  const savePreferences = async () => {
    if (!user) return;
    await (supabase as any).from("user_ai_preferences").upsert({
      user_id: user.id,
      provider: aiProvider,
      ollama_url: ollamaUrl,
      ollama_model: ollamaModel,
    }, { onConflict: "user_id" });
  };

  useEffect(() => {
    if (user) savePreferences();
  }, [aiProvider, ollamaUrl, ollamaModel]);

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Generar Recurso con IA</h1>
          <p className="text-sm text-muted-foreground">Crea recursos educativos automáticamente</p>
        </div>
      </div>

      {/* Config Card */}
      <div className="glass-card rounded-xl p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Tipo de recurso</Label>
            <Select
              value={resourceType}
              onValueChange={(value) => {
                setSearchParams({ type: value }, { replace: true });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESOURCE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Título (opcional)</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Se generará automáticamente si lo dejas vacío"
            />
          </div>
        </div>

        {(resourceType === "icfes" || resourceType === "quiz") && (
          <div className="space-y-2">
            <Label>Número de preguntas</Label>
            <Input
              type="number"
              min={1}
              max={50}
              value={numItems}
              onChange={(e) => setNumItems(parseInt(e.target.value) || 10)}
              className="w-32"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label>Instrucciones adicionales (opcional)</Label>
          <Textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Ej: Enfócate en el tema de fotosíntesis, nivel grado 10, incluye preguntas de análisis..."
            rows={3}
          />
        </div>

        {/* PDF Upload */}
        <div className="space-y-2">
          <Label>Archivo PDF fuente (opcional)</Label>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => document.getElementById("pdf-input")?.click()}
          >
            <input
              id="pdf-input"
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handlePdfUpload(file);
              }}
            />
            {extractingPdf ? (
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Procesando PDF...</span>
              </div>
            ) : pdfFile ? (
              <div className="flex items-center justify-center gap-2 text-primary">
                <FileText className="h-5 w-5" />
                <span className="font-medium">{pdfFile.name}</span>
                <span className="text-xs text-muted-foreground">({pdfText.length} caracteres)</span>
              </div>
            ) : (
              <div className="space-y-1">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Arrastra un PDF aquí o haz clic para seleccionar
                </p>
                <p className="text-xs text-muted-foreground">
                  La IA generará el contenido basado en el PDF
                </p>
              </div>
            )}
          </div>
        </div>

        {/* AI Engine */}
        <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border">
          <Label className="text-sm font-semibold">Motor de IA</Label>
          <div className="flex gap-3">
            <Button
              variant={aiProvider === "openai" ? "default" : "outline"}
              size="sm"
              onClick={() => setAiProvider("openai")}
              className={aiProvider === "openai" ? "gradient-primary" : ""}
            >
              <Cloud className="h-4 w-4 mr-1" /> OpenAI
            </Button>
            <Button
              variant={aiProvider === "ollama" ? "default" : "outline"}
              size="sm"
              onClick={() => setAiProvider("ollama")}
              className={aiProvider === "ollama" ? "gradient-primary" : ""}
            >
              <Server className="h-4 w-4 mr-1" /> Ollama (Local)
            </Button>
          </div>

          {aiProvider === "ollama" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              <div className="space-y-1">
                <Label className="text-xs">URL de Ollama</Label>
                <Input
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Modelo</Label>
                {ollamaModels.length > 0 ? (
                  <Select value={ollamaModel} onValueChange={setOllamaModel}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ollamaModels.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={ollamaModel}
                    onChange={(e) => setOllamaModel(e.target.value)}
                    placeholder="llama3"
                    className="text-sm"
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Generate Button */}
        <Button
          className="w-full gradient-primary text-lg py-6"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Generando recurso...
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5 mr-2" />
              Generar con IA
            </>
          )}
        </Button>
      </div>

      {/* Generated Content */}
      {generatedContent && (
        <div className="glass-card rounded-xl overflow-hidden animate-fade-in">
          <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-semibold text-foreground text-lg">
              {generatedContent.title || title || "Recurso generado"}
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 mr-3">
                {isPublic ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                <Label className="text-xs cursor-pointer" htmlFor="public-toggle">
                  {isPublic ? "Público" : "Privado"}
                </Label>
                <Switch id="public-toggle" checked={isPublic} onCheckedChange={setIsPublic} />
              </div>
              <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-1" />
                {saving ? "Guardando..." : "Guardar"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportToDocx(
                generatedContent.title || title || "Recurso",
                resourceType,
                generatedContent
              )}>
                <Download className="h-4 w-4 mr-1" /> Word
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportToPdf(
                generatedContent.title || title || "Recurso",
                resourceType,
                generatedContent
              )}>
                <Download className="h-4 w-4 mr-1" /> PDF
              </Button>
            </div>
          </div>

          <div className="p-6">
            <ResourceContentViewer type={resourceType} content={generatedContent} />
          </div>
        </div>
      )}
    </div>
  );
}

function ResourceContentViewer({ type, content }: { type: string; content: any }) {
  switch (type) {
    case "icfes":
    case "quiz":
      return (
        <div className="space-y-6">
          {content.questions?.map((q: any) => (
            <div key={q.number} className="p-4 border border-border rounded-lg bg-muted/20">
              <p className="font-semibold text-foreground mb-2">
                {q.number}. {q.question}
              </p>
              {q.context && <p className="text-sm text-muted-foreground mb-3 italic">{q.context}</p>}
              <div className="space-y-1.5 mb-3">
                {q.options && (Array.isArray(q.options)
                  ? q.options.map((opt: string, i: number) => (
                    <p key={i} className={`text-sm pl-4 py-1 rounded ${
                      String(q.correct) === opt || String(q.correct) === String.fromCharCode(65 + i)
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground"
                    }`}>
                      {String.fromCharCode(65 + i)}. {opt}
                    </p>
                  ))
                  : Object.entries(q.options).map(([k, v]) => (
                    <p key={k} className={`text-sm pl-4 py-1 rounded ${
                      q.correct === k ? "bg-primary/10 text-primary font-medium" : "text-foreground"
                    }`}>
                      {k}. {String(v)}
                    </p>
                  ))
                )}
              </div>
              {q.explanation && (
                <p className="text-xs text-muted-foreground border-t border-border pt-2">
                  💡 {q.explanation}
                </p>
              )}
            </div>
          ))}
        </div>
      );

    case "workshop":
      return (
        <div className="space-y-4">
          {content.objective && (
            <div className="p-3 bg-primary/5 rounded-lg">
              <p className="text-sm"><strong>Objetivo:</strong> {content.objective}</p>
              {content.duration && <p className="text-sm"><strong>Duración:</strong> {content.duration}</p>}
            </div>
          )}
          {content.materials?.length > 0 && (
            <div>
              <p className="font-medium text-sm mb-1">Materiales:</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground">
                {content.materials.map((m: string, i: number) => <li key={i}>{m}</li>)}
              </ul>
            </div>
          )}
          {content.activities?.map((a: any) => (
            <div key={a.number} className="p-4 border border-border rounded-lg">
              <h3 className="font-semibold text-foreground mb-2">Actividad {a.number}: {a.title}</h3>
              <p className="text-sm text-foreground mb-2">{a.description}</p>
              {a.instructions && <p className="text-sm text-muted-foreground italic">{a.instructions}</p>}
              {a.duration && <p className="text-xs text-muted-foreground mt-1">⏱ {a.duration}</p>}
            </div>
          ))}
          {content.evaluation && (
            <div className="p-3 bg-muted/30 rounded-lg">
              <p className="text-sm"><strong>Evaluación:</strong> {content.evaluation}</p>
            </div>
          )}
        </div>
      );

    case "guide":
      return (
        <div className="space-y-4">
          {content.introduction && <p className="text-foreground">{content.introduction}</p>}
          {content.objectives?.length > 0 && (
            <div>
              <p className="font-medium text-sm mb-1">Objetivos:</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground">
                {content.objectives.map((o: string, i: number) => <li key={i}>{o}</li>)}
              </ul>
            </div>
          )}
          {content.sections?.map((s: any) => (
            <div key={s.number} className="p-4 border border-border rounded-lg">
              <h3 className="font-semibold text-foreground mb-2">{s.number}. {s.title}</h3>
              <p className="text-sm text-foreground mb-2">{s.content}</p>
              {s.examples?.length > 0 && (
                <div className="bg-muted/30 p-2 rounded text-sm">
                  <strong>Ejemplos:</strong>
                  <ul className="list-disc list-inside">{s.examples.map((e: string, i: number) => <li key={i}>{e}</li>)}</ul>
                </div>
              )}
            </div>
          ))}
          {content.summary && (
            <div className="p-3 bg-primary/5 rounded-lg">
              <p className="text-sm"><strong>Resumen:</strong> {content.summary}</p>
            </div>
          )}
        </div>
      );

    case "lesson_plan":
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            {content.grade && <p><strong>Grado:</strong> {content.grade}</p>}
            {content.duration && <p><strong>Duración:</strong> {content.duration}</p>}
          </div>
          {content.objective && <p className="text-sm bg-primary/5 p-3 rounded-lg"><strong>Objetivo:</strong> {content.objective}</p>}
          {content.phases?.map((p: any, i: number) => (
            <div key={i} className="p-4 border border-border rounded-lg">
              <h3 className="font-semibold text-foreground mb-2">{p.name} ({p.duration})</h3>
              <p className="text-sm text-foreground">{p.activities}</p>
              {p.resources && <p className="text-xs text-muted-foreground mt-1">📚 {p.resources}</p>}
            </div>
          ))}
          {content.evaluation && <p className="text-sm p-3 bg-muted/30 rounded-lg"><strong>Evaluación:</strong> {content.evaluation}</p>}
        </div>
      );

    case "rubric":
      return (
        <div className="space-y-4">
          {content.objective && <p className="text-sm bg-primary/5 p-3 rounded-lg"><strong>Objetivo:</strong> {content.objective}</p>}
          {content.criteria?.map((c: any, i: number) => (
            <div key={i} className="border border-border rounded-lg overflow-hidden">
              <div className="p-3 bg-muted/30 font-semibold text-sm flex justify-between">
                <span>{c.name}</span>
                {c.weight && <span className="text-muted-foreground">{c.weight}%</span>}
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-border">
                {Object.entries(c.descriptions || {}).map(([level, desc]) => (
                  <div key={level} className="p-3">
                    <p className="text-xs font-semibold text-primary mb-1">{level}</p>
                    <p className="text-xs text-muted-foreground">{String(desc)}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      );

    default:
      return <pre className="text-xs overflow-auto">{JSON.stringify(content, null, 2)}</pre>;
  }
}
