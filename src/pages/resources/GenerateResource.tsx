import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { extractTextFromPDF } from "@/lib/pdf-extract";
import { generateWithOpenAI, generateWithOllama, fetchOllamaModels } from "@/lib/ai-service";
import { exportToDocx, exportToPdf } from "@/lib/export-resource";
import { ResourceContentViewer } from "@/components/ResourceContentViewer";
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
  GraduationCap, BookMarked, Beaker, AlertCircle,
} from "lucide-react";

const RESOURCE_TYPES = [
  { value: "icfes", label: "Examen tipo ICFES", icon: FileCheck },
  { value: "quiz", label: "Cuestionario", icon: HelpCircle },
  { value: "workshop", label: "Taller", icon: FileEdit },
  { value: "guide", label: "Guía educativa", icon: BookOpen },
  { value: "lesson_plan", label: "Plan de clase", icon: ClipboardList },
  { value: "rubric", label: "Rúbrica", icon: Table2 },
];

const SUBJECTS = [
  "Matemáticas",
  "Ciencias Naturales",
  "Biología",
  "Lenguaje",
  "Ciencias Sociales",
];

const METHODOLOGIES = [
  "Aprendizaje Basado en Proyectos (ABP)",
  "Aprendizaje colaborativo",
  "Aprendizaje basado en problemas",
  "Clase magistral",
];

// Which fields each resource type uses (all get tema, asignatura, nivel, pdf)
const RESOURCE_FIELDS: Record<string, string[]> = {
  icfes: ["numItems"],
  quiz: ["numItems"],
  workshop: ["methodology", "duration"],
  guide: ["methodology"],
  lesson_plan: ["methodology", "duration"],
  rubric: ["methodology"],
};

export default function GenerateResource() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const typeParam = searchParams.get("type");

  const [resourceType, setResourceType] = useState(typeParam || "icfes");

  // Common fields
  const [tema, setTema] = useState("");
  const [subject, setSubject] = useState("");
  const [customSubject, setCustomSubject] = useState("");
  const [grade, setGrade] = useState("6");
  const [methodology, setMethodology] = useState("");
  const [customMethodology, setCustomMethodology] = useState("");
  const [duration, setDuration] = useState("");

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
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const extraFields = useMemo(() => RESOURCE_FIELDS[resourceType] || [], [resourceType]);

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

  useEffect(() => {
    setResourceType(typeParam || "icfes");
    setGeneratedContent(null);
  }, [typeParam]);

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

  const validate = (): boolean => {
    const errors: string[] = [];
    if (!tema.trim()) errors.push("El tema es obligatorio");
    if (!subject) errors.push("La asignatura es obligatoria");
    if (subject === "Otras" && !customSubject.trim()) errors.push("Escribe la asignatura personalizada");
    
    if (methodology === "Otras" && extraFields.includes("methodology") && !customMethodology.trim()) {
      errors.push("Escribe la metodología personalizada");
    }
    setValidationErrors(errors);
    return errors.length === 0;
  };

  const buildInstructions = (): string => {
    const resolvedSubject = subject === "Otras" ? customSubject : subject;
    const resolvedMethodology = methodology === "Otras" ? customMethodology : methodology;

    const parts: string[] = [];
    parts.push(`Tema: ${tema}`);
    parts.push(`Asignatura: ${resolvedSubject}`);
    parts.push(`Grado: ${grade}`);
    if (extraFields.includes("methodology") && resolvedMethodology) {
      parts.push(`Metodología: ${resolvedMethodology}`);
    }
    if (extraFields.includes("duration") && duration) {
      parts.push(`Duración: ${duration}`);
    }
    if (instructions.trim()) {
      parts.push(`Instrucciones adicionales: ${instructions}`);
    }
    return parts.join("\n");
  };

  const handleGenerate = async () => {
    if (!user) return;
    if (!validate()) return;

    setGenerating(true);
    setGeneratedContent(null);

    try {
      const params = {
        resourceType,
        pdfContent: pdfText || undefined,
        instructions: buildInstructions(),
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

  const currentType = RESOURCE_TYPES.find((t) => t.value === resourceType);
  const TypeIcon = currentType?.icon || Sparkles;

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center">
          <TypeIcon className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {currentType?.label || "Generar Recurso"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Completa el formulario y genera con IA
          </p>
        </div>
      </div>

      {/* Main Form */}
      <div className="glass-card rounded-xl p-6 space-y-5">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <BookMarked className="h-5 w-5 text-primary" />
          Información del recurso
        </h2>

        {/* Validation errors */}
        {validationErrors.length > 0 && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 space-y-1">
            {validationErrors.map((err, i) => (
              <p key={i} className="text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" /> {err}
              </p>
            ))}
          </div>
        )}

        {/* Row 1: Tema + Título */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>
              Tema <span className="text-destructive">*</span>
            </Label>
            <Input
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              placeholder="Ej: La fotosíntesis, Ecuaciones cuadráticas..."
            />
          </div>
          <div className="space-y-2">
            <Label>Título (opcional)</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Se generará automáticamente"
            />
          </div>
        </div>

        {/* Row 2: Asignatura + Nivel */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>
              Asignatura <span className="text-destructive">*</span>
            </Label>
            <Select value={subject} onValueChange={(v) => { setSubject(v); if (v !== "Otras") setCustomSubject(""); }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una asignatura" />
              </SelectTrigger>
              <SelectContent>
                {SUBJECTS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
                <SelectItem value="Otras">Otras</SelectItem>
              </SelectContent>
            </Select>
            {subject === "Otras" && (
              <Input
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                placeholder="Escribe la asignatura"
                className="mt-2"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>
              Nivel educativo <span className="text-destructive">*</span>
            </Label>
            <div className="flex items-center gap-3">
              <GraduationCap className="h-5 w-5 text-muted-foreground shrink-0" />
              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 11 }, (_, i) => i + 1).map((g) => (
                    <SelectItem key={g} value={String(g)}>
                      Grado {g} — {g <= 5 ? "Primaria" : "Secundaria"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Conditional: Methodology */}
        {extraFields.includes("methodology") && (
          <div className="space-y-2">
            <Label>Metodología</Label>
            <Select value={methodology} onValueChange={(v) => { setMethodology(v); if (v !== "Otras") setCustomMethodology(""); }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una metodología" />
              </SelectTrigger>
              <SelectContent>
                {METHODOLOGIES.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
                <SelectItem value="Otras">Otras</SelectItem>
              </SelectContent>
            </Select>
            {methodology === "Otras" && (
              <Input
                value={customMethodology}
                onChange={(e) => setCustomMethodology(e.target.value)}
                placeholder="Escribe la metodología"
                className="mt-2"
              />
            )}
          </div>
        )}

        {/* Conditional: Duration */}
        {extraFields.includes("duration") && (
          <div className="space-y-2">
            <Label>Duración</Label>
            <Input
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="Ej: 2 horas, 45 minutos"
            />
          </div>
        )}

        {/* Conditional: Number of items */}
        {extraFields.includes("numItems") && (
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

        {/* Additional instructions */}
        <div className="space-y-2">
          <Label>Instrucciones adicionales (opcional)</Label>
          <Textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Ej: Incluye preguntas de análisis, agrega ejemplos prácticos..."
            rows={3}
          />
        </div>

        {/* PDF Upload - required */}
        <div className="space-y-2">
          <Label>Archivo PDF fuente (opcional)</Label>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer border-border hover:border-primary/50"
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
          <Label className="text-sm font-semibold flex items-center gap-2">
            <Beaker className="h-4 w-4 text-primary" />
            Motor de IA
          </Label>
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

