import { BookOpen, ClipboardList, Table2, FileCheck, Sparkles, History, HelpCircle, FileEdit } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

const modules = [
  {
    title: "Generar con IA",
    url: "/resources/generate",
    icon: Sparkles,
    description: "Genera recursos educativos con IA",
  },
  {
    title: "Plan de clase",
    url: "/resources/generate?type=lesson_plan",
    icon: ClipboardList,
    description: "Genera planes de clase con IA",
  },
  {
    title: "Rúbricas",
    url: "/resources/generate?type=rubric",
    icon: Table2,
    description: "Genera rúbricas de evaluación con IA",
  },
  {
    title: "Exámenes ICFES",
    url: "/resources/generate?type=icfes",
    icon: FileCheck,
    description: "Genera exámenes tipo ICFES con IA",
  },
  {
    title: "Cuestionarios",
    url: "/resources/generate?type=quiz",
    icon: HelpCircle,
    description: "Genera cuestionarios con IA",
  },
  {
    title: "Talleres",
    url: "/resources/generate?type=workshop",
    icon: FileEdit,
    description: "Genera talleres educativos con IA",
  },
  {
    title: "Guías educativas",
    url: "/resources/generate?type=guide",
    icon: BookOpen,
    description: "Genera guías educativas con IA",
  },
];

const managementModules = [
  {
    title: "Historial",
    url: "/resources/history",
    icon: History,
    description: "Ver recursos generados anteriormente",
  },
];

export function ResourcesSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <NavLink to="/resources" className="flex items-center gap-2 text-sidebar-primary font-bold">
          <BookOpen className="h-5 w-5 shrink-0" />
          {!collapsed && <span className="text-sm">Recursos Educativos</span>}
        </NavLink>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Crear Recursos</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {modules.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.description}>
                    <NavLink
                      to={item.url}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Gestión</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {managementModules.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.description}>
                    <NavLink
                      to={item.url}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
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
