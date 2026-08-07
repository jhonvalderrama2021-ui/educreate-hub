import { ClipboardList, Table2, FileCheck, History, FileEdit, ChevronLeft, ChevronRight, Bot, Presentation, BookOpen, Puzzle, BookText, GraduationCap, HelpCircle } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { useUserRole } from "@/hooks/useUserRole";

// Modules visible only to docentes/admins
const teacherModules = [
  { title: "Plan de clase", url: "/resources/generate?type=lesson_plan", icon: ClipboardList, description: "Genera planes de clase con IA" },
  { title: "Rúbricas", url: "/resources/generate?type=rubric", icon: Table2, description: "Genera rúbricas de evaluación con IA" },
  { title: "Exámenes", url: "/resources/generate?type=icfes", icon: FileCheck, description: "Genera exámenes con IA" },
  { title: "Talleres", url: "/resources/generate?type=workshop", icon: FileEdit, description: "Genera talleres educativos con IA" },
];

// Modules visible to everyone (including students)
const sharedCreateModules = [
  { title: "Diapositivas", url: "/resources/generate?type=slides", icon: Presentation, description: "Genera presentaciones con IA" },
  { title: "Crear Bot", url: "/resources/bots", icon: Bot, description: "Crea bots educativos especializados" },
];

const gameModules = [
  { title: "Crucigrama", url: "/resources/crossword", icon: Puzzle, description: "Genera crucigramas educativos en español" },
  { title: "Crear Cuento", url: "/resources/story", icon: BookText, description: "Crea cuentos ilustrados con IA" },
];

const managementModules = [
  { title: "Mini Cursos", url: "/resources/courses", icon: GraduationCap, description: "Crea cursos, inscribe estudiantes y haz seguimiento" },
  { title: "Historial", url: "/resources/history", icon: History, description: "Ver recursos generados anteriormente" },
  { title: "Ayuda", url: "/resources/ayuda", icon: HelpCircle, description: "Guía de uso de la plataforma" },
];

export function ResourcesSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const { isDocente, loading: roleLoading } = useUserRole();

  // Students see only shared creation modules; teachers/admins see all
  const modules = roleLoading
    ? []
    : isDocente
    ? [...teacherModules, ...sharedCreateModules]
    : sharedCreateModules;

  return (
    <Sidebar
      collapsible="icon"
      className="[&_[data-sidebar=sidebar]]:bg-sidebar-background [&_[data-sidebar=sidebar]]:border-r [&_[data-sidebar=sidebar]]:border-sidebar-border [&_[data-sidebar=sidebar]]:overflow-hidden"
    >
      <SidebarHeader className="px-4 py-4 bg-sidebar-background">
        <div className="flex items-center justify-between gap-2">
          <NavLink to="/resources" className="flex items-center gap-2 text-primary font-bold min-w-0">
            <BookOpen className="h-5 w-5 shrink-0 text-primary" />
            {!collapsed && <span className="text-sm truncate">Recursos Educativos</span>}
          </NavLink>
          <button type="button" onClick={toggleSidebar} className="h-8 w-8 rounded-md flex items-center justify-center text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors shrink-0" aria-label={collapsed ? "Expandir menú" : "Contraer menú"}>
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-sidebar-background">
        <SidebarGroup className="px-2 py-3">
          <SidebarGroupLabel className="px-3 text-[11px] font-semibold tracking-wide text-muted-foreground">Crear Recursos</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {modules.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.description}>
                    <NavLink to={item.url} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground">
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="px-2 py-3">
          <SidebarGroupLabel className="px-3 text-[11px] font-semibold tracking-wide text-muted-foreground">Juegos</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {gameModules.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.description}>
                    <NavLink to={item.url} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground">
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="px-2 py-3">
          <SidebarGroupLabel className="px-3 text-[11px] font-semibold tracking-wide text-muted-foreground">Gestión</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {managementModules.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.description}>
                    <NavLink to={item.url} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground">
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
