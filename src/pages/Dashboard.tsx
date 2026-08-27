import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import {
  FileText, Plus, Users, BarChart3, ArrowRight, Sparkles,
  BookOpen, ClipboardList, Table2, FileCheck, HelpCircle, FileEdit, TrendingUp,
  Presentation, Puzzle, BookText, Bot
} from "lucide-react";
import { CalendarPopover } from "@/components/CalendarPopover";

const RECENT_TYPE_ICONS: Record<string, any> = {
  icfes: FileCheck,
  quiz: HelpCircle,
  workshop: FileEdit,
  guide: BookOpen,
  lesson_plan: ClipboardList,
  rubric: Table2,
};

const RECENT_TYPE_LABELS: Record<string, string> = {
  icfes: "Examen ICFES",
  quiz: "Cuestionario",
  workshop: "Taller",
  guide: "Guía",
  lesson_plan: "Plan de clase",
  rubric: "Rúbrica",
};

export default function Dashboard() {
  const { user, loading } = useAuth();
  const { isDocente } = useUserRole();
  const navigate = useNavigate();

  const [totalResources, setTotalResources] = useState(0);
  const [publicResources, setPublicResources] = useState(0);
  const [recentResources, setRecentResources] = useState<any[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      setStatsLoading(true);

      // Total resources
      const { count: total } = await supabase
        .from("generated_resources")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      // Public resources
      const { count: pub } = await supabase
        .from("generated_resources")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_public", true);

      // Recent resources (last 5)
      const { data: recent } = await supabase
        .from("generated_resources")
        .select("id, title, resource_type, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      setTotalResources(total || 0);
      setPublicResources(pub || 0);
      setRecentResources(recent || []);
      setStatsLoading(false);
    };

    fetchStats();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const displayName = user.user_metadata?.full_name || user.email;

  const stats = [
    { label: "Recursos creados", value: totalResources, icon: FileText, color: "from-primary to-primary/80" },
    { label: "Compartidos", value: publicResources, icon: Users, color: "from-emerald-500 to-emerald-600" },
    { label: "Privados", value: totalResources - publicResources, icon: BarChart3, color: "from-amber-500 to-amber-600" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="flex items-center gap-3 px-6 py-3 max-w-6xl mx-auto">
          <Link to="/dashboard" className="flex items-center gap-2 text-primary font-bold text-xl shrink-0">
            <FileText className="h-6 w-6" />
            NexProfe
          </Link>
          <div className="flex-1 min-w-0">
            <CalendarPopover />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Welcome */}
        <div className="animate-fade-in">
          <h1 className="text-3xl font-bold text-foreground">
            ¡Hola, {displayName}! 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            {isDocente
              ? "Aquí tienes un resumen de tu actividad educativa."
              : "Aquí tienes tus cursos y lo que has creado."}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className="relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition-shadow animate-fade-in"
              style={{ animationDelay: `${0.05 * i}s` }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {statsLoading ? (
                      <span className="inline-block h-8 w-12 bg-muted animate-pulse rounded" />
                    ) : (
                      s.value
                    )}
                  </p>
                </div>
                <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center shadow-lg`}>
                  <s.icon className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-gradient-to-br from-primary/5 to-transparent" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Resources */}
          <div className="lg:col-span-2 rounded-xl border border-border bg-card shadow-sm animate-fade-in" style={{ animationDelay: "0.15s" }}>
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-foreground">Recursos recientes</h2>
              </div>
              <Link to="/resources/history">
                <Button variant="ghost" size="sm" className="text-primary text-xs">
                  Ver todos <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="divide-y divide-border">
              {statsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="p-4 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-muted animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-40 bg-muted animate-pulse rounded" />
                      <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                    </div>
                  </div>
                ))
              ) : recentResources.length === 0 ? (
                <div className="p-10 text-center">
                  <FileText className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground text-sm">Aún no has creado recursos</p>
                  <Link to={isDocente ? "/resources/generate" : "/resources/generate?type=slides"}>
                    <Button size="sm" className="mt-3 gradient-primary">
                      <Sparkles className="h-3.5 w-3.5 mr-1" /> Crear primero
                    </Button>
                  </Link>
                </div>
              ) : (
                recentResources.map((r) => {
                  const Icon = RECENT_TYPE_ICONS[r.resource_type] || FileText;
                  return (
                    <div key={r.id} className="p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="h-4.5 w-4.5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm truncate">{r.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {RECENT_TYPE_LABELS[r.resource_type] || r.resource_type} · {new Date(r.created_at).toLocaleDateString("es-CO")}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-4 animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <div className="rounded-xl border border-border bg-card shadow-sm p-5">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                {isDocente ? "Acciones rápidas" : "Tu espacio"}
              </h3>
              <div className="space-y-2">
                {/* El estudiante veia aqui los mismos accesos que el docente y
                    podia crear examenes y planes de clase: el menu lateral si
                    los ocultaba, pero este panel no miraba el rol. Ahora cada
                    quien ve lo que le corresponde. */}
                {(isDocente
                  ? [
                      { label: "Generar con IA", icon: Sparkles, to: "/resources/generate" },
                      { label: "Examen ICFES", icon: FileCheck, to: "/resources/generate?type=icfes" },
                      { label: "Plan de clase", icon: ClipboardList, to: "/resources/generate?type=lesson_plan" },
                      { label: "Rúbrica", icon: Table2, to: "/resources/generate?type=rubric" },
                      { label: "Mis mini cursos", icon: BookOpen, to: "/resources/courses" },
                    ]
                  : [
                      { label: "Mis cursos", icon: BookOpen, to: "/resources/courses" },
                      { label: "Diapositivas", icon: Presentation, to: "/resources/generate?type=slides" },
                      { label: "Crucigrama", icon: Puzzle, to: "/resources/crossword" },
                      { label: "Crear cuento", icon: BookText, to: "/resources/story" },
                      { label: "Mis bots", icon: Bot, to: "/resources/bots" },
                    ]
                ).map((action) => (
                  <Link key={action.label} to={action.to}>
                    <Button variant="ghost" className="w-full justify-start h-10 text-sm font-normal hover:bg-primary/5 hover:text-primary">
                      <action.icon className="h-4 w-4 mr-2.5 text-primary" />
                      {action.label}
                    </Button>
                  </Link>
                ))}
              </div>
            </div>

            <Link to="/resources" className="block">
              <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-5 text-center hover:shadow-md transition-shadow cursor-pointer">
                <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center mx-auto mb-3 shadow-lg">
                  <ArrowRight className="h-6 w-6 text-primary-foreground" />
                </div>
                <p className="font-semibold text-foreground text-sm">Centro de Recursos</p>
                <p className="text-xs text-muted-foreground mt-1">Explora todos los módulos disponibles</p>
              </div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
