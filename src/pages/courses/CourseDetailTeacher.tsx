import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Plus, Trash2, Settings, Users, FileText, Copy, UserPlus, FileCheck, Puzzle, BookText, FileEdit, Presentation, ClipboardList, Table2, CopyPlus,
} from "lucide-react";
import { toast } from "sonner";
import { generateAccessCode } from "@/lib/courses-types";
import type { CourseResource, MiniCourse, ResourceSubmission } from "@/lib/courses-types";
import { PanelEstudiantesCurso } from "@/components/PanelEstudiantesCurso";

const TYPE_ICON: Record<string, any> = {
  icfes: FileCheck, quiz: FileCheck, workshop: FileEdit,
  lesson_plan: ClipboardList, rubric: Table2, slides: Presentation,
  crossword: Puzzle, story: BookText,
};
const EVALUABLE = ["icfes", "quiz", "crossword"];

export default function CourseDetailTeacher() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: course } = useQuery({
    queryKey: ["mini_course", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("mini_courses").select("*").eq("id", courseId).single();
      if (error) throw error;
      return data as MiniCourse;
    },
  });

  const { data: resources = [] } = useQuery({
    queryKey: ["course_resources", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("course_resources").select("*").eq("course_id", courseId)
        .order("position", { ascending: true }).order("created_at", { ascending: true });
      if (error) throw error;
      return data as CourseResource[];
    },
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["enrollments", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("course_enrollments").select("id, student_id, enrolled_at")
        .eq("course_id", courseId);
      if (error) throw error;
      const ids = (data || []).map((d: any) => d.student_id);
      if (ids.length === 0) return [] as any[];
      const { data: profiles } = await (supabase as any)
        .from("profiles").select("id, full_name, email").in("id", ids);
      const map = new Map((profiles || []).map((p: any) => [p.id, p]));
      return (data || []).map((d: any) => ({ ...d, profile: map.get(d.student_id) }));
    },
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ["submissions_course", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("resource_submissions").select("*").eq("course_id", courseId)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data as ResourceSubmission[];
    },
  });

  // Los enunciados viven en el recurso generado, no en la entrega: hacen
  // falta para que la exportacion incluya que se pregunto en cada punto.
  const { data: contenidos = {} } = useQuery({
    queryKey: ["contenidos_curso", courseId, resources.map((r) => r.resource_id).join(",")],
    enabled: resources.length > 0,
    queryFn: async () => {
      const ids = [...new Set(resources.map((r) => r.resource_id))];
      const { data } = await (supabase as any)
        .from("generated_resources").select("id, content").in("id", ids);
      return Object.fromEntries((data || []).map((r: any) => [r.id, r.content])) as Record<string, any>;
    },
  });

  const removeResource = async (id: string) => {
    if (!confirm("¿Quitar este recurso del curso?")) return;
    const { error } = await (supabase as any).from("course_resources").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Recurso eliminado");
    qc.invalidateQueries({ queryKey: ["course_resources", courseId] });
  };

  const updateCourse = async (patch: Partial<MiniCourse>) => {
    const { error } = await (supabase as any).from("mini_courses").update(patch).eq("id", courseId);
    if (error) { toast.error(error.message); return; }
    toast.success("Curso actualizado");
    qc.invalidateQueries({ queryKey: ["mini_course", courseId] });
  };

  const deleteCourse = async () => {
    if (!confirm("Esto eliminará el curso y todas sus inscripciones, recursos y entregas. ¿Continuar?")) return;
    const { error } = await (supabase as any).from("mini_courses").delete().eq("id", courseId);
    if (error) { toast.error(error.message); return; }
    toast.success("Curso eliminado");
    navigate("/resources/courses");
  };

  const copyCode = () => {
    if (!course) return;
    navigator.clipboard.writeText(course.access_code);
    toast.success("Clave copiada");
  };

  if (!course) return <div className="p-8 text-muted-foreground">Cargando…</div>;

  return (
    <div className="max-w-6xl mx-auto animate-fade-in space-y-6">
      <button onClick={() => navigate("/resources/courses")} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Volver
      </button>

      <div className="glass-card rounded-xl p-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2 flex-wrap">
            {course.name}
            {(course.grado || course.grupo) && (
              <span className="text-sm font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded">
                {course.grado ? `${course.grado}°` : ""}{course.grupo || ""}
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{course.description || "Sin descripción"}</p>
          <button onClick={copyCode} className="mt-3 inline-flex items-center gap-2 text-xs font-mono bg-primary/10 text-primary px-3 py-1.5 rounded hover:bg-primary/20 transition-colors">
            Clave: {course.access_code} <Copy className="h-3 w-3" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <BotonDuplicarGrupo curso={course} recursos={resources.length} />
          <CourseSettingsButton course={course} onUpdate={updateCourse} onDelete={deleteCourse} />
        </div>
      </div>

      <Tabs defaultValue="resources">
        <TabsList>
          <TabsTrigger value="resources"><FileText className="h-4 w-4 mr-2" />Recursos</TabsTrigger>
          <TabsTrigger value="students"><Users className="h-4 w-4 mr-2" />Estudiantes ({enrollments.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="resources" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={() => navigate(`/resources/courses/${courseId}/add-resource`)} className="gradient-primary">
              <Plus className="h-4 w-4 mr-2" />Agregar recurso
            </Button>
          </div>
          {resources.length === 0 ? (
            <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
              Sin recursos asignados todavía.
            </div>
          ) : (
            <div className="space-y-2">
              {resources.map((r) => {
                const Icon = TYPE_ICON[r.resource_type] || FileText;
                return (
                  <div key={r.id} className="glass-card rounded-lg p-4 flex items-center gap-3">
                    <Icon className="h-5 w-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground line-clamp-1">{r.title}</div>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        <span>{r.resource_type}</span>
                        {EVALUABLE.includes(r.resource_type) && (
                          <>
                            <span>Intentos: {r.max_attempts}</span>
                            {r.time_limit_minutes && <span>Tiempo: {r.time_limit_minutes}min</span>}
                            <span>{r.show_grade ? "Muestra nota" : "Oculta nota"}</span>
                            <span>{r.show_feedback ? "Con retro" : "Sin retro"}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <ResourceConfigButton resource={r} onSaved={() => qc.invalidateQueries({ queryKey: ["course_resources", courseId] })} />
                    <Button variant="ghost" size="icon" onClick={() => removeResource(r.id)} className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="students" className="space-y-4 mt-4">
          <ManualEnrollButton courseId={courseId!} onAdded={() => qc.invalidateQueries({ queryKey: ["enrollments", courseId] })} />

          {enrollments.length === 0 ? (
            <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
              Sin estudiantes inscritos. Comparte la clave <span className="font-mono">{course.access_code}</span>.
            </div>
          ) : (
            /* En cuadrícula y no en tabla: con treinta estudiantes y cinco
               actividades, una fila por entrega son ciento cincuenta filas
               donde no se distingue quién va al día y quién no ha entrado. */
            <PanelEstudiantesCurso
              courseId={courseId!}
              nombreCurso={course.name}
              inscripciones={enrollments}
              recursos={resources}
              entregas={submissions}
              contenidos={contenidos}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CourseSettingsButton({ course, onUpdate, onDelete }: {
  course: MiniCourse;
  onUpdate: (p: Partial<MiniCourse>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(course.name);
  const [description, setDescription] = useState(course.description || "");
  const [active, setActive] = useState(course.is_active);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Settings className="h-4 w-4 mr-2" />Configurar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Configuración del curso</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Curso activo</Label>
              <p className="text-xs text-muted-foreground">Si está inactivo, nadie nuevo puede inscribirse</p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>
        <DialogFooter className="flex justify-between sm:justify-between">
          <Button variant="destructive" onClick={async () => { await onDelete(); setOpen(false); }}>
            <Trash2 className="h-4 w-4 mr-2" />Eliminar
          </Button>
          <Button className="gradient-primary" onClick={async () => {
            await onUpdate({ name, description, is_active: active }); setOpen(false);
          }}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResourceConfigButton({ resource, onSaved }: { resource: CourseResource; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [r, setR] = useState(resource);
  const isExam = EVALUABLE.includes(resource.resource_type);

  const save = async () => {
    const { error } = await (supabase as any).from("course_resources").update({
      show_grade: r.show_grade, show_feedback: r.show_feedback,
      max_attempts: r.max_attempts, time_limit_minutes: r.time_limit_minutes,
      opens_at: r.opens_at, closes_at: r.closes_at, shuffle_questions: r.shuffle_questions,
    }).eq("id", resource.id);
    if (error) return toast.error(error.message);
    toast.success("Configuración guardada");
    onSaved(); setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon"><Settings className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Configurar recurso</DialogTitle></DialogHeader>
        {isExam ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Mostrar nota al estudiante</Label>
              <Switch checked={r.show_grade} onCheckedChange={(v) => setR({ ...r, show_grade: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Mostrar retroalimentación</Label>
              <Switch checked={r.show_feedback} onCheckedChange={(v) => setR({ ...r, show_feedback: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Orden aleatorio de preguntas</Label>
              <Switch checked={r.shuffle_questions} onCheckedChange={(v) => setR({ ...r, shuffle_questions: v })} />
            </div>
            <div className="space-y-2">
              <Label>Número de intentos</Label>
              <Input type="number" min={1} value={r.max_attempts} onChange={(e) => setR({ ...r, max_attempts: parseInt(e.target.value) || 1 })} />
            </div>
            <div className="space-y-2">
              <Label>Tiempo límite (minutos, vacío = sin límite)</Label>
              <Input type="number" min={0} value={r.time_limit_minutes ?? ""} onChange={(e) => setR({ ...r, time_limit_minutes: e.target.value ? parseInt(e.target.value) : null })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Apertura</Label>
                <Input type="datetime-local" value={r.opens_at ? r.opens_at.slice(0, 16) : ""} onChange={(e) => setR({ ...r, opens_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
              </div>
              <div className="space-y-2">
                <Label>Cierre</Label>
                <Input type="datetime-local" value={r.closes_at ? r.closes_at.slice(0, 16) : ""} onChange={(e) => setR({ ...r, closes_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Este tipo de recurso no requiere configuración de evaluación.</p>
        )}
        <DialogFooter>
          <Button onClick={save} className="gradient-primary">Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManualEnrollButton({ courseId, onAdded }: { courseId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const enroll = async () => {
    if (!email.trim()) return;
    setSaving(true);
    try {
      // Se resuelve el correo mediante una función del servidor: consultar
      // `profiles` directamente devolvía cero filas al docente, porque solo
      // puede ver su propio perfil.
      const { data: estudianteId, error: pErr } = await (supabase as any)
        .rpc("buscar_usuario_por_correo", { _correo: email.trim() });
      if (pErr) throw pErr;

      if (!estudianteId) {
        toast.error(
          "No hay ninguna cuenta registrada con ese correo. El estudiante debe crear su cuenta antes de que puedas inscribirlo.",
          { duration: 8000 },
        );
        return;
      }

      const { error } = await (supabase as any).from("course_enrollments").insert({
        course_id: courseId, student_id: estudianteId,
      });
      if (error) {
        if (/duplicate key|unique/i.test(error.message)) {
          toast.error("Ese estudiante ya está inscrito en el curso");
          return;
        }
        throw error;
      }
      toast.success("Estudiante inscrito");
      setEmail(""); setOpen(false); onAdded();
    } catch (e: any) {
      toast.error(e.message || "Error al inscribir");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><UserPlus className="h-4 w-4 mr-2" />Inscribir manualmente</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Inscribir estudiante</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Label>Email del estudiante</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="estudiante@correo.com" />
          <p className="text-xs text-muted-foreground">El usuario debe tener cuenta en la plataforma.</p>
        </div>
        <DialogFooter>
          <Button onClick={enroll} disabled={saving} className="gradient-primary">Inscribir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Duplica el curso para otro grupo del mismo grado.
 *
 * "En los colegios hay sexto A, sexto B, sexto C". Sin esto, el docente que
 * dicta la misma materia a tres grupos tiene que crear tres cursos y volver
 * a agregar los mismos recursos uno por uno.
 */
function BotonDuplicarGrupo({ curso, recursos }: { curso: MiniCourse; recursos: number }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const [grupo, setGrupo] = useState("");
  const [clave, setClave] = useState(generateAccessCode());
  const [duplicando, setDuplicando] = useState(false);

  const duplicar = async () => {
    if (!grupo.trim()) return toast.error("Indica el grupo del curso nuevo");
    setDuplicando(true);
    const { data, error } = await (supabase as any).rpc("duplicar_curso_para_grupo", {
      p_curso_id: curso.id,
      p_grupo: grupo.trim().toUpperCase(),
      p_clave: clave.trim().toUpperCase(),
    });
    setDuplicando(false);
    if (error) return toast.error(error.message || "No se pudo duplicar");

    toast.success("Curso duplicado");
    qc.invalidateQueries({ queryKey: ["mini_courses_own"] });
    setAbierto(false);
    navigate(`/resources/courses/${data}`);
  };

  return (
    <Dialog open={abierto} onOpenChange={(o) => { setAbierto(o); if (o) setClave(generateAccessCode()); }}>
      <DialogTrigger asChild>
        <Button variant="outline"><CopyPlus className="h-4 w-4 mr-2" />Otro grupo</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Duplicar para otro grupo</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Se crea un curso nuevo con el mismo nombre, la misma descripción y
            los mismos {recursos} recurso{recursos === 1 ? "" : "s"}. Los
            estudiantes NO se copian: cada grupo se inscribe con su propia clave.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="nuevo-grupo">Grupo</Label>
              <Input
                id="nuevo-grupo"
                value={grupo}
                onChange={(e) => setGrupo(e.target.value.toUpperCase())}
                maxLength={10}
                placeholder={curso.grupo === "A" ? "B" : "A, B, C..."}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nueva-clave">Clave de acceso</Label>
              <Input
                id="nueva-clave"
                value={clave}
                onChange={(e) => setClave(e.target.value.toUpperCase())}
                className="font-mono uppercase"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Las fechas de apertura y cierre no se copian: casi nunca coinciden
            entre grupos y una fecha heredada podría cerrar el curso nuevo sin
            que lo notes.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>Cancelar</Button>
          <Button className="gradient-primary" onClick={duplicar} disabled={duplicando}>
            {duplicando ? "Duplicando..." : "Duplicar curso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

