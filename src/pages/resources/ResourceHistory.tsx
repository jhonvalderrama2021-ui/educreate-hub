import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { exportToDocx, exportToPdf } from "@/lib/export-resource";
import { exportSlidesToPdf, exportSlidesToPptx } from "@/lib/slide-export";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  History, Download, Trash2, Eye, EyeOff, ChevronDown, ChevronUp,
  FileCheck, HelpCircle, FileEdit, BookOpen, ClipboardList, Table2, Presentation, Puzzle, BookText,
} from "lucide-react";
import { ResourceContentViewer } from "@/components/ResourceContentViewer";
import { ExportOptionsDialog } from "@/components/ExportOptionsDialog";
import { AvisoContenidoIA } from "@/components/AvisoContenidoIA";
import { CampoObservacion } from "@/components/CampoObservacion";

const TYPE_LABELS: Record<string, { label: string; icon: any }> = {
  icfes: { label: "Examen ICFES", icon: FileCheck },
  quiz: { label: "Cuestionario", icon: HelpCircle },
  workshop: { label: "Taller", icon: FileEdit },
  guide: { label: "Guía", icon: BookOpen },
  lesson_plan: { label: "Plan de clase", icon: ClipboardList },
  rubric: { label: "Rúbrica", icon: Table2 },
  slides: { label: "Diapositivas", icon: Presentation },
  crossword: { label: "Crucigrama", icon: Puzzle },
  story: { label: "Cuento", icon: BookText },
};

interface Resource {
  id: string;
  title: string;
  resource_type: string;
  content: any;
  is_public: boolean;
  created_at: string;
  subject: string | null;
  grade: string | null;
}

const RESOURCES_QK = (uid?: string) => ["generated_resources", uid] as const;

export default function ResourceHistory() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [filtroAsignatura, setFiltroAsignatura] = useState("all");
  const [filtroGrado, setFiltroGrado] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [exportTarget, setExportTarget] = useState<{ resource: Resource; format: "pdf" | "docx" } | null>(null);

  // Cached query — instantly shows previous data when navigating back
  const { data: allResources = [], isLoading, isFetching } = useQuery({
    queryKey: RESOURCES_QK(user?.id),
    enabled: !!user,
    staleTime: 10_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("generated_resources")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Resource[];
    },
  });

  // Realtime: refresh cache the instant a resource is added/updated/deleted
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`generated_resources-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "generated_resources", filter: `user_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey: RESOURCES_QK(user.id) }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  // Valores disponibles, tomados de los recursos que el docente ya tiene
  const asignaturas = [...new Set(allResources.map((r) => r.subject).filter(Boolean))].sort() as string[];
  const grados = [...new Set(allResources.map((r) => r.grade).filter(Boolean))].sort() as string[];

  const resources = allResources.filter((r) =>
    (filter === "all" || r.resource_type === filter) &&
    (filtroAsignatura === "all" || r.subject === filtroAsignatura) &&
    (filtroGrado === "all" || r.grade === filtroGrado));
  // Only show full-screen spinner on first load (no cache yet)
  const loading = isLoading && allResources.length === 0;

  const togglePublic = async (id: string, isPublic: boolean) => {
    queryClient.setQueryData<Resource[]>(RESOURCES_QK(user?.id), (prev) =>
      (prev || []).map((r) => (r.id === id ? { ...r, is_public: !isPublic } : r)),
    );
    const { error } = await (supabase as any)
      .from("generated_resources")
      .update({ is_public: !isPublic })
      .eq("id", id);
    if (error) {
      toast.error("Error al actualizar");
      queryClient.invalidateQueries({ queryKey: RESOURCES_QK(user?.id) });
    }
  };

  const deleteResource = async (id: string) => {
    if (!confirm("¿Eliminar este recurso?")) return;
    const prev = queryClient.getQueryData<Resource[]>(RESOURCES_QK(user?.id));
    queryClient.setQueryData<Resource[]>(RESOURCES_QK(user?.id), (cur) =>
      (cur || []).filter((r) => r.id !== id),
    );
    const { error } = await (supabase as any)
      .from("generated_resources")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Error al eliminar");
      queryClient.setQueryData(RESOURCES_QK(user?.id), prev);
      return;
    }
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

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Tipo de recurso</Label>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {asignaturas.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs">Asignatura</Label>
            <Select value={filtroAsignatura} onValueChange={setFiltroAsignatura}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {asignaturas.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {grados.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs">Grado</Label>
            <Select value={filtroGrado} onValueChange={setFiltroGrado}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {grados.map((g) => (
                  <SelectItem key={g} value={g}>Grado {g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {(filter !== "all" || filtroAsignatura !== "all" || filtroGrado !== "all") && (
          <Button
            variant="ghost" size="sm"
            onClick={() => { setFilter("all"); setFiltroAsignatura("all"); setFiltroGrado("all"); }}
          >
            Limpiar filtros
          </Button>
        )}

        <p className="ml-auto text-sm text-muted-foreground">
          {resources.length} de {allResources.length}
        </p>
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
                        {typeInfo.label}
                        {r.subject && ` · ${r.subject}`}
                        {r.grade && ` · Grado ${r.grade}`}
                        {" · "}{new Date(r.created_at).toLocaleDateString("es-CO")}
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
                      {r.resource_type === "slides" ? (
                        <>
                          <Button variant="outline" size="sm" onClick={() => exportSlidesToPptx(r.content)}>
                            <Download className="h-3.5 w-3.5 mr-1" /> PPTX
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => exportSlidesToPdf(r.content)}>
                            <Download className="h-3.5 w-3.5 mr-1" /> PDF
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="outline" size="sm" onClick={() => setExportTarget({ resource: r, format: "docx" })}>
                            <Download className="h-3.5 w-3.5 mr-1" /> Word
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setExportTarget({ resource: r, format: "pdf" })}>
                            <Download className="h-3.5 w-3.5 mr-1" /> PDF
                          </Button>
                        </>
                      )}
                      <Button variant="outline" size="sm" className="text-destructive" onClick={() => deleteResource(r.id)}>
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar
                      </Button>
                    </div>
                    <div className="mb-3">
                      <AvisoContenidoIA meta={(r.content as any)?._meta} />
                    </div>
                    <div className={r.resource_type === "slides" ? "" : "bg-muted/10 p-4 rounded-lg overflow-auto max-h-[500px]"}>
                      <ResourceContentViewer type={r.resource_type} content={r.content} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {exportTarget && (
        <ExportOptionsDialog
          open={!!exportTarget}
          onOpenChange={(o) => !o && setExportTarget(null)}
          format={exportTarget.format}
          onConfirm={async (opts) => {
            const { resource, format } = exportTarget;
            if (format === "docx") await exportToDocx(resource.title, resource.resource_type, resource.content, opts);
            else await exportToPdf(resource.title, resource.resource_type, resource.content, opts);
          }}
        />
      )}
      <div className="mt-6">
        <CampoObservacion modulo="historial" />
      </div>
    </div>
  );
}
