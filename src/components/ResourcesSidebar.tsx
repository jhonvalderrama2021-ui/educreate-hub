import { BookOpen, ClipboardList, Table2, FileCheck, History, HelpCircle, FileEdit, ChevronLeft, ChevronRight } from "lucide-react";
import { NavLink } from "@/components/NavLink";
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
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar
      collapsible="icon"
      className={[
        "[&_[data-sidebar=sidebar]]:bg-white",
        "[&_[data-sidebar=sidebar]]:border-r",
        "[&_[data-sidebar=sidebar]]:border-gray-200",
        "[&_[data-sidebar=sidebar]]:overflow-hidden",
      ].join(" ")}
    >
      <SidebarHeader className="px-4 py-4 bg-white">
        <div className="flex items-center justify-between gap-2">
          <NavLink to="/resources" className="flex items-center gap-2 text-purple-700 font-bold min-w-0">
            <BookOpen className="h-5 w-5 shrink-0 text-purple-700" />
            {!collapsed && <span className="text-sm truncate">Recursos Educativos</span>}
          </NavLink>

          <button
            type="button"
            onClick={toggleSidebar}
            className="h-8 w-8 rounded-md flex items-center justify-center text-gray-600 hover:bg-purple-50 hover:text-purple-700 transition-colors shrink-0"
            aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
            title={collapsed ? "Expandir" : "Contraer"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-white">
        <SidebarGroup className="px-2 py-3">
          <SidebarGroupLabel className="px-3 text-[11px] font-semibold tracking-wide text-gray-500">
            Crear Recursos
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {modules.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.description}>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors"
                      activeClassName="bg-purple-50 text-purple-700"
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

        <SidebarGroup className="px-2 py-3">
          <SidebarGroupLabel className="px-3 text-[11px] font-semibold tracking-wide text-gray-500">
            Gestión
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {managementModules.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.description}>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors"
                      activeClassName="bg-purple-50 text-purple-700"
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
