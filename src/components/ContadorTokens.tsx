import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Coins, Info } from "lucide-react";

/**
 * Cuántos tokens de generación le quedan a la persona hoy.
 *
 * Es un tope, no un cobro: la plataforma es beta y va para instituciones. El
 * tope existe para que una tarde de pruebas no se lleve por delante la clave
 * de OpenAI del proyecto.
 *
 * El número viene de la base en cada consulta. Guardarlo en el navegador
 * sería más rápido pero mostraría un saldo desactualizado justo cuando
 * importa: al quedarse sin tokens.
 */

export const CLAVE_TOKENS = (uid?: string) => ["tokens", uid] as const;

interface Saldo {
  disponibles: number;
  limite_diario: number;
  usados_hoy: number;
  extra_hoy: number;
}

export function ContadorTokens() {
  const { user } = useAuth();

  const { data: saldo } = useQuery({
    queryKey: CLAVE_TOKENS(user?.id),
    enabled: !!user,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("tokens_disponibles", {}).maybeSingle();
      if (error) throw error;
      return data as Saldo | null;
    },
  });

  const { data: costos = [] } = useQuery({
    queryKey: ["token_costos"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("token_costos")
        .select("recurso, tokens, descripcion")
        .order("tokens", { ascending: false });
      return data ?? [];
    },
  });

  if (!user || !saldo) return null;

  const total = saldo.limite_diario + saldo.extra_hoy;
  const proporcion = total > 0 ? saldo.disponibles / total : 0;
  // Los avisos aparecen cuando todavía se puede hacer algo al respecto, no
  // cuando ya no quedan.
  const escaso = saldo.disponibles <= 30;
  const agotado = saldo.disponibles <= 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
            agotado
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : escaso
              ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-500"
              : "border-border hover:bg-muted/60 text-foreground"
          }`}
          aria-label={`Te quedan ${saldo.disponibles} de ${total} tokens hoy`}
        >
          <Coins className="h-4 w-4 shrink-0" />
          <span className="font-semibold tabular-nums">{saldo.disponibles}</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">/ {total}</span>
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div>
            <p className="font-medium text-foreground text-sm">Tokens de hoy</p>
            <p className="text-xs text-muted-foreground">
              Se recargan cada día a la medianoche. Solo cuesta <strong>generar</strong>:
              editar, exportar y armar mini cursos son gratis.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  agotado ? "bg-destructive" : escaso ? "bg-amber-500" : "bg-primary"
                }`}
                style={{ width: `${Math.max(0, Math.min(100, proporcion * 100))}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Has usado {saldo.usados_hoy} de {total}
              {saldo.extra_hoy > 0 && ` (incluye ${saldo.extra_hoy} que te amplió el administrador)`}
            </p>
          </div>

          {agotado && (
            <p className="text-xs rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-destructive">
              Se te acabaron por hoy. Vuelven mañana, o pídele al administrador
              que te amplíe el cupo.
            </p>
          )}

          {costos.length > 0 && (
            <div className="space-y-1 border-t border-border pt-2">
              <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Info className="h-3 w-3" /> Cuánto cuesta cada uno
              </p>
              <ul className="space-y-0.5">
                {costos.map((c: any) => (
                  <li key={c.recurso} className="flex justify-between text-xs text-muted-foreground">
                    <span className="truncate">{c.descripcion || c.recurso}</span>
                    <span className="tabular-nums shrink-0 ml-2">{c.tokens}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
