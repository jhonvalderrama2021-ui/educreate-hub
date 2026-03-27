import { BookOpen, ClipboardList, Table2, FileCheck, FolderPlus } from "lucide-react";
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
    title: "Plan de clase",
    url: "/resources/lesson-plan",
    icon: ClipboardList,
    description: "Diseña planes de clase estructurados",
  },
  {
    title: "Rúbricas",
    url: "/resources/rubrics",
    icon: Table2,
    description: "Crea rúbricas de evaluación",
  },
  {
    title: "Exámenes ICFES",
    url: "/resources/icfes",
    icon: FileCheck,
    description: "Genera exámenes tipo ICFES",
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
          <SidebarGroupLabel>Módulos</SidebarGroupLabel>
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
      </SidebarContent>
    </Sidebar>
  );
}
