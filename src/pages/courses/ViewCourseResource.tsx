import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import { ResourceContentViewer } from "@/components/ResourceContentViewer";

export default function ViewCourseResource() {
  const { courseId, courseResourceId } = useParams<{ courseId: string; courseResourceId: string }>();
  const navigate = useNavigate();

  const { data: cr } = useQuery({
    queryKey: ["view_cr", courseResourceId],
    enabled: !!courseResourceId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("course_resources").select("*").eq("id", courseResourceId).single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: resource } = useQuery({
    queryKey: ["view_res", cr?.resource_id],
    enabled: !!cr,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("generated_resources").select("*").eq("id", cr.resource_id).single();
      if (error) throw error;
      return data;
    },
  });

  if (!cr || !resource) return <div className="p-8 text-muted-foreground">Cargando…</div>;

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-4">
      <button onClick={() => navigate(`/courses/${courseId}/student`)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Volver al curso
      </button>
      <div className="glass-card rounded-xl p-6">
        <h1 className="text-2xl font-bold text-foreground mb-4">{cr.title}</h1>
        <ResourceContentViewer resource={resource} />
      </div>
    </div>
  );
}
