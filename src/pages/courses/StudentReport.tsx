import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ResourceSubmission, CourseResource } from "@/lib/courses-types";

export default function StudentReport() {
  const { courseId, studentId } = useParams<{ courseId: string; studentId: string }>();
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ["profile", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data } = await (supabase as any).from("profiles").select("*").eq("id", studentId).single();
      return data;
    },
  });

  const { data: subs = [] } = useQuery({
    queryKey: ["report_subs", courseId, studentId],
    enabled: !!courseId && !!studentId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("resource_submissions").select("*")
        .eq("course_id", courseId).eq("student_id", studentId)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data as ResourceSubmission[];
    },
  });

  const { data: resources = [] } = useQuery({
    queryKey: ["report_resources", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("course_resources").select("*").eq("course_id", courseId);
      return (data || []) as CourseResource[];
    },
  });

  return (
    <div className="max-w-5xl mx-auto animate-fade-in space-y-6">
      <button onClick={() => navigate(`/resources/courses/${courseId}`)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Volver al curso
      </button>
      <div className="glass-card rounded-xl p-6">
        <h1 className="text-2xl font-bold text-foreground">{profile?.full_name || "Estudiante"}</h1>
        <p className="text-sm text-muted-foreground">{profile?.email}</p>
      </div>

      {subs.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
          Este estudiante aún no ha realizado actividades.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recurso</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Nota</TableHead>
              <TableHead>Tiempo</TableHead>
              <TableHead>Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subs.map((s) => {
              const r = resources.find((x) => x.id === s.course_resource_id);
              return (
                <TableRow key={s.id}>
                  <TableCell>{r?.title || "—"}</TableCell>
                  <TableCell className="text-xs">{s.resource_type}</TableCell>
                  <TableCell>{s.score !== null ? `${s.score} / ${s.max_score ?? "?"}` : "—"}</TableCell>
                  <TableCell className="text-xs">{s.time_spent_seconds ? `${Math.floor(s.time_spent_seconds / 60)}m ${s.time_spent_seconds % 60}s` : "—"}</TableCell>
                  <TableCell className="text-xs">{new Date(s.submitted_at).toLocaleString()}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
