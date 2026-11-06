import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FileText, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { avisarError } from "@/lib/errores";
import {
  erroresDeZod, propsDeCampo, idDelError, enfocarPrimerError,
  type ErroresDeCampo,
} from "@/lib/formularios";

const loginSchema = z.object({
  email: z.string().trim().email("Correo electrónico inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

const recuperarSchema = z.object({
  email: z.string().trim().email("Correo electrónico inválido"),
});

const signupSchema = z.object({
  username: z.string().trim().min(3, "El nombre de usuario debe tener al menos 3 caracteres").max(50),
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(100),
  email: z.string().trim().email("Correo electrónico inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  confirmPassword: z.string(),
  role: z.enum(["docente", "estudiante"], { required_error: "Selecciona un rol" }),
  dataConsent: z.literal(true, { errorMap: () => ({ message: "Debes autorizar el manejo de tus datos" }) }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

/** Modos de la pantalla: acceder, registrarse o recuperar la contraseña. */
type Modo = "login" | "signup" | "recuperar";

export default function Auth() {
  const [searchParams] = useSearchParams();
  const [modo, setModo] = useState<Modo>(
    searchParams.get("mode") === "signup" ? "signup" : "login",
  );
  const isLogin = modo === "login";
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<"docente" | "estudiante">("estudiante");
  const [dataConsent, setDataConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  /** Errores de validación por campo, para pintarlos junto a cada uno. */
  const [errores, setErrores] = useState<ErroresDeCampo>({});
  /** Al escribir en un campo se borra su error: corregirlo no debe seguir en rojo. */
  const limpiar = (campo: string) =>
    setErrores((previos) => (previos[campo] ? { ...previos, [campo]: "" } : previos));
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user) navigate("/resources");
  }, [user, authLoading, navigate]);

  // Al cambiar entre acceder, registrarse y recuperar, los errores del modo
  // anterior dejan de tener sentido y marcarian campos que ya no se ven.
  useEffect(() => { setErrores({}); }, [modo]);

  /** Orden visual de los campos, para llevar el foco al primero que falle. */
  const ORDEN_CAMPOS = ["username", "name", "email", "password", "confirmPassword", "dataConsent"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // La validación se resuelve antes de tocar el servidor, y sus errores se
    // muestran junto a cada campo en lugar de en una notificación que tapa
    // uno solo y se va sola.
    const esquema = modo === "recuperar" ? recuperarSchema : isLogin ? loginSchema : signupSchema;
    const valores =
      modo === "recuperar"
        ? { email }
        : isLogin
        ? { email, password }
        : { username, name, email, password, confirmPassword, role, dataConsent };

    const revision = esquema.safeParse(valores);
    if (!revision.success) {
      const fallos = erroresDeZod(revision.error);
      setErrores(fallos);
      enfocarPrimerError(fallos, ORDEN_CAMPOS);
      return;
    }
    setErrores({});
    setLoading(true);

    try {
      if (modo === "recuperar") {
        const parsed = recuperarSchema.parse({ email });
        const { error } = await supabase.auth.resetPasswordForEmail(parsed.email, {
          redirectTo: `${window.location.origin}/restablecer`,
        });
        if (error) throw error;
        // No se revela si el correo existe: informar lo contrario permitiría
        // averiguar qué cuentas están registradas en la plataforma.
        toast.success(
          "Si el correo está registrado, recibirás un enlace para restablecer tu contraseña. Revisa también la carpeta de correo no deseado.",
          { duration: 10000 },
        );
        setModo("login");
      } else if (isLogin) {
        const parsed = loginSchema.parse({ email, password });
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.email,
          password: parsed.password,
        });
        if (error) throw error;
        toast.success("¡Bienvenido de nuevo!");
        navigate("/resources");
      } else {
        const parsed = signupSchema.parse({
          username, name, email, password, confirmPassword, role, dataConsent,
        });
        const { error } = await supabase.auth.signUp({
          email: parsed.email,
          password: parsed.password,
          options: {
            data: {
              full_name: parsed.name,
              username: parsed.username,
              role: parsed.role,
            },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success("Cuenta creada. Revisa tu correo para confirmar.");
      }
    } catch (err: unknown) {
      avisarError(
        err,
        modo === "recuperar"
          ? "No se pudo enviar el enlace de recuperación"
          : isLogin
          ? "No se pudo iniciar sesión"
          : "No se pudo crear la cuenta",
      );
    } finally {
      setLoading(false);
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
            {/* Back link */}
            <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" />
              Volver al inicio
            </Link>

            <h1 className="text-2xl font-bold text-foreground mb-1">
              {modo === "recuperar" ? "Recuperar contraseña" : isLogin ? "Iniciar sesión" : "Crear cuenta"}
            </h1>
            <p className="text-muted-foreground mb-6 text-sm">
              {modo === "recuperar"
                ? "Escribe el correo con el que te registraste y te enviaremos un enlace para crear una contraseña nueva."
                : isLogin
                ? "Ingresa a tu cuenta para continuar"
                : "Únete y comienza a crear recursos educativos"}
            </p>

            {/* noValidate desactiva la validación del navegador. Sin esto, un
                campo vacío lo atrapa el navegador con su propio globo («Completa
                este campo»), que se cierra solo y no queda enlazado al campo:
                la validación de abajo, que sí deja el mensaje escrito y
                relacionado por aria-describedby, nunca llegaba a ejecutarse en
                el caso más frecuente. Los tipos y los mínimos se siguen
                comprobando con el esquema, que es más estricto. */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {modo === "signup" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="username">
                      Nombre de usuario <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="username"
                      placeholder="mi_usuario"
                      value={username}
                      onChange={(e) => { setUsername(e.target.value); limpiar("username"); }}
                      required
                      maxLength={50}
                      autoComplete="username"
                      {...propsDeCampo("username", errores)}
                    />
                    {errores.username && (
                      <p id={idDelError("username")} role="alert" className="text-sm text-destructive">
                        {errores.username}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">
                      Nombre completo <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      placeholder="Tu nombre"
                      value={name}
                      onChange={(e) => { setName(e.target.value); limpiar("name"); }}
                      required
                      maxLength={100}
                      autoComplete="name"
                      {...propsDeCampo("name", errores)}
                    />
                    {errores.name && (
                      <p id={idDelError("name")} role="alert" className="text-sm text-destructive">
                        {errores.name}
                      </p>
                    )}
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">
                  Correo electrónico <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); limpiar("email"); }}
                  required
                  maxLength={255}
                  autoComplete="email"
                  {...propsDeCampo("email", errores)}
                />
                {errores.email && (
                  <p id={idDelError("email")} role="alert" className="text-sm text-destructive">
                    {errores.email}
                  </p>
                )}
              </div>

              {modo !== "recuperar" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">
                      Contraseña <span className="text-destructive">*</span>
                    </Label>
                    {isLogin && (
                      <button
                        type="button"
                        onClick={() => setModo("recuperar")}
                        className="text-xs text-primary hover:underline"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    )}
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); limpiar("password"); }}
                    required
                    minLength={6}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    {...propsDeCampo("password", errores)}
                  />
                  {errores.password && (
                    <p id={idDelError("password")} role="alert" className="text-sm text-destructive">
                      {errores.password}
                    </p>
                  )}
                </div>
              )}

              {modo === "signup" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">
                      Repetir contraseña <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); limpiar("confirmPassword"); }}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      {...propsDeCampo("confirmPassword", errores)}
                    />
                    {errores.confirmPassword && (
                      <p id={idDelError("confirmPassword")} role="alert" className="text-sm text-destructive">
                        {errores.confirmPassword}
                      </p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <Label>Tipo de cuenta</Label>
                    <RadioGroup
                      value={role}
                      onValueChange={(v) => setRole(v as "docente" | "estudiante")}
                      className="flex gap-4"
                    >
                      <label htmlFor="role-docente" className="flex items-center gap-2 rounded-lg border border-border p-3 flex-1 cursor-pointer hover:border-primary/50 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                        <RadioGroupItem value="docente" id="role-docente" />
                        <span className="text-sm font-medium">Docente</span>
                      </label>
                      <label htmlFor="role-estudiante" className="flex items-center gap-2 rounded-lg border border-border p-3 flex-1 cursor-pointer hover:border-primary/50 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                        <RadioGroupItem value="estudiante" id="role-estudiante" />
                        <span className="text-sm font-medium">Estudiante</span>
                      </label>
                    </RadioGroup>
                  </div>

                  <div className="flex items-start space-x-2 pt-1">
                    <Checkbox
                      id="dataConsent"
                      checked={dataConsent}
                      onCheckedChange={(checked) => { setDataConsent(checked === true); limpiar("dataConsent"); }}
                      {...propsDeCampo("dataConsent", errores)}
                    />
                    <Label htmlFor="dataConsent" className="text-sm font-normal leading-snug cursor-pointer text-muted-foreground">
                      Autorizo el tratamiento de mis datos personales conforme a la{" "}
                      <Link
                        to="/privacidad"
                        target="_blank"
                        onClick={(e) => e.stopPropagation()}
                        className="text-primary hover:underline"
                      >
                        Política de Tratamiento de Datos Personales
                      </Link>{" "}
                      y a la Ley 1581 de 2012.
                    </Label>
                  </div>
                  {errores.dataConsent && (
                    <p id={idDelError("dataConsent")} role="alert" className="text-sm text-destructive">
                      {errores.dataConsent}
                    </p>
                  )}
                </>
              )}

              <Button type="submit" className="w-full gradient-primary" size="lg" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {modo === "recuperar" ? "Enviar enlace de recuperación" : isLogin ? "Iniciar sesión" : "Crear cuenta"}
              </Button>
            </form>

            {modo === "recuperar" ? (
              <p className="mt-6 text-center text-sm text-muted-foreground">
                <button
                  type="button"
                  onClick={() => setModo("login")}
                  className="text-primary font-medium hover:underline"
                >
                  Volver a iniciar sesión
                </button>
              </p>
            ) : (
              <p className="mt-6 text-center text-sm text-muted-foreground">
                {isLogin ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
                <button
                  type="button"
                  onClick={() => setModo(isLogin ? "signup" : "login")}
                  className="text-primary font-medium hover:underline"
                >
                  {isLogin ? "Regístrate" : "Inicia sesión"}
                </button>
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
