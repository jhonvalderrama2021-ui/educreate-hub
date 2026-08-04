/**
 * Indicador de carga que se muestra mientras React descarga el chunk
 * de una ruta cargada de forma diferida (React.lazy).
 */
export function RouteFallback() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center bg-background">
      <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
