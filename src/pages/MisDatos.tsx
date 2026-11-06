import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ArrowLeft, ShieldCheck, Save, Loader2, Download, AlertTriangle, Mail, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { avisarError } from "@/lib/errores";
import {
  propsDeCampo, idDelError, enfocarPrimerError,
  type ErroresDeCampo,
} from "@/lib/formularios";

/**
 * "Mis datos" — mecanismo para que el titular ejerza los derechos que le
 * reconoce el artículo 8 de la Ley 1581 de 2012: conocer, actualizar,
 * rectificar y solicitar la supresión de sus datos personales.
 */
export default function MisDatos() {
  const { user, loading: authLoading } = useAuth();
  const { role } = useUserRole();
  const navigate = useNavigate();

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [usuario, setUsuario] = useState("");
  const [conteos, setConteos] = useState({ recursos: 0, bots: 0, cursos: 0, notas: 0 });

  const [correoNuevo, setCorreoNuevo] = useState("");
  const [cambiandoCorreo, setCambiandoCorreo] = useState(false);
  const [claveNueva, setClaveNueva] = useState("");
  const [claveConfirmar, setClaveConfirmar] = useState("");
  const [cambiandoClave, setCambiandoClave] = useState(false);
  /** Errores de validación junto al campo, en vez de una notificación flotante. */
  const [errores, setErrores] = useState<ErroresDeCampo>({});
  const limpiar = (campo: string) =>
    setErrores((previos) => (previos[campo] ? { ...previos, [campo]: "" } : previos));

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: perfil } = await supabase
        .from("profiles")
        .select("full_name, username")
        .eq("id", user.id)
        .maybeSingle();

      if (perfil) {
        setNombre(perfil.full_name || "");
        setUsuario(perfil.username || "");
      }

      // Qué información está registrada a nombre del titular (derecho a conocer)
      // Cada tabla se consulta por su nombre real. Un ayudante genérico
      // suponía `user_id` en todas, y `mini_courses` guarda al docente en
      // `teacher_id`: la página informaba cero cursos sin dar ningún error.
      const soloContar = { count: "exact" as const, head: true };
      const [recursos, bots, cursos, notas] = await Promise.all([
        supabase.from("generated_resources").select("*", soloContar).eq("user_id", user.id),
        supabase.from("bots").select("*", soloContar).eq("user_id", user.id),
        supabase.from("mini_courses").select("*", soloContar).eq("teacher_id", user.id),
        supabase.from("calendar_notes").select("*", soloContar).eq("user_id", user.id),
      ]);

      setConteos({
        recursos: recursos.count || 0,
        bots: bots.count || 0,
        cursos: cursos.count || 0,
        notas: notas.count || 0,
      });
      setCargando(false);
    })();
  }, [user]);

  const guardar = async () => {
    if (!user) return;
    if (nombre.trim().length < 2) {
      toast.error("El nombre debe tener al menos 2 caracteres");
      return;
    }
    setGuardando(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: nombre.trim(), username: usuario.trim() })
      .eq("id", user.id);
    setGuardando(false);

    if (error) avisarError(error, "No se pudieron guardar tus datos");
    else toast.success("Datos actualizados");
  };

  const cambiarCorreo = async () => {
    const correo = correoNuevo.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      setErrores({ correoNuevo: "Escribe un correo electrónico válido, con arroba y dominio." });
      enfocarPrimerError({ correoNuevo: "x" }, ["correoNuevo"]);
      return;
    }
    if (correo === user?.email?.toLowerCase()) {
      setErrores({ correoNuevo: "Ese ya es tu correo actual. Escribe uno distinto." });
      enfocarPrimerError({ correoNuevo: "x" }, ["correoNuevo"]);
      return;
    }
    setErrores({});
    setCambiandoCorreo(true);
    const { error } = await supabase.auth.updateUser(
      { email: correo },
      { emailRedirectTo: `${window.location.origin}/mis-datos` },
    );
    setCambiandoCorreo(false);

    if (error) {
      avisarError(error, "No se pudo iniciar el cambio de correo");
      return;
    }
    setCorreoNuevo("");
    toast.success(
      `Revisa tu correo actual y ${correo}: enviamos un enlace a cada uno. El cambio se aplica cuando abras ambos.`,
      { duration: 14000 },
    );
  };

  const cambiarClave = async () => {
    if (claveNueva.length < 6) {
      setErrores({ claveNueva: "La contraseña debe tener al menos 6 caracteres." });
      enfocarPrimerError({ claveNueva: "x" }, ["claveNueva"]);
      return;
    }
    if (claveNueva !== claveConfirmar) {
      setErrores({ claveConfirmar: "Las dos contraseñas no coinciden. Vuelve a escribirlas." });
      enfocarPrimerError({ claveConfirmar: "x" }, ["claveConfirmar"]);
      return;
    }
    setErrores({});
    setCambiandoClave(true);
    const { error } = await supabase.auth.updateUser({ password: claveNueva });
    setCambiandoClave(false);

    if (error) {
      avisarError(error, "No se pudo actualizar la contraseña");
      return;
    }
    setClaveNueva("");
    setClaveConfirmar("");
    toast.success("Contraseña actualizada");
  };

  const descargarDatos = async () => {
    if (!user) return;
    toast.info("Preparando tu información...");

    const paquete = {
      exportadoEl: new Date().toISOString(),
      cuenta: { id: user.id, email: user.email, rol: role },
      perfil: { nombre, usuario },
      recursosGenerados: (await supabase.from("generated_resources").select("*").eq("user_id", user.id)).data || [],
      bots: (await supabase.from("bots").select("*").eq("user_id", user.id)).data || [],
      // teacher_id, no user_id: es la columna con la que esta tabla guarda al docente
      cursos: (await supabase.from("mini_courses").select("*").eq("teacher_id", user.id)).data || [],
      notasDeCalendario: (await supabase.from("calendar_notes").select("*").eq("user_id", user.id)).data || [],
    };

    const blob = new Blob([JSON.stringify(paquete, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mis-datos-nexprofe-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Descarga lista");
  };

  const solicitarSupresion = () => {
    const asunto = encodeURIComponent("Solicitud de supresión de datos personales - NexProfe");
    const cuerpo = encodeURIComponent(
      `Solicito la supresión de mis datos personales de la plataforma NexProfe, ` +
      `conforme al artículo 8 de la Ley 1581 de 2012.\n\n` +
      `Correo registrado: ${user?.email}\n` +
      `Identificador de cuenta: ${user?.id}\n\n` +
      `Entiendo que esta acción elimina de forma permanente los recursos, cursos y ` +
      `demás información asociada a mi cuenta.`
    );
    window.location.href = `mailto:jhonvalderrama2021@itp.edu.co?subject=${asunto}&body=${cuerpo}`;
  };

  if (authLoading || cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/resources" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10 space-y-8">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center shrink-0">
            <ShieldCheck className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Mis datos</h1>
            <p className="text-sm text-muted-foreground">
              Consulta, corrige o elimina tu información personal
            </p>
          </div>
        </div>

        {/* Derecho a conocer */}
        <section className="border border-border rounded-lg p-5 space-y-4">
          <h2 className="font-semibold text-foreground">Información registrada</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Correo electrónico</dt>
              <dd className="text-foreground font-medium break-all">{user.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Rol asignado</dt>
              <dd className="text-foreground font-medium capitalize">{role || "estudiante"}</dd>
            </div>
          </dl>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-2">
            {[
              ["Recursos", conteos.recursos],
              ["Bots", conteos.bots],
              ["Cursos", conteos.cursos],
              ["Notas", conteos.notas],
            ].map(([etiqueta, valor]) => (
              <div key={etiqueta as string} className="rounded-lg bg-muted/40 p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{valor as number}</p>
                <p className="text-xs text-muted-foreground">{etiqueta as string}</p>
              </div>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={descargarDatos} className="w-full sm:w-auto">
            <Download className="h-4 w-4 mr-2" />
            Descargar toda mi información
          </Button>
        </section>

        {/* Derecho a actualizar y rectificar */}
        <section className="border border-border rounded-lg p-5 space-y-4">
          <h2 className="font-semibold text-foreground">Corregir mis datos</h2>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre completo</Label>
              <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="usuario">Nombre de usuario</Label>
              <Input id="usuario" value={usuario} onChange={(e) => setUsuario(e.target.value)} />
            </div>
          </div>
          <Button onClick={guardar} disabled={guardando} size="sm">
            {guardando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar cambios
          </Button>
        </section>

        {/* Cambiar correo electrónico */}
        <section className="border border-border rounded-lg p-5 space-y-4">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            Cambiar correo electrónico
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Por seguridad se enviará un enlace de confirmación <strong>a los dos
            correos</strong>: al actual y al nuevo. El cambio se aplica cuando
            abras ambos enlaces; hasta entonces sigues entrando con el correo
            actual.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="correoNuevo">Correo nuevo</Label>
            <Input
              id="correoNuevo"
              type="email"
              placeholder="nuevo@correo.com"
              value={correoNuevo}
              onChange={(e) => { setCorreoNuevo(e.target.value); limpiar("correoNuevo"); }}
              autoComplete="email"
              {...propsDeCampo("correoNuevo", errores)}
            />
            {errores.correoNuevo && (
              <p id={idDelError("correoNuevo")} role="alert" className="text-sm text-destructive">
                {errores.correoNuevo}
              </p>
            )}
          </div>
          <Button onClick={cambiarCorreo} disabled={cambiandoCorreo} size="sm" variant="outline">
            {cambiandoCorreo ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
            Enviar confirmación
          </Button>
        </section>

        {/* Cambiar contraseña */}
        <section className="border border-border rounded-lg p-5 space-y-4">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            Cambiar contraseña
          </h2>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="claveNueva">Contraseña nueva</Label>
              <Input
                id="claveNueva"
                type="password"
                placeholder="••••••••"
                value={claveNueva}
                onChange={(e) => { setClaveNueva(e.target.value); limpiar("claveNueva"); }}
                minLength={6}
                autoComplete="new-password"
                {...propsDeCampo("claveNueva", errores)}
              />
              {errores.claveNueva && (
                <p id={idDelError("claveNueva")} role="alert" className="text-sm text-destructive">
                  {errores.claveNueva}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="claveConfirmar">Repetir contraseña nueva</Label>
              <Input
                id="claveConfirmar"
                type="password"
                placeholder="••••••••"
                value={claveConfirmar}
                onChange={(e) => { setClaveConfirmar(e.target.value); limpiar("claveConfirmar"); }}
                minLength={6}
                autoComplete="new-password"
                {...propsDeCampo("claveConfirmar", errores)}
              />
              {errores.claveConfirmar && (
                <p id={idDelError("claveConfirmar")} role="alert" className="text-sm text-destructive">
                  {errores.claveConfirmar}
                </p>
              )}
            </div>
          </div>
          <Button onClick={cambiarClave} disabled={cambiandoClave} size="sm" variant="outline">
            {cambiandoClave ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
            Actualizar contraseña
          </Button>
        </section>

        {/* Derecho a suprimir */}
        <section className="border border-destructive/30 bg-destructive/5 rounded-lg p-5 space-y-3">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Eliminar mi cuenta y mis datos
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Puedes solicitar la supresión de tus datos personales conforme al artículo 8 de la
            Ley 1581 de 2012. La solicitud se atiende en un máximo de quince (15) días hábiles
            e implica la eliminación permanente de tus recursos, cursos y demás información
            asociada.
          </p>
          <Button variant="destructive" size="sm" onClick={solicitarSupresion}>
            Solicitar eliminación de mis datos
          </Button>
        </section>

        <p className="text-xs text-muted-foreground text-center">
          Consulta la{" "}
          <Link to="/privacidad" className="text-primary hover:underline">
            Política de Tratamiento de Datos Personales
          </Link>
        </p>
      </main>
    </div>
  );
}
