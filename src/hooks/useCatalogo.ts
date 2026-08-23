import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RESPALDO, type TipoCatalogo } from "@/lib/catalogos";

/**
 * Opciones de un catálogo, mantenidas por el administrador.
 *
 * Devuelve siempre una lista utilizable: si la consulta falla o la tabla
 * quedó vacía, cae en los valores de respaldo. Un desplegable vacío dejaría
 * al docente sin poder generar nada, y eso es peor que mostrar una lista
 * ligeramente desactualizada.
 */
export function useCatalogo(tipo: TipoCatalogo): string[] {
  const { data } = useQuery({
    queryKey: ["catalogo", tipo],
    // Cambian muy de vez en cuando: no vale la pena reconsultarlos a cada rato.
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalogos")
        .select("valor")
        .eq("tipo", tipo)
        .eq("activo", true)
        .order("orden", { ascending: true })
        .order("valor", { ascending: true });
      if (error) throw error;
      return (data || []).map((f) => f.valor);
    },
  });

  return data && data.length > 0 ? data : RESPALDO[tipo];
}
