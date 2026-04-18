import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { exportToDocx, exportToPdf } from "@/lib/export-resource";
import { ExportOptionsDialog } from "@/components/ExportOptionsDialog";
import { StoryViewer } from "@/components/games/StoryViewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { BookOpen, Sparkles, Loader2, Download, Save, RefreshCcw } from "lucide-react";

export interface StoryChapter {
  title: string;
  text: string;
  imageUrl: string | null;
}

export interface StoryContent {
  title: string;
  moral: string | null;
  coverImageUrl: string | null;
  chapters: StoryChapter[];
  character: string | null;
  characterType: string | null;
}

export default function Story() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [character, setCharacter] = useState("");
  const [characterType, setCharacterType] = useState("humano");
  const [theme, setTheme] = useState("");
  const [ageGroup, setAgeGroup] = useState("niños de 6-10 años");
  const [length, setLength] = useState("medio");
  const [generating, setGenerating] = useState(false);
  const [content, setContent] = useState<StoryContent | null>(null);
  const [exportFormat, setExportFormat] = useState<"pdf" | "docx" | null>(null);

  const handleGenerate = async () => {
    if (!title.trim()) {
      toast.error("Indica un título");
      return;
    }
    setGenerating(true);
    toast.info("Generando cuento e ilustraciones... esto puede tardar 20-40 segundos");
    try {
      const { data, error } = await supabase.functions.invoke("generate-story", {
        body: { title, character, characterType, theme, ageGroup, length },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setContent(data as StoryContent);
      toast.success("Cuento generado");
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
      title: `Cuento: ${content.title}`,
      resource_type: "story",
      content,
    });
    if (error) toast.error("Error al guardar");
    else {
      queryClient.invalidateQueries({ queryKey: ["generated_resources", user.id] });
      toast.success("Guardado en historial");
    }
  };

  return (
    <div className="max-w-5xl mx-auto animate-fade-in space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center">
          <BookOpen className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Crear Cuento Ilustrado</h1>
          <p className="text-sm text-muted-foreground">Genera cuentos con IA e ilustraciones automáticas</p>
        </div>
      </div>

      <div className="glass-card rounded-xl p-6 space-y-4">
        <div className="space-y-2">
          <Label>Título del cuento *</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: La luciérnaga que quería volar al sol" />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Personaje principal (opcional)</Label>
            <Input value={character} onChange={(e) => setCharacter(e.target.value)} placeholder="Ej: Luna, Pedro, Tobi" />
          </div>
          <div className="space-y-2">
            <Label>Tipo de personaje</Label>
            <Select value={characterType} onValueChange={setCharacterType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="humano">Niño/a (humano)</SelectItem>
                <SelectItem value="animal">Animal</SelectItem>
                <SelectItem value="ser fantástico">Ser fantástico</SelectItem>
                <SelectItem value="objeto animado">Objeto animado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Edad del público</Label>
            <Select value={ageGroup} onValueChange={setAgeGroup}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="niños de 3-5 años">3-5 años</SelectItem>
                <SelectItem value="niños de 6-10 años">6-10 años</SelectItem>
                <SelectItem value="niños de 11-14 años">11-14 años</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Longitud</Label>
            <Select value={length} onValueChange={setLength}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="corto">Corto</SelectItem>
                <SelectItem value="medio">Medio</SelectItem>
                <SelectItem value="largo">Largo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Temática (opcional)</Label>
            <Input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="Amistad, valentía..." />
          </div>
        </div>

        <Button onClick={handleGenerate} disabled={generating} className="w-full gradient-primary">
          {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generando cuento e imágenes...</> : <><Sparkles className="h-4 w-4 mr-2" /> Generar cuento</>}
        </Button>
      </div>

      {content && (
        <div className="glass-card rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-semibold text-foreground">{content.title}</h2>
            <div className="flex flex-wrap gap-2">
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
          <StoryViewer content={content} />
        </div>
      )}

      {exportFormat && content && (
        <ExportOptionsDialog
          open={!!exportFormat}
          onOpenChange={(o) => !o && setExportFormat(null)}
          format={exportFormat}
          onConfirm={async (opts) => {
            const t = `Cuento: ${content.title}`;
            if (exportFormat === "docx") await exportToDocx(t, "story", content, opts);
            else await exportToPdf(t, "story", content, opts);
          }}
        />
      )}
    </div>
  );
}
