import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { extractTextFromPDF } from "@/lib/pdf-extract";
import { generateWithOpenAI, generateWithOllama, fetchOllamaModels } from "@/lib/ai-service";
import { exportToDocx, exportToPdf } from "@/lib/export-resource";
import { exportSlidesToPdf, exportSlidesToPptx } from "@/lib/slide-export";
import { ResourceContentViewer } from "@/components/ResourceContentViewer";
import { SlideViewer } from "@/components/SlideViewer";
import { AvisoContenidoIA } from "@/components/AvisoContenidoIA";
import { CampoObservacion } from "@/components/CampoObservacion";
import { useCatalogo } from "@/hooks/useCatalogo";
import { HistorialModulo, type RecursoHistorial } from "@/components/HistorialModulo";
import { DialogoEditarRecurso } from "@/components/DialogoEditarRecurso";
import { ExportOptionsDialog } from "@/components/ExportOptionsDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { SLIDE_PALETTES, getPaletteById, type StructuredSlide } from "@/lib/slide-types";
import {
  Sparkles, Upload, FileText, Loader2, Download, Save, Eye, EyeOff,
  ClipboardList, Table2, FileCheck, FileEdit, Server, Cloud,
  GraduationCap, BookMarked, Beaker, AlertCircle, Pencil, Presentation, Palette, FilePlus,
} from "lucide-react";

const RESOURCE_TYPES = [
  { value: "icfes", label: "Exámenes", icon: FileCheck },
  { value: "workshop", label: "Taller", icon: FileEdit },
  { value: "slides", label: "Diapositivas", icon: Presentation },
  { value: "lesson_plan", label: "Plan de clase", icon: ClipboardList },
  { value: "rubric", label: "Rúbrica", icon: Table2 },
];

/**
 * Nivel de exigencia del examen. Lo decide el docente, no el sistema: puede
 * querer un diagnóstico sencillo al inicio del tema y una prueba exigente al
 * cierre, sobre el mismo contenido.
 */
const COMPLEXITY_LEVELS = [
  { value: "basico", label: "Básico", desc: "Reconocer e identificar. Para diagnóstico o inicio de tema" },
  { value: "intermedio", label: "Intermedio", desc: "Interpretar y aplicar en situaciones conocidas" },
  { value: "avanzado", label: "Avanzado", desc: "Analizar, comparar y resolver situaciones nuevas" },
  { value: "icfes", label: "Como prueba Saber 11", desc: "Mezcla los tres niveles, igual que la prueba oficial" },
];

const EXAM_TYPES = [
  { value: "icfes", label: "Tipo ICFES", desc: "Selección múltiple con única respuesta" },
  { value: "true_false", label: "Falso y Verdadero", desc: "Preguntas con opción V/F" },
  { value: "mixed", label: "Mixto", desc: "Combina ICFES y Falso/Verdadero" },
];

const RUBRIC_TYPES = [
  { value: "analitica", label: "Rúbrica Analítica" },
  { value: "holistica", label: "Rúbrica Holística" },
  { value: "verificacion", label: "Lista de Verificación" },
  { value: "escalar", label: "Rúbrica Escalar" },
  { value: "puntos", label: "Rúbrica de Puntos" },
  { value: "otro", label: "Otro" },
];

const PERFORMANCE_LEVELS = [
  { value: "3", label: "3 niveles" },
  { value: "4", label: "4 niveles" },
  { value: "5", label: "5 niveles" },
  { value: "custom", label: "Personalizado" },
];

const RESOURCE_FIELDS: Record<string, string[]> = {
  icfes: ["numItems", "examType", "examComplexity"],
  workshop: ["methodology", "duration"],
  slides: ["numSlides"],
  lesson_plan: ["methodology", "duration"],
  rubric: ["rubricType", "performanceLevels", "rubricObjective"],
};

export default function GenerateResource() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const typeParam = searchParams.get("type");
  const recursoParam = searchParams.get("recurso");

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
  const [numItems, setNumItems] = useState<number | "">(10);
  const [examType, setExamType] = useState("icfes");
  const [examComplexity, setExamComplexity] = useState("icfes");
  const [numSlides, setNumSlides] = useState<number | "">(8);
  const [slidePalette, setSlidePalette] = useState<string>("academic");

  // Rubric fields
  const [rubricType, setRubricType] = useState("analitica");
  const [customRubricType, setCustomRubricType] = useState("");
  const [performanceLevels, setPerformanceLevels] = useState("4");
  const [customLevelCount, setCustomLevelCount] = useState(4);
  const [customLevelNames, setCustomLevelNames] = useState<string[]>([]);
  const [rubricObjective, setRubricObjective] = useState("");

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileText, setFileText] = useState("");
  const [extractingFile, setExtractingFile] = useState(false);

  // AI engine
  const [aiProvider, setAiProvider] = useState<"openai" | "ollama">("openai");
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [ollamaModel, setOllamaModel] = useState("llama3");
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [exportDialog, setExportDialog] = useState<null | "pdf" | "docx">(null);
  // Id del recurso en la base de datos. Se llena solo al generar (guardado
  // automatico) o al abrir uno del historial lateral. Mientras exista, guardar
  // actualiza ese registro en vez de crear un duplicado.
  const [recursoId, setRecursoId] = useState<string | null>(null);

  // Los mantiene el administrador desde el panel: el asesor pidio que
  // agregar una metodologia nueva no exigiera tocar el codigo.
  const SUBJECTS = useCatalogo("asignatura");
  const METHODOLOGIES = useCatalogo("metodologia");

  const extraFields = useMemo(() => RESOURCE_FIELDS[resourceType] || [], [resourceType]);

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
    if (recursoParam) return; // lo carga el efecto de abajo
    setGeneratedContent(null);
    setIsEditing(false);
    setRecursoId(null);
  }, [typeParam, recursoParam]);

  // Llegar con ?recurso=<id> abre ese recurso listo para modificarlo. Es el
  // camino desde el historial general: "si les quedo faltando algo, tienen
  // dos opciones: volver a crearla o modificarla".
  useEffect(() => {
    if (!recursoParam || !user || recursoId === recursoParam) return;
    let cancelado = false;
    (async () => {
      const { data, error } = await (supabase as any)
        .from("generated_resources")
        .select("*")
        .eq("id", recursoParam)
        .eq("user_id", user.id)
        .single();
      if (cancelado) return;
      if (error || !data) {
        toast.error("No se encontró ese recurso");
        setSearchParams({ type: typeParam || "icfes" }, { replace: true });
        return;
      }
      abrirDelHistorial(data as RecursoHistorial);
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recursoParam, user]);

  useEffect(() => {
    if (aiProvider === "ollama") {
      fetchOllamaModels(ollamaUrl).then(setOllamaModels);
    }
  }, [aiProvider, ollamaUrl]);

  // Custom level names management
  useEffect(() => {
    if (performanceLevels === "custom") {
      setCustomLevelNames(prev => {
        const arr = [...prev];
        while (arr.length < customLevelCount) arr.push("");
        return arr.slice(0, customLevelCount);
      });
    }
  }, [customLevelCount, performanceLevels]);

  const extractTextFromFile = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "pdf") {
      return await extractTextFromPDF(file);
    } else if (ext === "txt") {
      return await file.text();
    } else if (ext === "docx" || ext === "doc") {
      try {
        const text = await file.text();
        if (text && !text.includes('\0')) return text;
      } catch {}
      toast.info("Para archivos Word, se recomienda usar formato .txt o .pdf para mejores resultados");
      return await file.text();
    }
    return await file.text();
  };

  const handleFileUpload = useCallback(async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    const allowed = ["pdf", "txt", "docx", "doc"];
    if (!allowed.includes(ext || "")) {
      toast.error("Solo se permiten archivos PDF, Word (.docx) o texto (.txt)");
      return;
    }

    setUploadedFile(file);
    setExtractingFile(true);
    try {
      const text = await extractTextFromFile(file);
      setFileText(text);
      toast.success(`Archivo procesado: ${text.length} caracteres extraídos`);
    } catch (e: any) {
      // Si no se pudo leer el archivo, se retira: dejarlo visible hacía creer
      // al docente que el recurso se generaría a partir de él.
      setUploadedFile(null);
      setFileText("");
      toast.error(e.message || "No se pudo procesar el archivo", { duration: 12000 });
    } finally {
      setExtractingFile(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const validate = (): boolean => {
    const errors: string[] = [];
    if (!tema.trim()) errors.push("El tema es obligatorio");
    if (!subject) errors.push("La asignatura es obligatoria");
    if (subject === "Otras" && !customSubject.trim()) errors.push("Escribe la asignatura personalizada");
    if (methodology === "Otras" && extraFields.includes("methodology") && !customMethodology.trim()) {
      errors.push("Escribe la metodología personalizada");
    }
    if (resourceType === "rubric" && rubricType === "otro" && !customRubricType.trim()) {
      errors.push("Escribe el tipo de rúbrica personalizado");
    }
    setValidationErrors(errors);
    return errors.length === 0;
  };

  const getResolvedLevels = (): string[] => {
    if (performanceLevels === "3") return ["Excelente", "Aceptable", "Insuficiente"];
    if (performanceLevels === "4") return ["Excelente", "Bueno", "Aceptable", "Insuficiente"];
    if (performanceLevels === "5") return ["Excelente", "Sobresaliente", "Bueno", "Aceptable", "Insuficiente"];
    if (performanceLevels === "custom") return customLevelNames.filter(n => n.trim());
    return ["Excelente", "Bueno", "Aceptable", "Insuficiente"];
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
    if (resourceType === "icfes" && examType) {
      const examLabel = EXAM_TYPES.find(t => t.value === examType)?.label || examType;
      parts.push(`Tipo de examen: ${examLabel}`);
      const nivel = COMPLEXITY_LEVELS.find(c => c.value === examComplexity);
      if (nivel) parts.push(`Nivel de complejidad: ${nivel.label}. ${nivel.desc}`);
    }
    if (resourceType === "rubric") {
      const resolvedRubricType = rubricType === "otro" ? customRubricType : RUBRIC_TYPES.find(r => r.value === rubricType)?.label || rubricType;
      parts.push(`Tipo de rúbrica: ${resolvedRubricType}`);
      const levels = getResolvedLevels();
      parts.push(`Niveles de desempeño: ${levels.join(", ")}`);
      if (rubricObjective) parts.push(`Objetivo/Competencia a evaluar: ${rubricObjective}`);
    }
    if (resourceType === "slides") {
      parts.push(`Número de diapositivas: ${numSlides || 8}`);
    }
    if (instructions.trim()) {
      parts.push(`Instrucciones adicionales: ${instructions}`);
    }
    return parts.join("\n");
  };

  const getEffectiveResourceType = (): string => {
    if (resourceType === "icfes") {
      return examType === "true_false" ? "true_false" : examType === "mixed" ? "mixed" : "icfes";
    }
    return resourceType;
  };

  const handleGenerate = async () => {
    if (!user) return;
    if (!validate()) return;

    setGenerating(true);
    setGeneratedContent(null);
    setIsEditing(false);

    try {
      const effectiveType = getEffectiveResourceType();
      const palette = resourceType === "slides" ? getPaletteById(slidePalette) : null;
      const params: any = {
        resourceType: effectiveType,
        pdfContent: fileText || undefined,
        instructions: buildInstructions() + (palette ? `\nPaleta de colores: ${palette.name} - ${palette.description}` : ""),
        numItems: resourceType === "slides" ? (numSlides || 8) : (numItems || 10),
      };
      if (palette) params.theme = palette.theme;

      let result;
      if (aiProvider === "openai") {
        result = await generateWithOpenAI(params);
      } else {
        result = await generateWithOllama(params, ollamaUrl, ollamaModel);
      }

      if (!title && result.title) setTitle(result.title);
      setGeneratedContent(result);
      setRecursoId(null);

      // Se guarda solo: hasta ahora, si el docente cerraba la pestana o se le
      // caia la conexion perdia el recurso y el costo de la generacion.
      const guardado = await persistirRecurso(result, null);
      if (guardado) {
        setRecursoId(guardado);
        toast.success("Recurso generado y guardado en tu historial");
      } else {
        toast.success("Recurso generado. No se pudo guardar solo; usa el boton Guardar.");
      }
    } catch (e: any) {
      toast.error(e.message || "Error al generar el recurso");
    } finally {
      setGenerating(false);
    }
  };

  /**
   * Escribe el recurso en la base de datos y devuelve su id, o null si
   * fallo. Si recibe un id actualiza ese registro; si no, crea uno nuevo.
   * Separado de handleSave para poder reutilizarlo en el guardado
   * automatico sin arrastrar los avisos ni el estado del boton.
   */
  const persistirRecurso = async (
    contenido: any,
    id: string | null,
    tituloExplicito?: string,
  ): Promise<string | null> => {
    if (!user || !contenido) return null;
    try {
      let sourcePdfUrl: string | null = null;
      if (uploadedFile && !id) {
        const filePath = `${user.id}/${Date.now()}_${uploadedFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("resource-pdfs")
          .upload(filePath, uploadedFile);
        if (!uploadError) sourcePdfUrl = filePath;
      }

      const datos: Record<string, any> = {
        title: tituloExplicito?.trim() || title || contenido.title || "Recurso sin título",
        resource_type: resourceType,
        content: contenido,
        is_public: isPublic,
        // Se guardan como columnas, no solo dentro del contenido, para poder
        // filtrar y agrupar los recursos por asignatura y grado.
        subject: (subject === "Otras" ? customSubject : subject)?.trim() || null,
        grade: grade || null,
      };
      if (sourcePdfUrl) datos.source_pdf_url = sourcePdfUrl;

      if (id) {
        const { error } = await (supabase as any).from("generated_resources")
          .update(datos).eq("id", id);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["generated_resources", user.id] });
        return id;
      }

      const { data, error } = await (supabase as any).from("generated_resources")
        .insert({ user_id: user.id, ...datos }).select("id").single();
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["generated_resources", user.id] });
      return data?.id ?? null;
    } catch (e: any) {
      console.error("No se pudo guardar el recurso:", e);
      return null;
    }
  };

  const handleSave = async () => {
    if (!user || !generatedContent) return;
    setSaving(true);
    const id = await persistirRecurso(generatedContent, recursoId);
    if (id) {
      setRecursoId(id);
      toast.success(recursoId ? "Cambios guardados" : "Recurso guardado en tu historial");
    } else {
      toast.error("No se pudo guardar el recurso");
    }
    setSaving(false);
  };

  /** Carga en el visor un recurso de la franja lateral. */
  /**
   * Abre un recurso de la franja lateral directamente en el panel de edición.
   *
   * Pulsar un recurso del historial es, casi siempre, querer retocarlo: para
   * verlo tal cual ya está el visor de la página, que es lo que queda debajo
   * al cerrar el panel.
   */
  const abrirDelHistorial = (r: RecursoHistorial) => {
    setRecursoId(r.id);
    setTitle(r.title);
    setIsPublic(r.is_public);
    setGeneratedContent(r.content);
    if (r.subject) setSubject(SUBJECTS.includes(r.subject) ? r.subject : "Otras");
    if (r.subject && !SUBJECTS.includes(r.subject)) setCustomSubject(r.subject);
    if (r.grade) setGrade(r.grade);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setIsEditing(true);
  };

  /** Vacia el visor para empezar un recurso nuevo sin recargar la pagina. */
  const empezarNuevo = () => {
    if (recursoParam) setSearchParams({ type: resourceType }, { replace: true });
    setRecursoId(null);
    setGeneratedContent(null);
    setIsEditing(false);
    setTitle("");
  };
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

  // El visor de la página siempre muestra lo guardado. La edición vive en su
  // propio panel y solo escribe aquí cuando el docente guarda.
  const displayContent = generatedContent;

  return (
    // El formulario a la izquierda y la franja con lo ya creado a la derecha,
    // como se acordo en la reunion: cada modulo muestra su propio historial en
    // vez de mandar al docente al historial general.
    <div className="max-w-7xl mx-auto animate-fade-in grid gap-6 items-start lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6 min-w-0">
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
              <Label>Tema <span className="text-destructive">*</span></Label>
              <Input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Ej: La fotosíntesis, Ecuaciones cuadráticas..." />
            </div>
            <div className="space-y-2">
              <Label>Título (opcional)</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Se generará automáticamente" />
            </div>
          </div>

          {/* Row 2: Asignatura + Nivel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Asignatura <span className="text-destructive">*</span></Label>
              <Select value={subject} onValueChange={(v) => { setSubject(v); if (v !== "Otras") setCustomSubject(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecciona una asignatura" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {SUBJECTS.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                  <SelectItem value="Otras">Otras</SelectItem>
                </SelectContent>
              </Select>
              {subject === "Otras" && (
                <Input value={customSubject} onChange={(e) => setCustomSubject(e.target.value)} placeholder="Escribe la asignatura" className="mt-2" />
              )}
            </div>
            <div className="space-y-2">
              <Label>Nivel educativo <span className="text-destructive">*</span></Label>
              <div className="flex items-center gap-3">
                <GraduationCap className="h-5 w-5 text-muted-foreground shrink-0" />
                <Select value={grade} onValueChange={setGrade}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {Array.from({ length: 11 }, (_, i) => i + 1).map((g) => (
                      <SelectItem key={g} value={String(g)}>Grado {g} — {g <= 5 ? "Primaria" : "Secundaria"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Exam Type */}
          {resourceType === "icfes" && (
            <div className="space-y-2">
              <Label>Tipo de examen <span className="text-destructive">*</span></Label>
              <Select value={examType} onValueChange={setExamType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXAM_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label} — {t.desc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Nivel de complejidad: lo decide el docente según el momento del tema */}
          {resourceType === "icfes" && (
            <div className="space-y-2">
              <Label>Nivel de complejidad <span className="text-destructive">*</span></Label>
              <Select value={examComplexity} onValueChange={setExamComplexity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMPLEXITY_LEVELS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label} — {c.desc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Puedes aplicar un examen básico al inicio del tema y uno avanzado al cierre,
                para comparar el avance del grupo.
              </p>
            </div>
          )}

          {/* Rubric-specific fields */}
          {resourceType === "rubric" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de rúbrica <span className="text-destructive">*</span></Label>
                  <Select value={rubricType} onValueChange={setRubricType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RUBRIC_TYPES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {rubricType === "otro" && (
                    <Input value={customRubricType} onChange={(e) => setCustomRubricType(e.target.value)} placeholder="Describe el tipo de rúbrica" className="mt-2" />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Niveles de desempeño</Label>
                  <Select value={performanceLevels} onValueChange={setPerformanceLevels}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PERFORMANCE_LEVELS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {performanceLevels === "custom" && (
                <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                    <Label className="text-sm">Cantidad de niveles:</Label>
                    <Input
                      type="number"
                      min={2}
                      max={10}
                      value={customLevelCount}
                      onChange={(e) => setCustomLevelCount(Math.max(2, Math.min(10, parseInt(e.target.value) || 2)))}
                      className="w-20"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Array.from({ length: customLevelCount }, (_, i) => (
                      <Input
                        key={i}
                        value={customLevelNames[i] || ""}
                        onChange={(e) => {
                          const updated = [...customLevelNames];
                          updated[i] = e.target.value;
                          setCustomLevelNames(updated);
                        }}
                        placeholder={`Nivel ${i + 1}`}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Objetivo o criterios específicos (opcional)</Label>
                <Textarea value={rubricObjective} onChange={(e) => setRubricObjective(e.target.value)} placeholder="Describe el objetivo de aprendizaje o criterios particulares que debe considerar la rúbrica..." rows={2} />
              </div>
            </>
          )}

          {/* Slides: number + palette */}
          {resourceType === "slides" && (
            <>
              <div className="space-y-2">
                <Label>Número de diapositivas</Label>
                <Input
                  type="number"
                  min={3}
                  max={20}
                  value={numSlides}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") return setNumSlides("");
                    const n = parseInt(v);
                    if (!Number.isNaN(n)) setNumSlides(n);
                  }}
                  onBlur={() => {
                    if (numSlides === "" || (typeof numSlides === "number" && numSlides < 3)) setNumSlides(8);
                    else if (typeof numSlides === "number" && numSlides > 20) setNumSlides(20);
                  }}
                  placeholder="8"
                  className="w-32"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-primary" /> Paleta de colores
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {SLIDE_PALETTES.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSlidePalette(p.id)}
                      className={`text-left p-3 rounded-lg border-2 transition-all ${
                        slidePalette === p.id
                          ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div className="flex gap-1 mb-2">
                        {p.preview.map((c, i) => (
                          <div key={i} className="h-6 w-6 rounded-md border border-border/50" style={{ background: c }} />
                        ))}
                      </div>
                      <div className="text-sm font-medium text-foreground">{p.name}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">{p.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Methodology */}
          {extraFields.includes("methodology") && (
            <div className="space-y-2">
              <Label>Metodología</Label>
              <Select value={methodology} onValueChange={(v) => { setMethodology(v); if (v !== "Otras") setCustomMethodology(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecciona una metodología" /></SelectTrigger>
                <SelectContent>
                  {METHODOLOGIES.map((m) => (<SelectItem key={m} value={m}>{m}</SelectItem>))}
                  <SelectItem value="Otras">Otras</SelectItem>
                </SelectContent>
              </Select>
              {methodology === "Otras" && (
                <Input value={customMethodology} onChange={(e) => setCustomMethodology(e.target.value)} placeholder="Escribe la metodología" className="mt-2" />
              )}
            </div>
          )}

          {/* Duration */}
          {extraFields.includes("duration") && (
            <div className="space-y-2">
              <Label>Duración</Label>
              <Input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Ej: 2 horas, 45 minutos" />
            </div>
          )}

          {/* Number of items */}
          {extraFields.includes("numItems") && (
            <div className="space-y-2">
              <Label>Número de preguntas</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={numItems}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") return setNumItems("");
                  const n = parseInt(v);
                  if (!Number.isNaN(n)) setNumItems(n);
                }}
                onBlur={() => {
                  if (numItems === "" || (typeof numItems === "number" && numItems < 1)) setNumItems(10);
                  else if (typeof numItems === "number" && numItems > 50) setNumItems(50);
                }}
                placeholder="10"
                className="w-32"
              />
            </div>
          )}

          {/* Additional instructions */}
          <div className="space-y-2">
            <Label>Instrucciones adicionales (opcional)</Label>
            <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Ej: Incluye preguntas de análisis, agrega ejemplos prácticos..." rows={3} />
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>Archivo fuente (opcional) — PDF, Word o TXT</Label>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer border-border hover:border-primary/50"
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept=".pdf,.docx,.doc,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
              {extractingFile ? (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Procesando archivo...</span>
                </div>
              ) : uploadedFile ? (
                <div className="flex items-center justify-center gap-2 text-primary">
                  <FileText className="h-5 w-5" />
                  <span className="font-medium">{uploadedFile.name}</span>
                  <span className="text-xs text-muted-foreground">({fileText.length} caracteres)</span>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Arrastra un archivo aquí o haz clic para seleccionar</p>
                  <p className="text-xs text-muted-foreground">Formatos: PDF, Word (.docx), Texto (.txt)</p>
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
              <Button variant={aiProvider === "openai" ? "default" : "outline"} size="sm" onClick={() => setAiProvider("openai")} className={aiProvider === "openai" ? "gradient-primary" : ""}>
                <Cloud className="h-4 w-4 mr-1" /> OpenAI
              </Button>
              <Button variant={aiProvider === "ollama" ? "default" : "outline"} size="sm" onClick={() => setAiProvider("ollama")} className={aiProvider === "ollama" ? "gradient-primary" : ""}>
                <Server className="h-4 w-4 mr-1" /> Ollama (Local)
              </Button>
            </div>

            {aiProvider === "ollama" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <div className="space-y-1">
                  <Label className="text-xs">URL de Ollama</Label>
                  <Input value={ollamaUrl} onChange={(e) => setOllamaUrl(e.target.value)} placeholder="http://localhost:11434" className="text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Modelo</Label>
                  {ollamaModels.length > 0 ? (
                    <Select value={ollamaModel} onValueChange={setOllamaModel}>
                      <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{ollamaModels.map((m) => (<SelectItem key={m} value={m}>{m}</SelectItem>))}</SelectContent>
                    </Select>
                  ) : (
                    <Input value={ollamaModel} onChange={(e) => setOllamaModel(e.target.value)} placeholder="llama3" className="text-sm" />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Generate Button */}
          <Button className="w-full gradient-primary text-lg py-6" onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Generando recurso...</>
            ) : (
              <><Sparkles className="h-5 w-5 mr-2" />Generar con IA</>
            )}
          </Button>
        </div>

        {/* Generated Content */}
        {generatedContent && (
          <div className="glass-card rounded-xl overflow-hidden animate-fade-in">
            <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
              <h2 className="font-semibold text-foreground text-lg">
                {displayContent?.title || title || "Recurso generado"}
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-2 mr-3">
                  {isPublic ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                  <Label className="text-xs cursor-pointer" htmlFor="public-toggle">{isPublic ? "Público" : "Privado"}</Label>
                  <Switch id="public-toggle" checked={isPublic} onCheckedChange={setIsPublic} />
                </div>
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  <Pencil className="h-4 w-4 mr-1" /> Editar
                </Button>
                <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4 mr-1" />
                  {saving ? "Guardando..." : recursoId ? "Guardar cambios" : "Guardar"}
                </Button>
                {recursoId && (
                  <Button variant="outline" size="sm" onClick={empezarNuevo}>
                    <FilePlus className="h-4 w-4 mr-1" /> Nuevo
                  </Button>
                )}
                {resourceType === "slides" ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => exportSlidesToPptx(displayContent)}>
                      <Download className="h-4 w-4 mr-1" /> PPTX
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => exportSlidesToPdf(displayContent)}>
                      <Download className="h-4 w-4 mr-1" /> PDF
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setExportDialog("docx")}>
                      <Download className="h-4 w-4 mr-1" /> Word
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setExportDialog("pdf")}>
                      <Download className="h-4 w-4 mr-1" /> PDF
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <AvisoContenidoIA meta={displayContent?._meta} />
              </div>
              {/* Solo lectura: la edición vive en su propio panel, y dejar
                  los dos editables a la vez llevaría a que cada uno pisara
                  los cambios del otro. */}
              {resourceType === "slides" ? (
                <SlideViewer
                  slides={displayContent?.slides || []}
                  title={displayContent?.title}
                  theme={displayContent?.theme}
                />
              ) : (
                <ResourceContentViewer type={resourceType} content={displayContent} />
              )}
            </div>
          </div>
        )}

        {/* La edición ocupa su propio panel: antes se abría debajo del recurso
          y el docente tenía que desplazarse para encontrar los campos. */}
      {isEditing && generatedContent && (
        <DialogoEditarRecurso
          // La copia de trabajo se crea al montar. Sin la clave, abrir otro
          // recurso del historial reutilizaría el componente y seguiría
          // mostrando el contenido del anterior.
          key={recursoId ?? "nuevo"}
          abierto
          onCerrar={() => setIsEditing(false)}
          tipo={resourceType}
          contenidoOriginal={generatedContent}
          tituloOriginal={title || generatedContent?.title || ""}
          onGuardar={async (contenido, nuevoTitulo) => {
            const id = await persistirRecurso(contenido, recursoId, nuevoTitulo);
            if (!id) { toast.error("No se pudieron guardar los cambios"); return false; }
            setRecursoId(id);
            setTitle(nuevoTitulo);
            setGeneratedContent(contenido);
            toast.success("Cambios guardados");
            return true;
          }}
        />
      )}

      {exportDialog && resourceType !== "slides" && (
          <ExportOptionsDialog
            open={!!exportDialog}
            onOpenChange={(o) => !o && setExportDialog(null)}
            format={exportDialog}
            onConfirm={async (opts) => {
              const name = displayContent?.title || title || "Recurso";
              if (exportDialog === "docx") await exportToDocx(name, resourceType, displayContent, opts);
              else await exportToPdf(name, resourceType, displayContent, opts);
            }}
          />
        )}

        {/* El módulo se identifica por el tipo de recurso, para poder analizar
            después qué sección concentra más observaciones. */}
        <div className="mt-6">
          <CampoObservacion modulo={resourceType} />
        </div>
      </div>

      <HistorialModulo
        tipos={[resourceType]}
        onAbrir={abrirDelHistorial}
        activo={recursoId}
        titulo={`${currentType?.label || "Recursos"} anteriores`}
      />
    </div>
  );
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s-]/g, "").trim().replace(/\s+/g, "_").substring(0, 50);
}
