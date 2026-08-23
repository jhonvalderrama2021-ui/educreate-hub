import { Sparkles, AlertTriangle, FileSearch } from "lucide-react";

interface MetaIA {
  generadoPorIA?: boolean;
  modelo?: string;
  proveedor?: string;
  fecha?: string;
  requiereValidacionDocente?: boolean;
  documentoFuente?: {
    metodo?: "seleccion" | "recorte" | "completo";
    caracteresOriginales?: number;
    caracteresUsados?: number;
    fragmentosTotales?: number;
    fragmentosUsados?: number;
  };
}

const numero = (n?: number) => (n ?? 0).toLocaleString("es-CO");

/**
 * Aviso de transparencia algorítmica.
 *
 * El Marco Ético para la Inteligencia Artificial en Colombia (MinTIC, 2023) y
 * el CONPES 3975 de 2019 exigen transparencia y supervisión humana en los
 * sistemas automatizados. Este aviso informa al docente que el contenido
 * proviene de un modelo de IA, con qué modelo se generó, y que la validación
 * pedagógica sigue siendo suya.
 */
export function AvisoContenidoIA({ meta }: { meta?: MetaIA }) {
  if (!meta?.generadoPorIA) return null;

  const fecha = meta.fecha
    ? new Date(meta.fecha).toLocaleDateString("es-CO", {
        day: "2-digit", month: "long", year: "numeric",
      })
    : null;

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
      <div className="flex gap-2">
        <Sparkles className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
        <div className="space-y-1">
          <p className="font-medium text-foreground">
            Contenido generado con inteligencia artificial
          </p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Este recurso fue producido automáticamente
            {meta.modelo && <> por el modelo <span className="font-mono">{meta.modelo}</span></>}
            {meta.proveedor && <> de {meta.proveedor}</>}
            {fecha && <> el {fecha}</>}.
          </p>
          {/* Un documento largo no entra entero en la petición. Decirlo evita
              que el docente crea que se usó su material completo. */}
          {meta.documentoFuente && (
            <p className="flex gap-1.5 text-xs text-muted-foreground">
              <FileSearch className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                {meta.documentoFuente.metodo === "seleccion" ? (
                  <>
                    Tu documento tiene {numero(meta.documentoFuente.caracteresOriginales)} caracteres.
                    Se usaron los {meta.documentoFuente.fragmentosUsados} fragmentos
                    más relacionados con lo que pediste
                    ({numero(meta.documentoFuente.caracteresUsados)} caracteres
                    de {meta.documentoFuente.fragmentosTotales} fragmentos en total).
                  </>
                ) : (
                  <>
                    Tu documento tiene {numero(meta.documentoFuente.caracteresOriginales)} caracteres
                    y no se pudo analizar por partes, así que se usaron los
                    primeros {numero(meta.documentoFuente.caracteresUsados)}.
                  </>
                )}
              </span>
            </p>
          )}

          {meta.requiereValidacionDocente && (
            <p className="flex gap-1.5 text-xs text-amber-700 dark:text-amber-500">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                Revísalo y ajústalo antes de llevarlo al aula. La IA puede
                cometer errores conceptuales y la decisión pedagógica final es tuya.
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
