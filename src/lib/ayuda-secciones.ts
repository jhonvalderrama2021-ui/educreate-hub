/**
 * Secciones del centro de ayuda a las que el administrador puede asociar
 * capturas de pantalla.
 *
 * Los identificadores deben coincidir con los de `src/pages/resources/Ayuda.tsx`.
 * Si se agrega una sección nueva allí, hay que registrarla aquí también para
 * que aparezca en el gestor de imágenes del panel de administración.
 */
export const SECCIONES_AYUDA = [
  { id: "generar", titulo: "Cómo crear tu primer recurso" },
  { id: "pdf", titulo: "Usar tu propio documento como base" },
  { id: "editar", titulo: "Revisar y corregir antes de usarlo" },
  { id: "exportar", titulo: "Descargar en Word, PDF o PowerPoint" },
  { id: "examenes", titulo: "Exámenes" },
  { id: "rubricas", titulo: "Rúbricas" },
  { id: "plan", titulo: "Plan de clase" },
  { id: "talleres", titulo: "Talleres" },
  { id: "diapositivas", titulo: "Diapositivas" },
  { id: "bots", titulo: "Bots educativos" },
  { id: "juegos", titulo: "Crucigramas y cuentos" },
  { id: "cursos", titulo: "Mini cursos" },
  { id: "historial", titulo: "Historial" },
] as const;

export type SeccionAyuda = (typeof SECCIONES_AYUDA)[number]["id"];
