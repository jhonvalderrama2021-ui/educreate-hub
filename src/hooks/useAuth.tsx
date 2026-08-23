import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { User, Session } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        if (session?.user) verificarActivo(session.user.id);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) verificarActivo(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, session, loading, signOut };
}

/**
 * El administrador puede desactivar una cuenta sin borrarla. Aquí se cierra
 * la sesión para que la persona vea el aviso en vez de una pantalla que
 * falla sin explicación.
 *
 * Esto es cortesía, no seguridad: quien abra la consola del navegador puede
 * saltárselo. El bloqueo de verdad está en las Edge Functions y en las
 * políticas de la base de datos, que es donde está el gasto y los datos.
 */
async function verificarActivo(idUsuario: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("activo")
    .eq("id", idUsuario)
    // maybeSingle: el perfil se crea con un disparador y puede no existir
    // todavia en el primer instante tras el registro.
    .maybeSingle();

  // Un error de red no debe expulsar a nadie de la plataforma.
  if (error || data?.activo !== false) return;

  toast.error("Tu cuenta fue desactivada. Comunícate con el administrador.", { duration: 10000 });
  await supabase.auth.signOut();
}
