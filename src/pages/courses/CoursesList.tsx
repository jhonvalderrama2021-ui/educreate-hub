import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { GraduationCap, Plus, KeyRound, Users, BookOpen, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { generateAccessCode, type MiniCourse } from "@/lib/courses-types";
import { CampoObservacion } from "@/components/CampoObservacion";

export default function CoursesList() {
  const { user } = useAuth();
  const { isDocente } = useUserRole();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [openCreate, setOpenCreate] = useState(false);
  const [openJoin, setOpenJoin] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [grado, setGrado] = useState("");
  const [grupo, setGrupo] = useState("");
  const [code, setCode] = useState(generateAccessCode());
  const [joinCode, setJoinCode] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: ownCourses = [] } = useQuery({
    queryKey: ["mini_courses_own", user?.id],
    enabled: !!user && isDocente,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mini_courses")
        .select("*")
        .eq("teacher_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as MiniCourse[];
    },
  });

  const { data: enrolled = [] } = useQuery({
    queryKey: ["mini_courses_enrolled", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_enrollments")
        .select("course_id, mini_courses(*)")
        .eq("student_id", user!.id);
      if (error) throw error;
      return (data || []).map((r) => r.mini_courses).filter(Boolean) as MiniCourse[];
    },
  });

  /**
   * Cursos agrupados por grado. Un docente con 6A, 6B, 6C, 7A y 7B ve dos
   * bloques en vez de cinco tarjetas sueltas, que era la queja del asesor.
   * Los cursos sin grado quedan al final, no se pierden.
   */
  const gruposPorGrado = (() => {
    const mapa = new Map<string, MiniCourse[]>();
    for (const c of ownCourses) {
      const clave = c.grado ? `Grado ${c.grado}` : "Sin grado";
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave)!.push(c);
    }
    return [...mapa.entries()].sort(([a], [b]) => {
      if (a === "Sin grado") return 1;
      if (b === "Sin grado") return -1;
      return parseInt(a.replace(/D/g, "")) - parseInt(b.replace(/D/g, ""));
    }).map(([etiqueta, cursos]) => [
      etiqueta,
      // Dentro del grado, por grupo: 6A antes que 6B
      [...cursos].sort((x, y) => (x.grupo || "").localeCompare(y.grupo || "", "es")),
    ] as [string, MiniCourse[]]);
  })();

  const handleCreate = async () => {
    if (!name.trim()) return toast.error("Coloca un nombre al curso");
    setSaving(true);
    try {
      const { data, error } = await supabase.from("mini_courses").insert({
        teacher_id: user!.id,
        name: name.trim(),
        description: description.trim() || null,
        access_code: code.trim().toUpperCase(),
        // Como columnas y no dentro del nombre: asi la lista puede agrupar
        // 6A, 6B y 6C, que era la observacion del asesor.
        grado: grado || null,
        grupo: grupo.trim().toUpperCase() || null,
      }).select().single();
      if (error) throw error;
      toast.success("Curso creado");
      queryClient.invalidateQueries({ queryKey: ["mini_courses_own", user!.id] });
      setOpenCreate(false);
      setName(""); setDescription(""); setGrado(""); setGrupo(""); setCode(generateAccessCode());
      navigate(`/resources/courses/${data.id}`);
    } catch (e: any) {
      toast.error(e.message || "Error al crear curso");
    } finally { setSaving(false); }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return toast.error("Ingresa la clave del curso");
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("join_course_by_code", {
        _code: joinCode.trim().toUpperCase(),
      });
      if (error) throw error;
      toast.success("¡Inscripción exitosa!");
      queryClient.invalidateQueries({ queryKey: ["mini_courses_enrolled", user!.id] });
      setOpenJoin(false); setJoinCode("");
      navigate(`/resources/courses/${data}/student`);
    } catch (e: any) {
      toast.error(e.message || "Clave inválida");
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-5xl mx-auto animate-fade-in space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Mini Cursos</h1>
            <p className="text-sm text-muted-foreground">Crea cursos, asigna recursos y haz seguimiento</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={openJoin} onOpenChange={setOpenJoin}>
            <DialogTrigger asChild>
              <Button variant="outline"><KeyRound className="h-4 w-4 mr-2" />Unirme con clave</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Unirme a un curso</DialogTitle></DialogHeader>
              <div className="space-y-2">
                <Label>Clave de acceso</Label>
                <Input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="Ej: ABC123" />
              </div>
              <DialogFooter>
                <Button onClick={handleJoin} disabled={saving} className="gradient-primary">Unirme</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {isDocente && (
            <Dialog open={openCreate} onOpenChange={setOpenCreate}>
              <DialogTrigger asChild>
                <Button className="gradient-primary"><Plus className="h-4 w-4 mr-2" />Nuevo curso</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Crear mini curso</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nombre</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Matemáticas 8°" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="curso-grado">Grado</Label>
                      <Select value={grado} onValueChange={setGrado}>
                        <SelectTrigger id="curso-grado">
                          <SelectValue placeholder="Sin grado" />
                        </SelectTrigger>
                        <SelectContent className="max-h-64">
                          {Array.from({ length: 11 }, (_, i) => String(i + 1)).map((g) => (
                            <SelectItem key={g} value={g}>Grado {g}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="curso-grupo">Grupo</Label>
                      <Input
                        id="curso-grupo"
                        value={grupo}
                        onChange={(e) => setGrupo(e.target.value.toUpperCase())}
                        maxLength={10}
                        placeholder="A, B, C..."
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Descripción (opcional)</Label>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                  </div>
                  <div className="space-y-2">
                    <Label>Clave de acceso</Label>
                    <div className="flex gap-2">
                      <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="font-mono uppercase" />
                      <Button type="button" variant="outline" size="icon" onClick={() => setCode(generateAccessCode())}>
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Compártela con tus estudiantes para que se inscriban</p>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleCreate} disabled={saving} className="gradient-primary">Crear</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {isDocente && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Mis cursos</h2>
          {ownCourses.length === 0 ? (
            <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
              Aún no has creado ningún curso. Haz click en "Nuevo curso" para empezar.
            </div>
          ) : (
            <div className="space-y-6">
              {gruposPorGrado.map(([etiqueta, cursos]) => (
                <div key={etiqueta} className="space-y-3">
                  {gruposPorGrado.length > 1 && (
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {etiqueta} · {cursos.length} curso{cursos.length === 1 ? "" : "s"}
                    </h3>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {cursos.map((c) => (
                      <button key={c.id} onClick={() => navigate(`/resources/courses/${c.id}`)}
                        className="glass-card rounded-xl p-5 text-left hover:border-primary/40 transition-colors">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <BookOpen className="h-5 w-5 text-primary" />
                          <span className="text-[10px] font-mono uppercase bg-primary/10 text-primary px-2 py-0.5 rounded">{c.access_code}</span>
                        </div>
                        <h3 className="font-semibold text-foreground mb-1 line-clamp-1 flex items-center gap-2">
                          <span className="truncate">{c.name}</span>
                          {c.grupo && (
                            <span className="shrink-0 text-xs font-semibold bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                              {c.grado ? `${c.grado}°${c.grupo}` : c.grupo}
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{c.description || "Sin descripción"}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="h-3 w-3" /> Gestionar curso
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Cursos en los que estoy inscrito</h2>
        {enrolled.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
            No estás inscrito en ningún curso. Usa "Unirme con clave" para entrar a uno.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {enrolled.map((c) => (
              <button key={c.id} onClick={() => navigate(`/resources/courses/${c.id}/student`)}
                className="glass-card rounded-xl p-5 text-left hover:border-primary/40 transition-colors">
                <BookOpen className="h-5 w-5 text-primary mb-2" />
                <h3 className="font-semibold text-foreground mb-1 line-clamp-1">{c.name}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2">{c.description || "Sin descripción"}</p>
              </button>
            ))}
          </div>
        )}
      </section>
      <div className="mt-6">
        <CampoObservacion modulo="mini_cursos" />
      </div>
    </div>
  );
}
