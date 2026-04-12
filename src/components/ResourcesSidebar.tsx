import { BookOpen, ClipboardList, Table2, FileCheck, History, FileEdit, ChevronLeft, ChevronRight, Bot } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";

const modules = [
  { title: "Plan de clase", url: "/resources/generate?type=lesson_plan", icon: ClipboardList, description: "Genera planes de clase con IA" },
  { title: "Rúbricas", url: "/resources/generate?type=rubric", icon: Table2, description: "Genera rúbricas de evaluación con IA" },
  { title: "Exámenes", url: "/resources/generate?type=icfes", icon: FileCheck, description: "Genera exámenes con IA" },
  { title: "Talleres", url: "/resources/generate?type=workshop", icon: FileEdit, description: "Genera talleres educativos con IA" },
  { title: "Guías educativas", url: "/resources/generate?type=guide", icon: BookOpen, description: "Genera guías educativas con IA" },
  { title: "Crear Bot", url: "/resources/bots", icon: Bot, description: "Crea bots educativos especializados" },
];

const managementModules = [
  { title: "Historial", url: "/resources/history", icon: History, description: "Ver recursos generados anteriormente" },
];

export function ResourcesSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";

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
