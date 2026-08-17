import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FileText, Loader2, KeyRound, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const esquema = z.object({
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  confirmar: z.string(),
}).refine((d) => d.password === d.confirmar, {
  message: "Las contraseñas no coinciden",
  path: ["confirmar"],
});

/**
 * Pantalla a la que llega el usuario desde el enlace de recuperación enviado
 * por correo. Supabase abre la sesión automáticamente al procesar el enlace,
 * de modo que aquí basta con actualizar la contraseña.
 */
export default function RestablecerClave() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [enlaceValido, setEnlaceValido] = useState<boolean | null>(null);

  useEffect(() => {
    // El enlace del correo genera un evento de recuperación. Si el usuario
    // llega aquí sin sesión, el enlace expiró o ya fue utilizado.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((evento, sesion) => {
      if (evento === "PASSWORD_RECOVERY" || sesion) setEnlaceValido(true);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setEnlaceValido((previo) => previo ?? !!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const datos = esquema.parse({ password, confirmar });
      const { error } = await supabase.auth.updateUser({ password: datos.password });
      if (error) throw error;
      toast.success("Contraseña actualizada. Ya puedes usarla para entrar.");
      navigate("/resources");
    } catch (err: any) {
      if (err instanceof z.ZodError) toast.error(err.errors[0].message);
      else toast.error(err.message || "No se pudo actualizar la contraseña");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2 text-primary font-bold text-xl">
          <FileText className="h-6 w-6" />
          NexProfe
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md animate-fade-in">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-xl">
            <div className="mx-auto h-12 w-12 rounded-xl gradient-primary flex items-center justify-center mb-4">
              <KeyRound className="h-6 w-6 text-primary-foreground" />
            </div>

            <h1 className="text-2xl font-bold text-foreground mb-1 text-center">
              Nueva contraseña
            </h1>

            {enlaceValido === false ? (
              <div className="mt-6 space-y-4">
                <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Este enlace ya no es válido. Los enlaces de recuperación
                    caducan al cabo de un tiempo y solo pueden usarse una vez.
                    Solicita uno nuevo desde la pantalla de acceso.
                  </p>
                </div>
                <Button asChild className="w-full" variant="outline">
                  <Link to="/auth">Volver a iniciar sesión</Link>
                </Button>
              </div>
            ) : (
              <>
                <p className="text-muted-foreground mb-6 text-sm text-center">
                  Escribe la contraseña que usarás de ahora en adelante.
                </p>
                <form onSubmit={guardar} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Contraseña nueva</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmar">Repetir contraseña</Label>
                    <Input
                      id="confirmar"
                      type="password"
                      placeholder="••••••••"
                      value={confirmar}
                      onChange={(e) => setConfirmar(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <Button type="submit" className="w-full gradient-primary" size="lg" disabled={guardando}>
                    {guardando && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Guardar contraseña
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
