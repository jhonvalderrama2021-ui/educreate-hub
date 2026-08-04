import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Routes, Route } from "react-router-dom";
import { useEffect, Suspense, lazy } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ResourcesSidebar } from "@/components/ResourcesSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { CalendarPopover } from "@/components/CalendarPopover";
import { Lightbulb } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { RouteFallback } from "@/components/RouteFallback";

// Cargadas de forma diferida: estas páginas arrastran librerías pesadas
// (docx, jspdf, pptxgenjs, html2canvas, pdfjs-dist) que no deben entrar
// en el bundle inicial.
const GenerateResource = lazy(() => import("@/pages/resources/GenerateResource"));
const ResourceHistory = lazy(() => import("@/pages/resources/ResourceHistory"));
const BotList = lazy(() => import("@/pages/resources/BotList"));
const BotChat = lazy(() => import("@/pages/resources/BotChat"));
const Crossword = lazy(() => import("@/pages/resources/Crossword"));
const Story = lazy(() => import("@/pages/resources/Story"));
const CoursesList = lazy(() => import("@/pages/courses/CoursesList"));
const CourseDetailTeacher = lazy(() => import("@/pages/courses/CourseDetailTeacher"));
const CourseDetailStudent = lazy(() => import("@/pages/courses/CourseDetailStudent"));
const AddCourseResource = lazy(() => import("@/pages/courses/AddCourseResource"));
const TakeCourseExam = lazy(() => import("@/pages/courses/TakeCourseExam"));
const ViewCourseResource = lazy(() => import("@/pages/courses/ViewCourseResource"));
const StudentReport = lazy(() => import("@/pages/courses/StudentReport"));

function ResourcesHome() {
  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="text-center py-16">
        <div className="mx-auto h-20 w-20 rounded-2xl gradient-primary flex items-center justify-center mb-6">
          <Lightbulb className="h-10 w-10 text-primary-foreground" />
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-3">Centro de Recursos con IA</h1>
        <p className="text-muted-foreground max-w-md mx-auto mb-8">
          Genera recursos educativos automáticamente con Inteligencia Artificial.
          Selecciona un módulo del menú lateral o comienza rápidamente:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-lg mx-auto mt-8">
          {[
            { icon: "📋", label: "Exámenes", type: "icfes" },
            { icon: "🔧", label: "Talleres", type: "workshop" },
            { icon: "🎞️", label: "Diapositivas", type: "slides" },
            { icon: "📝", label: "Planes de clase", type: "lesson_plan" },
            { icon: "📊", label: "Rúbricas", type: "rubric" },
            { icon: "🤖", label: "Crear Bot", type: "bot" },
          ].map((item) => (
            <NavLink key={item.label} to={item.type === "bot" ? "/resources/bots" : `/resources/generate?type=${item.type}`}>
              <div className="glass-card rounded-xl p-4 text-center hover:border-primary/30 transition-colors cursor-pointer">
                <span className="text-2xl block mb-2">{item.icon}</span>
                <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
              </div>
            </NavLink>
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
      <div className="min-h-screen flex w-full bg-background overflow-x-hidden">
        <ResourcesSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="bg-card/90 backdrop-blur border-b border-border px-4 sticky top-0 z-30">
            <div className="flex items-center gap-3 py-3">
              <div className="flex-1 min-w-0 flex justify-center">
                <div className="w-full max-w-2xl">
                  <CalendarPopover />
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <ThemeToggle />
                <UserMenu />
              </div>
            </div>
          </header>
          <main className="flex-1 p-6 md:p-10 overflow-auto">
            <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route index element={<ResourcesHome />} />
              <Route path="generate" element={<GenerateResource />} />
              <Route path="history" element={<ResourceHistory />} />
              <Route path="bots" element={<BotList />} />
              <Route path="bot-chat/:botId" element={<BotChat />} />
              <Route path="crossword" element={<Crossword />} />
              <Route path="story" element={<Story />} />
              <Route path="courses" element={<CoursesList />} />
              <Route path="courses/:courseId" element={<CourseDetailTeacher />} />
              <Route path="courses/:courseId/student" element={<CourseDetailStudent />} />
              <Route path="courses/:courseId/add-resource" element={<AddCourseResource />} />
              <Route path="courses/:courseId/take/:courseResourceId" element={<TakeCourseExam />} />
              <Route path="courses/:courseId/view/:courseResourceId" element={<ViewCourseResource />} />
              <Route path="courses/:courseId/student-report/:studentId" element={<StudentReport />} />
            </Routes>
            </Suspense>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
