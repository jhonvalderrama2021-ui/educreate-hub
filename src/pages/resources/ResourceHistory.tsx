import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { exportToDocx, exportToPdf } from "@/lib/export-resource";
import { exportSlidesToPdf, exportSlidesToPptx } from "@/lib/slide-export";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  History, Download, Trash2, Eye, EyeOff, ChevronDown, ChevronUp, Pencil,
  FileCheck, HelpCircle, FileEdit, BookOpen, ClipboardList, Table2, Presentation, Puzzle, BookText,
  Search,
} from "lucide-react";
import { ResourceContentViewer } from "@/components/ResourceContentViewer";
import { ExportOptionsDialog } from "@/components/ExportOptionsDialog";
import { AvisoContenidoIA } from "@/components/AvisoContenidoIA";
import { BorrarRecurso } from "@/components/BorrarRecurso";
import { CampoObservacion } from "@/components/CampoObservacion";
import { rutaDelRecurso } from "@/lib/ruta-modulo";
import { FiltroMultiple, opcionesDe } from "@/components/FiltroMultiple";
import { avisarError } from "@/lib/errores";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { leerRecientes, guardarReciente, olvidarRecientes } from "@/lib/busquedas-recientes";
import { normalizar } from "@/lib/buscar-ayuda";

/** Clave del historial de busquedas en el navegador. */
const CLAVE_BUSQUEDAS = "nexprofe:busquedas:historial";

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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Selección múltiple: un docente que dicta la misma materia en varios
  // grados tenía que mirar sus recursos de a un grado por vez.
  const [tipos, setTipos] = useState<string[]>([]);
  const [asignaturasSel, setAsignaturasSel] = useState<string[]>([]);
  const [gradosSel, setGradosSel] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  /** Últimas búsquedas, para no reescribir lo mismo cada semana. */
  const [recientes, setRecientes] = useState<string[]>(() => leerRecientes(CLAVE_BUSQUEDAS));

  // Se guarda cuando el docente deja de escribir, no en cada tecla: si no,
  // el historial se llenaría de "f", "fr", "fra"…
  useEffect(() => {
    const t = setTimeout(() => {
      if (busqueda.trim().length >= 2) setRecientes(guardarReciente(CLAVE_BUSQUEDAS, busqueda));
    }, 1200);
    return () => clearTimeout(t);
  }, [busqueda]);
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
      const { data, error } = await supabase
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

  // Las opciones salen de lo que el docente realmente tiene, con el conteo
  // de cada una: un catálogo fijo mostraría asignaturas vacías.
  const opcionesTipo = opcionesDe(allResources, (r) => r.resource_type,
    (v) => TYPE_LABELS[v]?.label || v);
  const opcionesAsignatura = opcionesDe(allResources, (r) => r.subject);
  const opcionesGrado = opcionesDe(allResources, (r) => r.grade, (g) => `Grado ${g}`);

  const hayFiltros =
    tipos.length > 0 || asignaturasSel.length > 0 || gradosSel.length > 0 || busqueda.trim() !== "";

  // Sin nada marcado no se filtra: la lista muestra todo, que es lo que
  // espera quien abre la pantalla por primera vez.
  const texto = normalizar(busqueda);
  const resources = allResources.filter((r) =>
    (tipos.length === 0 || tipos.includes(r.resource_type)) &&
    (asignaturasSel.length === 0 || (r.subject && asignaturasSel.includes(r.subject))) &&
    (gradosSel.length === 0 || (r.grade && gradosSel.includes(r.grade))) &&
    (texto === "" || normalizar(
      `${r.title} ${r.subject ?? ""} ${r.grade ?? ""} ${TYPE_LABELS[r.resource_type]?.label ?? r.resource_type}`,
    ).includes(texto)));

  // Only show full-screen spinner on first load (no cache yet)
  const loading = isLoading && allResources.length === 0;

  const togglePublic = async (id: string, isPublic: boolean) => {
    queryClient.setQueryData<Resource[]>(RESOURCES_QK(user?.id), (prev) =>
      (prev || []).map((r) => (r.id === id ? { ...r, is_public: !isPublic } : r)),
    );
    const { error } = await supabase
      .from("generated_resources")
      .update({ is_public: !isPublic })
      .eq("id", id);
    if (error) {
      avisarError(error, "No se pudo cambiar la visibilidad del recurso");
      queryClient.invalidateQueries({ queryKey: RESOURCES_QK(user?.id) });
    }
  };

  /*
   * El borrado vive en BorrarRecurso, que antes de preguntar averigua si el
   * recurso esta puesto en algun curso.
   *
   * Aqui se hacia con un confirm seco de una linea. El problema es lo que
   * arrastra: las llaves de la base encadenan recurso -> fila del curso ->
   * entregas, asi que borrar un examen ya aplicado borraba tambien las notas
   * de los estudiantes, sin decirlo y sin vuelta atras.
   */

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

      {/* Búsqueda por texto. Los filtros de arriba solo sirven si el docente
          recuerda la asignatura o el grado; quien busca "fracciones" no tenía
          por dónde empezar. La lista de recientes evita reescribir lo mismo. */}
      <div className="space-y-1.5">
        <Label htmlFor="buscar-recurso" className="sr-only">
          Buscar entre tus recursos
        </Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            id="buscar-recurso"
            type="search"
            list="busquedas-recientes"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Busca por título, asignatura, grado o módulo…"
            className="pl-9"
            autoComplete="off"
          />
          {/* Sugerencias nativas: funcionan con teclado y en el móvil sin
              componente extra, y el navegador las anuncia al lector de pantalla. */}
          <datalist id="busquedas-recientes">
            {recientes.map((r) => <option key={r} value={r} />)}
          </datalist>
        </div>
        {recientes.length > 0 && !busqueda && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Búsquedas recientes:</span>
            {recientes.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setBusqueda(r)}
                className="text-xs rounded-full border border-border px-2 py-0.5 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {r}
              </button>
            ))}
            <button
              type="button"
              onClick={() => { olvidarRecientes(CLAVE_BUSQUEDAS); setRecientes([]); }}
              className="text-xs text-muted-foreground underline hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              Borrar
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FiltroMultiple
          etiqueta="Módulo"
          opciones={opcionesTipo}
          seleccion={tipos}
          onCambio={setTipos}
          className="w-[210px]"
        />
        <FiltroMultiple
          etiqueta="Asignatura"
          opciones={opcionesAsignatura}
          seleccion={asignaturasSel}
          onCambio={setAsignaturasSel}
          className="w-[210px]"
        />
        <FiltroMultiple
          etiqueta="Grado"
          opciones={opcionesGrado}
          seleccion={gradosSel}
          onCambio={setGradosSel}
          className="w-[170px]"
        />

        {hayFiltros && (
          <Button
            variant="ghost" size="sm"
            onClick={() => { setTipos([]); setAsignaturasSel([]); setGradosSel([]); setBusqueda(""); }}
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
          {/* Distinguir "no tienes nada" de "tu filtro no encontró nada" evita
              que el docente crea que perdió sus recursos. */}
          {hayFiltros ? (
            <>
              <p>Ningún recurso coincide con lo que buscas.</p>
              <Button
                variant="link" size="sm"
                onClick={() => { setTipos([]); setAsignaturasSel([]); setGradosSel([]); setBusqueda(""); }}
              >
                Quitar los filtros y ver todo
              </Button>
            </>
          ) : (
            <p>Todavía no has guardado ningún recurso.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {resources.map((r) => {
            const typeInfo = TYPE_LABELS[r.resource_type] || { label: r.resource_type, icon: FileEdit };
            const Icon = typeInfo.icon;
            const isExpanded = expanded === r.id;

            return (
              <div key={r.id} className="glass-card rounded-xl overflow-hidden">
                {/* La fila ya no es un <div> con onClick. Antes el encabezado no
                    recibia el foco y el interruptor tenia `checked` sin manejador:
                    con el teclado no se podia abrir un recurso ni cambiar su
                    visibilidad, aunque el interruptor pareciera responder.
                    Son dos controles independientes, asi que no pueden anidarse. */}
                <div className="p-4 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
                  <button
                    type="button"
                    onClick={() => setExpanded(isExpanded ? null : r.id)}
                    aria-expanded={isExpanded}
                    aria-controls={`recurso-${r.id}`}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
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
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1">
                      {r.is_public ? <Eye className="h-3.5 w-3.5 text-primary" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                      <Switch
                        checked={r.is_public}
                        onCheckedChange={() => togglePublic(r.id, r.is_public)}
                        aria-label={`Compartir «${r.title}» con otros docentes`}
                        className="scale-75"
                      />
                    </div>
                    {/* Mismo efecto que el boton del titulo. Se mantiene
                        clicable, pero fuera del recorrido de tabulacion para no
                        repetir la parada de teclado. */}
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-hidden="true"
                      onClick={() => setExpanded(isExpanded ? null : r.id)}
                      className="text-muted-foreground"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div id={`recurso-${r.id}`} className="border-t border-border p-4 space-y-3">
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
                      <Button
                        variant="outline" size="sm"
                        onClick={() => navigate(rutaDelRecurso(r.resource_type, r.id))}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                      </Button>
                      <BorrarRecurso
                        recursoId={r.id}
                        titulo={r.title}
                        claveCache={RESOURCES_QK(user?.id)}
                        modo="boton"
                      />
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
