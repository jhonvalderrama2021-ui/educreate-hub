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
import { GestorUsuarios } from "@/components/GestorUsuarios";
import { GestorCatalogos } from "@/components/GestorCatalogos";
import { PanelAuditoria } from "@/components/PanelAuditoria";
import { GestorTokens } from "@/components/GestorTokens";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText, Shield, ArrowLeft, Key, Eye, EyeOff, Save, CheckCircle,
  Users, Settings, BarChart3, UserX, MessageSquare, ImagePlus, ListChecks, Clock, Coins
} from "lucide-react";
import { toast } from "sonner";
import { PanelObservaciones } from "@/components/PanelObservaciones";
import { GestorImagenesAyuda } from "@/components/GestorImagenesAyuda";

// Es la fila que devuelve admin_listar_usuarios. El tipo completo, con el
// correo confirmado y el ultimo acceso, vive en GestorUsuarios; aqui solo
// hacen falta el rol y el estado para las tarjetas de resumen.
type UsuarioResumen = { id: string; rol: string; activo: boolean };

export default function AdminPanel() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<UsuarioResumen[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Stats
  const totalUsers = users.length;

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
    // Misma consulta que usa GestorUsuarios: las tarjetas de resumen y la
    // lista deben contar lo mismo.
    const { data, error } = await supabase.rpc("admin_listar_usuarios");
    if (error) toast.error("Error al cargar usuarios");
    setUsers((data || []) as UsuarioResumen[]);
    setLoadingUsers(false);
  };

  const loadAISettings = async () => {
    // Never fetch the raw key into the browser. Use a server-side check that returns only a boolean.
    const { data, error } = await supabase.rpc("admin_has_openai_key");
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

  const roleCounts = {
    admin: users.filter((u) => u.rol === "admin").length,
    docente: users.filter((u) => u.rol === "docente").length,
    estudiante: users.filter((u) => u.rol === "estudiante").length,
  };
  const desactivados = users.filter((u) => !u.activo).length;

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
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 animate-fade-in" style={{ animationDelay: "0.05s" }}>
          {[
            { label: "Total usuarios", value: totalUsers, icon: Users, color: "from-primary to-primary/80" },
            { label: "Administradores", value: roleCounts.admin, icon: Shield, color: "from-rose-500 to-rose-600" },
            { label: "Docentes", value: roleCounts.docente, icon: BarChart3, color: "from-emerald-500 to-emerald-600" },
            { label: "Estudiantes", value: roleCounts.estudiante, icon: Users, color: "from-amber-500 to-amber-600" },
            { label: "Desactivados", value: desactivados, icon: UserX, color: "from-slate-500 to-slate-600" },
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
            <TabsTrigger value="tokens" className="gap-1.5">
              <Coins className="h-4 w-4" />
              <span className="hidden sm:inline">Tokens</span>
            </TabsTrigger>
            <TabsTrigger value="auditoria" className="gap-1.5">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Auditoría</span>
            </TabsTrigger>
            <TabsTrigger value="catalogos" className="gap-1.5">
              <ListChecks className="h-4 w-4" />
              <span className="hidden sm:inline">Catálogos</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5">
              <Settings className="h-4 w-4" />
              Configuración IA
            </TabsTrigger>
            <TabsTrigger value="imagenes-ayuda" className="gap-1.5">
              <ImagePlus className="h-4 w-4" />
              Imágenes de ayuda
            </TabsTrigger>
            <TabsTrigger value="observaciones" className="gap-1.5">
              <MessageSquare className="h-4 w-4" />
              Observaciones
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="mt-4">
            <GestorUsuarios />
          </TabsContent>

          <TabsContent value="tokens" className="mt-4">
            <GestorTokens />
          </TabsContent>

          <TabsContent value="auditoria" className="mt-4">
            <PanelAuditoria />
          </TabsContent>

          <TabsContent value="catalogos" className="mt-4">
            <GestorCatalogos />
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
                  <Label htmlFor="api-key">
                    {keyConfigured ? "Reemplazar Clave API" : "Clave API"}
                  </Label>
                  {keyConfigured && (
                    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-sm text-muted-foreground">
                      <Key className="h-3.5 w-3.5" />
                      sk-••••••••••••••••••••
                    </div>
                  )}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="api-key"
                        type={showKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={keyConfigured ? "Pega una nueva clave para reemplazar" : "sk-..."}
                        className="pr-10 font-mono text-sm"
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setShowKey(!showKey)}
                      >
                        {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button onClick={saveApiKey} disabled={savingKey || !apiKey.trim()} className="gradient-primary">
                      <Save className="h-4 w-4 mr-1" />
                      {savingKey ? "Guardando..." : "Guardar"}
                    </Button>
                  </div>
                  {keyConfigured && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> API Key configurada correctamente (no se muestra por seguridad)
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

          {/* Capturas que ilustran el centro de ayuda */}
          <TabsContent value="imagenes-ayuda" className="mt-4">
            <div className="rounded-xl border border-border bg-card shadow-sm p-5">
              <div className="mb-4">
                <h2 className="font-semibold text-foreground">Imágenes del centro de ayuda</h2>
                <p className="text-sm text-muted-foreground">
                  Sube capturas de pantalla para ilustrar cada sección. Se ven de inmediato
                  en la ayuda, sin necesidad de publicar una versión nueva de la plataforma.
                </p>
              </div>
              <GestorImagenesAyuda />
            </div>
          </TabsContent>

          {/* Observaciones recogidas durante la prueba piloto */}
          <TabsContent value="observaciones" className="mt-4">
            <div className="rounded-xl border border-border bg-card shadow-sm p-5">
              <div className="mb-4">
                <h2 className="font-semibold text-foreground">Observaciones de los docentes</h2>
                <p className="text-sm text-muted-foreground">
                  Retroalimentación que dejan los docentes desde cada módulo durante la prueba piloto
                </p>
              </div>
              <PanelObservaciones />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
