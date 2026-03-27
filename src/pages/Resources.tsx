import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ResourcesSidebar } from "@/components/ResourcesSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { Lightbulb } from "lucide-react";
import LessonPlan from "@/pages/resources/LessonPlan";
import Rubrics from "@/pages/resources/Rubrics";
import IcfesExam from "@/pages/resources/IcfesExam";

function ResourcesHome() {
  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="text-center py-16">
        <div className="mx-auto h-20 w-20 rounded-2xl gradient-primary flex items-center justify-center mb-6">
          <Lightbulb className="h-10 w-10 text-primary-foreground" />
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-3">
          Centro de Recursos
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto mb-8">
          Selecciona un módulo del menú lateral para comenzar a crear tus recursos pedagógicos.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto">
          {[
            { icon: "📝", label: "Planes de clase" },
            { icon: "📊", label: "Rúbricas" },
            { icon: "📋", label: "Exámenes ICFES" },
          ].map((item) => (
            <div
              key={item.label}
              className="glass-card rounded-xl p-4 text-center hover:border-primary/30 transition-colors cursor-pointer"
            >
              <span className="text-2xl block mb-2">{item.icon}</span>
              <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Resources() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <ResourcesSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <span className="text-sm font-medium text-muted-foreground hidden sm:inline">
                Recursos Educativos
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <UserMenu />
            </div>
          </header>

          <main className="flex-1 p-6 md:p-10 overflow-auto">
            <Routes>
              <Route index element={<ResourcesHome />} />
              <Route path="lesson-plan" element={<LessonPlan />} />
              <Route path="rubrics" element={<Rubrics />} />
              <Route path="icfes" element={<IcfesExam />} />
            </Routes>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
