import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Search } from "lucide-react";
import { toast } from "sonner";

export default function AddCourseResource() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState<string | null>(null);

  const { data: resources = [] } = useQuery({
    queryKey: ["my_resources_for_course", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
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
      const { data, error } = await (supabase as any)
        .from("course_resources").select("resource_id").eq("course_id", courseId);
      if (error) throw error;
      return (data || []).map((d: any) => d.resource_id) as string[];
    },
  });

  const filtered = resources.filter((r) =>
    !assigned.includes(r.id) &&
    (search === "" || r.title.toLowerCase().includes(search.toLowerCase()))
  );

  const addToCourse = async (r: any) => {
    setAdding(r.id);
    try {
      const { error } = await (supabase as any).from("course_resources").insert({
        course_id: courseId,
        resource_id: r.id,
        resource_type: r.resource_type,
        title: r.title,
      });
      if (error) throw error;
      toast.success("Recurso agregado");
      qc.invalidateQueries({ queryKey: ["course_resources", courseId] });
      qc.invalidateQueries({ queryKey: ["course_resources_ids", courseId] });
    } catch (e: any) {
      toast.error(e.message);
    } finally { setAdding(null); }
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-6">
      <button onClick={() => navigate(`/courses/${courseId}`)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Volver al curso
      </button>

      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Agregar recurso al curso</h1>
        <p className="text-sm text-muted-foreground">Selecciona uno de tus recursos generados para agregarlo.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por título..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
          {resources.length === 0
            ? "No tienes recursos generados. Crea uno en la sección de Recursos."
            : "No hay recursos disponibles. Todos ya están en el curso o no coinciden con la búsqueda."}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <div key={r.id} className="glass-card rounded-lg p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-foreground line-clamp-1">{r.title}</div>
                <div className="text-xs text-muted-foreground">{r.resource_type} • {new Date(r.created_at).toLocaleDateString()}</div>
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
}
