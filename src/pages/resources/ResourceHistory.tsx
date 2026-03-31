import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { exportToDocx, exportToPdf } from "@/lib/export-resource";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  History, Download, Trash2, Eye, EyeOff, ChevronDown, ChevronUp,
  FileCheck, HelpCircle, FileEdit, BookOpen, ClipboardList, Table2,
} from "lucide-react";
import { ResourceContentViewer } from "@/components/ResourceContentViewer";

const TYPE_LABELS: Record<string, { label: string; icon: any }> = {
  icfes: { label: "Examen ICFES", icon: FileCheck },
  quiz: { label: "Cuestionario", icon: HelpCircle },
  workshop: { label: "Taller", icon: FileEdit },
  guide: { label: "Guía", icon: BookOpen },
  lesson_plan: { label: "Plan de clase", icon: ClipboardList },
  rubric: { label: "Rúbrica", icon: Table2 },
};

interface Resource {
  id: string;
  title: string;
  resource_type: string;
  content: any;
  is_public: boolean;
  created_at: string;
}

export default function ResourceHistory() {
  const { user } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadResources();
  }, [user, filter]);

  const loadResources = async () => {
    setLoading(true);
    let query = (supabase as any)
      .from("generated_resources")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });

    if (filter !== "all") query = query.eq("resource_type", filter);

    const { data, error } = await query;
    if (error) toast.error("Error al cargar el historial");
    setResources(data || []);
    setLoading(false);
  };

  const togglePublic = async (id: string, isPublic: boolean) => {
    const { error } = await (supabase as any)
      .from("generated_resources")
      .update({ is_public: !isPublic })
      .eq("id", id);

    if (error) { toast.error("Error al actualizar"); return; }
    setResources((prev) =>
      prev.map((r) => (r.id === id ? { ...r, is_public: !isPublic } : r))
    );
  };

  const deleteResource = async (id: string) => {
    if (!confirm("¿Eliminar este recurso?")) return;
    const { error } = await (supabase as any)
      .from("generated_resources")
      .delete()
      .eq("id", id);

    if (error) { toast.error("Error al eliminar"); return; }
    setResources((prev) => prev.filter((r) => r.id !== id));
    toast.success("Recurso eliminado");
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center">
          <History className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Historial de Recursos</h1>
          <p className="text-sm text-muted-foreground">Tus recursos generados con IA</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Label className="text-sm">Filtrar:</Label>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : resources.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No hay recursos guardados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {resources.map((r) => {
            const typeInfo = TYPE_LABELS[r.resource_type] || { label: r.resource_type, icon: FileEdit };
            const Icon = typeInfo.icon;
            const isExpanded = expanded === r.id;

            return (
              <div key={r.id} className="glass-card rounded-xl overflow-hidden">
                <div
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : r.id)}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Icon className="h-5 w-5 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{r.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {typeInfo.label} · {new Date(r.created_at).toLocaleDateString("es-CO")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => { e.stopPropagation(); togglePublic(r.id, r.is_public); }}
                    >
                      {r.is_public ? <Eye className="h-3.5 w-3.5 text-primary" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                      <Switch checked={r.is_public} className="scale-75" />
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border p-4 space-y-3">
                    <div className="flex gap-2 flex-wrap">
                      <Button variant="outline" size="sm" onClick={() => exportToDocx(r.title, r.resource_type, r.content)}>
                        <Download className="h-3.5 w-3.5 mr-1" /> Word
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => exportToPdf(r.title, r.resource_type, r.content)}>
                        <Download className="h-3.5 w-3.5 mr-1" /> PDF
                      </Button>
                      <Button variant="outline" size="sm" className="text-destructive" onClick={() => deleteResource(r.id)}>
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar
                      </Button>
                    </div>
                    <pre className="text-xs bg-muted/30 p-3 rounded-lg overflow-auto max-h-60">
                      {JSON.stringify(r.content, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
