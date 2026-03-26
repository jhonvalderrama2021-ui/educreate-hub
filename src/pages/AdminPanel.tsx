import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BookOpen, LogOut, Shield, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

type UserWithRole = {
  id: string;
  email: string | null;
  full_name: string | null;
  username: string | null;
  role: string;
};

export default function AdminPanel() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    // Check if current user is admin
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .then(({ data }) => {
        if (data && data.length > 0) {
          setIsAdmin(true);
          loadUsers();
        } else {
          toast.error("No tienes permisos de administrador");
          navigate("/dashboard");
        }
      });
  }, [user]);

  const loadUsers = async () => {
    setLoadingUsers(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, username");

    if (error) {
      toast.error("Error al cargar usuarios");
      setLoadingUsers(false);
      return;
    }

    // Get roles for all users
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role");

    const roleMap = new Map<string, string>();
    roles?.forEach((r) => roleMap.set(r.user_id, r.role));

    const usersWithRoles: UserWithRole[] = (data || []).map((p) => ({
      ...p,
      role: roleMap.get(p.id) || "estudiante",
    }));

    setUsers(usersWithRoles);
    setLoadingUsers(false);
  };

  const changeRole = async (userId: string, newRole: string) => {
    // Delete existing role
    await supabase.from("user_roles").delete().eq("user_id", userId);

    // Insert new role
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: newRole });

    if (error) {
      toast.error("Error al cambiar el rol");
      return;
    }

    toast.success("Rol actualizado correctamente");
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    );
  };

  if (loading || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 text-primary font-bold text-xl">
          <BookOpen className="h-6 w-6" />
          EduCrea
        </a>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={() => { signOut(); navigate("/"); }}>
            <LogOut className="h-4 w-4 mr-1" />
            Salir
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Panel de Administración</h1>
          </div>
        </div>

        <div className="glass-card rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold text-foreground">Gestión de Usuarios y Roles</h2>
            <p className="text-sm text-muted-foreground">Asigna roles a los usuarios registrados</p>
          </div>

          {loadingUsers ? (
            <div className="p-8 flex justify-center">
              <div className="h-6 w-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-4 gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate">
                      {u.full_name || u.username || "Sin nombre"}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">{u.email}</p>
                    {u.username && (
                      <p className="text-xs text-muted-foreground">@{u.username}</p>
                    )}
                  </div>
                  <Select
                    value={u.role}
                    onValueChange={(val) => changeRole(u.id, val)}
                    disabled={u.id === user?.id}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="docente">Docente</SelectItem>
                      <SelectItem value="estudiante">Estudiante</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
              {users.length === 0 && (
                <p className="p-6 text-center text-muted-foreground">No hay usuarios registrados</p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
