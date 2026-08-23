import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Cada cuánto se avisa a la base de que la persona sigue ahí. */
const INTERVALO_MS = 4 * 60_000;

/**
 * Registra el tiempo con la plataforma abierta y activa.
 *
 * El asesor lo pidió con un caso concreto: *"a veces los estudiantes dicen
 * 'es que yo sí me conecté toda la noche' y se va a ver la auditoría: entró
 * 10 minutos"*.
 *
 * Solo late mientras la pestaña está visible. Si la persona deja el navegador
 * abierto y se va, deja de contar a los pocos minutos y la base cierra esa
 * sesión sola: contar una pestaña olvidada como ocho horas de estudio haría
 * la auditoría inútil, justo al revés de lo que se busca.
 */
export function useRegistroAcceso(activo: boolean) {
  const ultimoEnvio = useRef(0);

  useEffect(() => {
    if (!activo) return;

    const latir = async () => {
      if (document.visibilityState !== "visible") return;
      // Volver a la pestaña dispara el evento de visibilidad; sin esta guarda
      // alternar entre ventanas generaria una consulta por cada cambio.
      if (Date.now() - ultimoEnvio.current < 60_000) return;
      ultimoEnvio.current = Date.now();
      // try/catch y no .catch(): el constructor de consultas de Supabase solo
      // implementa `then`, así que encadenar .catch lanza un TypeError y la
      // auditoría se quedaría siempre vacía sin que nadie lo note.
      //
      // Un fallo aquí no debe romper nada: la auditoría es secundaria frente
      // a que el docente pueda trabajar.
      try {
        await supabase.rpc("registrar_acceso");
      } catch (e) {
        console.error("No se pudo registrar el acceso:", e);
      }
    };

    latir();
    const temporizador = setInterval(latir, INTERVALO_MS);
    document.addEventListener("visibilitychange", latir);

    return () => {
      clearInterval(temporizador);
      document.removeEventListener("visibilitychange", latir);
    };
  }, [activo]);
}
