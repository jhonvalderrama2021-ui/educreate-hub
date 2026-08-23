/**
 * Catálogos de los formularios de generación.
 *
 * Viven en la tabla `catalogos` y el administrador los mantiene desde el
 * panel, para que —como pidió el asesor— "este sistema no quede congelado en
 * el tiempo": agregar una metodología nueva ya no exige tocar el código.
 *
 * Las listas de abajo son el respaldo. Si la consulta falla o la tabla queda
 * vacía por accidente, el docente sigue viendo las mismas opciones de
 * siempre en vez de un desplegable vacío que le impide trabajar.
 */

export type TipoCatalogo = "asignatura" | "metodologia";

export const ASIGNATURAS_BASE = [
  "Matemáticas",
  "Español y Literatura",
  "Lengua Castellana",
  "Inglés",
  "Francés",
  "Ciencias Naturales",
  "Biología",
  "Química",
  "Física",
  "Ciencias Sociales",
  "Historia",
  "Geografía",
  "Filosofía",
  "Economía",
  "Política y Constitución",
  "Cátedra de la Paz",
  "Educación Ética y Valores Humanos",
  "Educación Religiosa",
  "Educación Artística",
  "Música",
  "Danza",
  "Teatro",
  "Artes Plásticas",
  "Educación Física, Recreación y Deportes",
  "Tecnología e Informática",
  "Programación y Computación",
  "Robótica",
  "Emprendimiento",
  "Educación Ambiental",
  "Lectura Crítica",
  "Competencias Ciudadanas",
  "Orientación Vocacional",
];

export const METODOLOGIAS_BASE = [
  "Aprendizaje Basado en Proyectos (ABP)",
  "Aprendizaje Basado en Problemas",
  "Aula Invertida (Flipped Classroom)",
  "Aprendizaje Cooperativo",
  "Gamificación",
  "Design Thinking aplicado a la educación",
  "Método Socrático",
  "Aprendizaje Experiencial (Kolb)",
  "Aprendizaje Basado en Competencias",
  "Método Montessori (adaptado)",
  "Aprendizaje Servicio",
  "Enseñanza Explícita",
  "Pensamiento Visible (Visible Thinking)",
  "Aprendizaje Multimodal",
  "STEM / STEAM",
  "Aprendizaje Personalizado",
  "Aprendizaje colaborativo",
  "Clase magistral",
];

export const RESPALDO: Record<TipoCatalogo, string[]> = {
  asignatura: ASIGNATURAS_BASE,
  metodologia: METODOLOGIAS_BASE,
};

export const ETIQUETA_CATALOGO: Record<TipoCatalogo, { singular: string; plural: string }> = {
  asignatura: { singular: "Asignatura", plural: "Asignaturas" },
  metodologia: { singular: "Metodología", plural: "Metodologías" },
};

export interface EntradaCatalogo {
  id: string;
  tipo: TipoCatalogo;
  valor: string;
  orden: number;
  activo: boolean;
  created_at: string;
}
