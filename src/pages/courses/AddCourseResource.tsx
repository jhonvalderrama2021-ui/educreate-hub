import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Plus, Search, ChevronDown, FileCheck, FileEdit, ClipboardList,
  Table2, Presentation, Puzzle, BookText, HelpCircle, BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { avisarError } from "@/lib/errores";

/** Etiqueta e icono por tipo de recurso, para agrupar la lista. */
const TIPOS: Record<string, { label: string; icon: any }> = {
  icfes: { label: "Exámenes", icon: FileCheck },
  quiz: { label: "Cuestionarios", icon: HelpCircle },
  true_false: { label: "Exámenes de falso y verdadero", icon: FileCheck },
  mixed: { label: "Exámenes mixtos", icon: FileCheck },
  workshop: { label: "Talleres", icon: FileEdit },
  guide: { label: "Guías", icon: BookOpen },
  lesson_plan: { label: "Planes de clase", icon: ClipboardList },
  rubric: { label: "Rúbricas", icon: Table2 },
  slides: { label: "Diapositivas", icon: Presentation },
  crossword: { label: "Crucigramas", icon: Puzzle },
  story: { label: "Cuentos", icon: BookText },
};

const etiquetaTipo = (t: string) => TIPOS[t]?.label || t;

export default function AddCourseResource() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [filtroAsignatura, setFiltroAsignatura] = useState("all");
  const [filtroGrado, setFiltroGrado] = useState("all");
  const [adding, setAdding] = useState<string | null>(null);
  const [grupoAbierto, setGrupoAbierto] = useState<string | null>(null);

  const { data: resources = [] } = useQuery({
    queryKey: ["my_resources_for_course", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_resources").select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: assigned = [] } = useQuery({
    queryKey: ["course_resources_ids", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_resources").select("resource_id").eq("course_id", courseId!);
      if (error) throw error;
      return (data || []).map((d: any) => d.resource_id) as string[];
    },
  });

  const disponibles = resources.filter((r) => !assigned.includes(r.id));

  // Los selectores se arman con lo que el docente realmente tiene
  const asignaturas = [...new Set(disponibles.map((r) => r.subject).filter(Boolean))].sort() as string[];
  const grados = [...new Set(disponibles.map((r) => r.grade).filter(Boolean))].sort() as string[];

  const filtered = disponibles.filter((r) =>
    (search === "" || r.title.toLowerCase().includes(search.toLowerCase())) &&
    (filtroAsignatura === "all" || r.subject === filtroAsignatura) &&
    (filtroGrado === "all" || r.grade === filtroGrado)
  );

  // Agrupados por tipo: con veinte exámenes y treinta planes de clase, la
  // lista plana obliga a desplazarse sin control para encontrar uno.
  const grupos = filtered.reduce((acc: Record<string, any[]>, r) => {
    (acc[r.resource_type] ||= []).push(r);
    return acc;
  }, {});
  const tiposPresentes = Object.keys(grupos).sort((a, b) =>
    etiquetaTipo(a).localeCompare(etiquetaTipo(b), "es"));

  const hayFiltros = search !== "" || filtroAsignatura !== "all" || filtroGrado !== "all";

  const addToCourse = async (r: any) => {
    setAdding(r.id);
    try {
      const { error } = await supabase.from("course_resources").insert({
        course_id: courseId!,
        resource_id: r.id,
        resource_type: r.resource_type,
        title: r.title,
      });
      if (error) throw error;
      toast.success("Recurso agregado");
      qc.invalidateQueries({ queryKey: ["course_resources", courseId] });
      qc.invalidateQueries({ queryKey: ["course_resources_ids", courseId] });
    } catch (e: any) {
      avisarError(e, "No se pudo agregar el recurso al curso");
    } finally { setAdding(null); }
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-6">
      <button
        onClick={() => navigate(`/resources/courses/${courseId}`)}
        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        <ArrowLeft className="h-4 w-4" /> Volver al curso
      </button>

      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Agregar recurso al curso</h1>
        <p className="text-sm text-muted-foreground">
          Tus recursos aparecen agrupados por tipo. Abre el grupo que necesites
          o usa los filtros para acotar la búsqueda.
        </p>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            aria-label="Buscar recurso por título"
            placeholder="Buscar por título..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {(asignaturas.length > 0 || grados.length > 0) && (
          <div className="flex flex-wrap items-end gap-3">
            {asignaturas.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="filtro-asignatura" className="text-xs">Asignatura</Label>
                <Select value={filtroAsignatura} onValueChange={setFiltroAsignatura}>
                  <SelectTrigger id="filtro-asignatura" className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {asignaturas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {grados.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="filtro-grado" className="text-xs">Grado</Label>
                <Select value={filtroGrado} onValueChange={setFiltroGrado}>
                  <SelectTrigger id="filtro-grado" className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {grados.map((g) => <SelectItem key={g} value={g}>Grado {g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {hayFiltros && (
              <Button
                variant="ghost" size="sm"
                onClick={() => { setSearch(""); setFiltroAsignatura("all"); setFiltroGrado("all"); }}
              >
                Limpiar filtros
              </Button>
            )}
            <p className="ml-auto text-sm text-muted-foreground">
              {filtered.length} disponible{filtered.length === 1 ? "" : "s"}
            </p>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
          {resources.length === 0
            ? "No tienes recursos generados. Crea uno en la sección de Recursos."
            : hayFiltros
            ? "Ningún recurso coincide con los filtros aplicados."
            : "Todos tus recursos ya están agregados a este curso."}
        </div>
      ) : (
        <div className="space-y-2">
          {tiposPresentes.map((tipo) => {
            const items = grupos[tipo];
            const Icono = TIPOS[tipo]?.icon || FileEdit;
            // Con filtros activos conviene mostrar todo abierto: el docente ya acotó
            const abierto = hayFiltros || grupoAbierto === tipo || tiposPresentes.length === 1;

            return (
              <div key={tipo} className="border border-border rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setGrupoAbierto(abierto && !hayFiltros ? null : tipo)}
                  aria-expanded={abierto}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/40 transition-colors"
                >
                  <Icono className="h-5 w-5 shrink-0 text-primary" />
                  <span className="flex-1 font-medium text-foreground">{etiquetaTipo(tipo)}</span>
                  <span className="text-sm text-muted-foreground">{items.length}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${abierto ? "rotate-180" : ""}`}
                  />
                </button>

                {abierto && (
                  <div className="border-t border-border divide-y divide-border">
                    {items.map((r) => (
                      <div key={r.id} className="p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-foreground line-clamp-1">{r.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {r.subject && `${r.subject} · `}
                            {r.grade && `Grado ${r.grade} · `}
                            {new Date(r.created_at).toLocaleDateString("es-CO")}
                          </div>
                        </div>
                        <Button size="sm" disabled={adding === r.id} onClick={() => addToCourse(r)}>
                          <Plus className="h-4 w-4 mr-1" />Agregar
                        </Button>
                      </div>
                    ))}
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
