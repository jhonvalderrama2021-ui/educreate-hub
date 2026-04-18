import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText, Shield, ArrowLeft, Key, Eye, EyeOff, Save, CheckCircle,
  Users, Settings, BarChart3, Search
} from "lucide-react";
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
  const [searchQuery, setSearchQuery] = useState("");

  // Stats
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalResources, setTotalResources] = useState(0);

  // AI Settings
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [keyConfigured, setKeyConfigured] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .then(({ data }) => {
        if (data && data.length > 0) {
          setIsAdmin(true);
          loadUsers();
          loadAISettings();
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
    setTotalUsers(usersWithRoles.length);
    setLoadingUsers(false);
  };

  const loadAISettings = async () => {
    // Never fetch the raw key into the browser. Use a server-side check that returns only a boolean.
    const { data, error } = await (supabase as any).rpc("admin_has_openai_key");
    if (!error && data === true) setKeyConfigured(true);
  };

  const saveApiKey = async () => {
    const trimmed = apiKey.trim();
    if (trimmed.length < 20) {
      toast.error("Ingresa una API Key válida");
      return;
    }
    setSavingKey(true);

    const { data, error } = await supabase.functions.invoke("set-openai-key", {
      body: { apiKey: trimmed },
    });

    if (error || (data as any)?.error) {
      toast.error("Error al guardar la API Key");
    } else {
      toast.success("API Key de OpenAI guardada correctamente");
      setKeyConfigured(true);
      setApiKey(""); // clear from memory after save
    }
    setSavingKey(false);
  };

  const changeRole = async (userId: string, newRole: string) => {
    await supabase.from("user_roles").delete().eq("user_id", userId);

    const { error } = await supabase
      .from("user_roles")
      .insert([{ user_id: userId, role: newRole as "admin" | "docente" | "estudiante" }]);

    if (error) {
      toast.error("Error al cambiar el rol");
      return;
    }

    toast.success("Rol actualizado correctamente");
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    );
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.email?.toLowerCase().includes(q) ||
      u.full_name?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q)
    );
  });

  const roleCounts = {
    admin: users.filter((u) => u.role === "admin").length,
    docente: users.filter((u) => u.role === "docente").length,
    estudiante: users.filter((u) => u.role === "estudiante").length,
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
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="flex items-center justify-between px-6 py-3 max-w-6xl mx-auto">
          <Link to="/dashboard" className="flex items-center gap-2 text-primary font-bold text-xl">
            <FileText className="h-6 w-6" />
            NexProfe
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Title */}
        <div className="flex items-center gap-3 animate-fade-in">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center shadow-lg">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Panel de Administración</h1>
              <p className="text-sm text-muted-foreground">Gestiona usuarios y configuración de la plataforma</p>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-fade-in" style={{ animationDelay: "0.05s" }}>
          {[
            { label: "Total usuarios", value: totalUsers, icon: Users, color: "from-primary to-primary/80" },
            { label: "Administradores", value: roleCounts.admin, icon: Shield, color: "from-rose-500 to-rose-600" },
            { label: "Docentes", value: roleCounts.docente, icon: BarChart3, color: "from-emerald-500 to-emerald-600" },
            { label: "Estudiantes", value: roleCounts.estudiante, icon: Users, color: "from-amber-500 to-amber-600" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center`}>
                  <s.icon className="h-4 w-4 text-white" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">{loadingUsers ? "—" : s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="users" className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="users" className="gap-1.5">
              <Users className="h-4 w-4" />
              Usuarios
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5">
              <Settings className="h-4 w-4" />
              Configuración IA
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="mt-4">
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="p-4 border-b border-border flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar usuarios..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <p className="text-sm text-muted-foreground hidden sm:block">
                  {filteredUsers.length} usuario{filteredUsers.length !== 1 ? "s" : ""}
                </p>
              </div>

              {loadingUsers ? (
                <div className="p-8 flex justify-center">
                  <div className="h-6 w-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredUsers.map((u) => (
                    <div key={u.id} className="flex items-center justify-between p-4 gap-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-sm font-semibold text-primary">
                            {(u.full_name || u.username || "U")[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate text-sm">
                            {u.full_name || u.username || "Sin nombre"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          u.role === "admin"
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                            : u.role === "docente"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        }`}>
                          {u.role}
                        </span>
                        <Select
                          value={u.role}
                          onValueChange={(val) => changeRole(u.id, val)}
                          disabled={u.id === user?.id}
                        >
                          <SelectTrigger className="w-[130px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="docente">Docente</SelectItem>
                            <SelectItem value="estudiante">Estudiante</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                  {filteredUsers.length === 0 && (
                    <p className="p-8 text-center text-muted-foreground text-sm">
                      {searchQuery ? "No se encontraron usuarios" : "No hay usuarios registrados"}
                    </p>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-4">
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="p-5 border-b border-border">
                <div className="flex items-center gap-2 mb-1">
                  <Key className="h-5 w-5 text-primary" />
                  <h2 className="font-semibold text-foreground">API Key de OpenAI</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Configura la clave para habilitar la generación de recursos con IA
                </p>
              </div>
              <div className="p-5 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="api-key">Clave API</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="api-key"
                        type={showKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-..."
                        className="pr-10 font-mono text-sm"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setShowKey(!showKey)}
                      >
                        {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button onClick={saveApiKey} disabled={savingKey} className="gradient-primary">
                      <Save className="h-4 w-4 mr-1" />
                      {savingKey ? "Guardando..." : "Guardar"}
                    </Button>
                  </div>
                  {keyConfigured && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> API Key configurada correctamente
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Obtén tu API Key en{" "}
                    <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" className="text-primary underline hover:no-underline">
                      platform.openai.com/api-keys
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
