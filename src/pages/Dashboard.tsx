import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { BookOpen, Plus, FileText, Users, BarChart3, Shield, ArrowRight } from "lucide-react";
export default function Dashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);

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
        if (data && data.length > 0) setIsAdmin(true);
      });
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const displayName = user.user_metadata?.full_name || user.email;

  const stats = [
    { label: "Recursos creados", value: "0", icon: FileText },
    { label: "Compartidos", value: "0", icon: Users },
    { label: "Vistas totales", value: "0", icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
          <Link to="/dashboard" className="flex items-center gap-2 text-primary font-bold text-xl">
            <FileText className="h-6 w-6" />
            EduCrea
          </Link>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
                <Shield className="h-4 w-4 mr-1" />
                Admin
              </Button>
            )}
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="mb-10 animate-fade-in">
          <h1 className="text-3xl font-bold text-foreground">
            ¡Hola, {displayName}!
          </h1>
          <p className="text-muted-foreground mt-1">
            Bienvenido a tu espacio de creación educativa.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {stats.map((s) => (
            <div
              key={s.label}
              className="glass-card rounded-xl p-6 flex items-center gap-4 animate-fade-in"
            >
              <div className="h-12 w-12 rounded-lg gradient-primary flex items-center justify-center">
                <s.icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-sm text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="glass-card rounded-xl p-10 text-center animate-fade-in">
          <div className="mx-auto h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center mb-4">
            <Plus className="h-8 w-8 text-primary-foreground" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Crea tu primer recurso
          </h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Diseña presentaciones, cuestionarios, actividades y más para tus estudiantes.
          </p>
          <Link to="/resources">
            <Button className="gradient-primary" size="lg">
              <ArrowRight className="h-4 w-4 mr-1" />
              Ir a Recursos
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
