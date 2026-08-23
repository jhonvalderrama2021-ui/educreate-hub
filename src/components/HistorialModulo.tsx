import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FiltroMultiple, opcionesDe } from "@/components/FiltroMultiple";
import { History, ChevronLeft, ChevronRight, Loader2, FileClock } from "lucide-react";

/**
 * Franja lateral con los recursos que el docente ya creó en ESTE módulo.
 *
 * Acordado en la reunión de asesoría: al entrar a Exámenes el formulario
 * queda a la izquierda y a la derecha los exámenes anteriores, en lugar de
 * mandar al docente al historial general y hacerle buscar entre todos los
 * tipos de recurso.
 *
 * Comparte la caché de React Query con el historial general
 * (`["generated_resources", uid]`), así que el guardado automático y el
 * canal en tiempo real de esa pantalla también refrescan esta franja.
 *
 * Aquí solo se filtra por grado y asignatura: el tipo de recurso ya lo fija
 * el módulo en el que está el docente.
 */

export interface RecursoHistorial {
  id: string;
  title: string;
  resource_type: string;
  content: any;
  is_public: boolean;
  subject: string | null;
  grade: string | null;
  created_at: string;
}

const POR_PAGINA = 10;

export const CLAVE_RECURSOS = (uid?: string) => ["generated_resources", uid] as const;

interface Props {
  /** Tipos que pertenecen a este módulo. Un examen no debe salir en cuentos. */
  tipos: string[];
  /** Se invoca al pulsar un recurso, para cargarlo en el visor del módulo. */
  onAbrir: (recurso: RecursoHistorial) => void;
  /** Id del recurso que se está viendo, para resaltarlo en la lista. */
  activo?: string | null;
  titulo?: string;
}

export function HistorialModulo({ tipos, onAbrir, activo, titulo = "Creados anteriormente" }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [pagina, setPagina] = useState(0);
  const [asignaturas, setAsignaturas] = useState<string[]>([]);
  const [grados, setGrados] = useState<string[]>([]);

  const { data: todos = [], isLoading } = useQuery({
    queryKey: CLAVE_RECURSOS(user?.id),
    enabled: !!user,
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("generated_resources")
        .select("id, title, resource_type, content, is_public, subject, grade, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as RecursoHistorial[];
    },
  });

  // Si el docente genera desde otro dispositivo o se guarda solo, la franja
  // debe reflejarlo sin recargar la página.
  useEffect(() => {
    if (!user) return;
    const canal = supabase
      .channel(`historial-modulo-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "generated_resources", filter: `user_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey: CLAVE_RECURSOS(user.id) }),
      )
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [user, queryClient]);

  const delModulo = useMemo(
    () => todos.filter((r) => tipos.includes(r.resource_type)),
    [todos, tipos],
  );

  // Las opciones se arman con lo que hay en ESTE módulo: ofrecer un grado que
  // el docente nunca usó aquí solo daría una lista vacía al elegirlo.
  const opcionesAsignatura = useMemo(
    () => opcionesDe(delModulo, (r) => r.subject),
    [delModulo],
  );
  const opcionesGrado = useMemo(
    () => opcionesDe(delModulo, (r) => r.grade, (g) => `Grado ${g}`),
    [delModulo],
  );

  const propios = useMemo(
    () => delModulo.filter((r) =>
      (asignaturas.length === 0 || (r.subject && asignaturas.includes(r.subject))) &&
      (grados.length === 0 || (r.grade && grados.includes(r.grade)))),
    [delModulo, asignaturas, grados],
  );

  const hayFiltros = asignaturas.length > 0 || grados.length > 0;
  const paginas = Math.max(1, Math.ceil(propios.length / POR_PAGINA));

  // Al filtrar, borrar o cambiar de módulo, la página actual puede quedar
  // fuera de rango y la franja aparecería vacía sin explicación.
  const paginaValida = Math.min(pagina, paginas - 1);
  useEffect(() => { if (pagina !== paginaValida) setPagina(paginaValida); }, [pagina, paginaValida]);

  const visibles = propios.slice(paginaValida * POR_PAGINA, paginaValida * POR_PAGINA + POR_PAGINA);

  return (
    <aside className="glass-card rounded-xl p-4 space-y-3 lg:sticky lg:top-4 self-start">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-primary shrink-0" />
        <h2 className="font-semibold text-sm text-foreground flex-1">{titulo}</h2>
        {delModulo.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {hayFiltros ? `${propios.length}/${delModulo.length}` : delModulo.length}
          </span>
        )}
      </div>

      {(opcionesAsignatura.length > 1 || opcionesGrado.length > 1) && (
        <div className="flex flex-col gap-1.5">
          {opcionesAsignatura.length > 1 && (
            <FiltroMultiple
              etiqueta="Asignatura"
              opciones={opcionesAsignatura}
              seleccion={asignaturas}
              onCambio={setAsignaturas}
              className="w-full"
            />
          )}
          {opcionesGrado.length > 1 && (
            <FiltroMultiple
              etiqueta="Grado"
              opciones={opcionesGrado}
              seleccion={grados}
              onCambio={setGrados}
              className="w-full"
            />
          )}
          {hayFiltros && (
            <button
              type="button"
              onClick={() => { setAsignaturas([]); setGrados([]); }}
              className="self-start text-xs text-muted-foreground hover:text-foreground"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : propios.length === 0 ? (
        <div className="text-center py-8 space-y-2">
          <FileClock className="h-8 w-8 mx-auto text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground">
            {hayFiltros
              ? "Ningún recurso coincide con los filtros."
              : "Aquí aparecerán los recursos que generes en este módulo. Se guardan solos."}
          </p>
        </div>
      ) : (
        <>
          <ul className="space-y-1.5">
            {visibles.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onAbrir(r)}
                  aria-current={activo === r.id ? "true" : undefined}
                  className={`w-full text-left rounded-lg px-3 py-2 transition-colors ${
                    activo === r.id
                      ? "bg-primary/10 border border-primary/40"
                      : "hover:bg-muted/60 border border-transparent"
                  }`}
                >
                  <span className="block text-sm font-medium text-foreground line-clamp-2">
                    {r.title}
                  </span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    {r.subject && `${r.subject} · `}
                    {r.grade && `Grado ${r.grade} · `}
                    {new Date(r.created_at).toLocaleDateString("es-CO")}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {paginas > 1 && (
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-border">
              <Button
                variant="ghost" size="sm" className="h-8 px-2"
                disabled={paginaValida === 0}
                onClick={() => setPagina(paginaValida - 1)}
                aria-label="Página anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">
                Página {paginaValida + 1} de {paginas}
              </span>
              <Button
                variant="ghost" size="sm" className="h-8 px-2"
                disabled={paginaValida >= paginas - 1}
                onClick={() => setPagina(paginaValida + 1)}
                aria-label="Página siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </aside>
  );
}
