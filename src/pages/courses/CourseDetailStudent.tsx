import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, FileCheck, Puzzle, BookText, FileEdit, Presentation, ClipboardList, Table2, FileText, CheckCircle2, Lock,
} from "lucide-react";
import type { CourseResource, MiniCourse, ResourceSubmission } from "@/lib/courses-types";

const TYPE_ICON: Record<string, any> = {
  icfes: FileCheck, quiz: FileCheck, workshop: FileEdit,
  lesson_plan: ClipboardList, rubric: Table2, slides: Presentation,
  crossword: Puzzle, story: BookText,
};
const EVALUABLE = ["icfes", "quiz", "crossword"];

export default function CourseDetailStudent() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

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
    queryKey: ["course_resources_student", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("course_resources").select("*").eq("course_id", courseId)
        .order("position", { ascending: true }).order("created_at", { ascending: true });
      if (error) throw error;
      return data as CourseResource[];
    },
  });

  const { data: mySubmissions = [] } = useQuery({
    queryKey: ["my_submissions", courseId, user?.id],
    enabled: !!courseId && !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("resource_submissions").select("*")
        .eq("course_id", courseId).eq("student_id", user!.id);
      if (error) throw error;
      return data as ResourceSubmission[];
    },
  });

  const now = new Date();

  const open = (r: CourseResource) => {
    if (EVALUABLE.includes(r.resource_type)) {
      navigate(`/courses/${courseId}/take/${r.id}`);
    } else {
      navigate(`/courses/${courseId}/view/${r.id}`);
    }
  };

  if (!course) return <div className="p-8 text-muted-foreground">Cargando…</div>;

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-6">
      <button onClick={() => navigate("/courses")} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Mis cursos
      </button>

      <div className="glass-card rounded-xl p-6">
        <h1 className="text-2xl font-bold text-foreground">{course.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">{course.description || "Sin descripción"}</p>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Recursos del curso</h2>
        {resources.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">Aún no hay recursos.</div>
        ) : (
          resources.map((r) => {
            const Icon = TYPE_ICON[r.resource_type] || FileText;
            const subs = mySubmissions.filter((s) => s.course_resource_id === r.id);
            const attempts = subs.length;
            const best = subs.reduce<ResourceSubmission | null>((a, b) =>
              !a || (b.score ?? -1) > (a.score ?? -1) ? b : a, null);
            const opensAt = r.opens_at ? new Date(r.opens_at) : null;
            const closesAt = r.closes_at ? new Date(r.closes_at) : null;
            const notOpen = opensAt && now < opensAt;
            const closed = closesAt && now > closesAt;
            const reachedAttempts = EVALUABLE.includes(r.resource_type) && attempts >= r.max_attempts;
            const locked = notOpen || closed || reachedAttempts;

            return (
              <div key={r.id} className="glass-card rounded-lg p-4 flex items-center gap-3">
                <Icon className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground line-clamp-1">{r.title}</div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    {EVALUABLE.includes(r.resource_type) && <span>Intentos: {attempts}/{r.max_attempts}</span>}
                    {r.time_limit_minutes && <span>Tiempo: {r.time_limit_minutes}min</span>}
                    {opensAt && <span>Abre: {opensAt.toLocaleString()}</span>}
                    {closesAt && <span>Cierra: {closesAt.toLocaleString()}</span>}
                    {best && r.show_grade && best.score !== null && (
                      <span className="text-primary font-medium">Mi mejor nota: {best.score}/{best.max_score}</span>
                    )}
                  </div>
                </div>
                {locked ? (
                  <Button variant="outline" disabled>
                    <Lock className="h-4 w-4 mr-2" />
                    {notOpen ? "No iniciado" : closed ? "Cerrado" : "Sin intentos"}
                  </Button>
                ) : (
                  <Button onClick={() => open(r)} className="gradient-primary">
                    {attempts > 0 && EVALUABLE.includes(r.resource_type) ? "Reintentar" : "Abrir"}
                    {attempts > 0 && best?.score !== null && r.show_grade && <CheckCircle2 className="h-4 w-4 ml-2" />}
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
