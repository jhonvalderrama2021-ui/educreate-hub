import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FiltroMultiple, opcionesDe } from "@/components/FiltroMultiple";
import { toast } from "sonner";
import {
  Search, Download, ChevronRight, CheckCircle2, MinusCircle, Users, ClipboardList,
} from "lucide-react";
import type { CourseResource, ResourceSubmission } from "@/lib/courses-types";
import {
  revisarEntrega, formatearDuracion, iniciales,
} from "@/lib/examen-respuestas";
import { descargarExcel, type ValorCelda } from "@/lib/export-excel";

/**
 * Estudiantes del curso en cuadrícula, con lo que ha desarrollado cada uno.
 *
 * La tabla anterior mezclaba una fila por entrega: con treinta estudiantes y
 * cinco actividades eran ciento cincuenta filas donde no se distinguía quién
 * iba al día y quién no había entrado. En cuadrícula cada estudiante ocupa
 * una tarjeta con su avance, y al pulsarla se ve todo lo que hizo.
 *
 * El filtro por recurso responde a la otra necesidad: mirar una actividad
 * concreta y ver cómo le fue a todo el grupo en ella.
 */

interface Inscripcion {
  id: string;
  student_id: string;
  enrolled_at: string;
  profile?: { id: string; full_name: string | null; email: string | null };
}

interface Props {
  courseId: string;
  nombreCurso: string;
  inscripciones: Inscripcion[];
  recursos: CourseResource[];
  entregas: ResourceSubmission[];
  /** Contenido de cada recurso generado, para el detalle por pregunta. */
  contenidos: Record<string, any>;
}

export function PanelEstudiantesCurso({
  courseId, nombreCurso, inscripciones, recursos, entregas, contenidos,
}: Props) {
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = useState("");
  const [recursosSel, setRecursosSel] = useState<string[]>([]);
  const [mostrarSinEntrega, setMostrarSinEntrega] = useState(false);

  const opcionesRecurso = useMemo(
    () => opcionesDe(recursos, (r) => r.id, (id) => recursos.find((r) => r.id === id)?.title || id),
    [recursos],
  );

  // Cuando se filtra por recurso, todo lo que se muestra —avance, promedio,
  // exportación— se refiere solo a esas actividades. Si no, al grupo entero.
  const recursosActivos = recursosSel.length > 0
    ? recursos.filter((r) => recursosSel.includes(r.id))
    : recursos;

  const entregasActivas = useMemo(
    () => entregas.filter((e) => recursosActivos.some((r) => r.id === e.course_resource_id)),
    [entregas, recursosActivos],
  );

  const filas = useMemo(() => {
    const texto = busqueda.toLowerCase();
    return inscripciones
      .filter((i) =>
        texto === "" ||
        (i.profile?.full_name || "").toLowerCase().includes(texto) ||
        (i.profile?.email || "").toLowerCase().includes(texto))
      .map((i) => {
        const suyas = entregasActivas.filter((e) => e.student_id === i.student_id);
        const conNota = suyas.filter((e) => e.score !== null && e.max_score);
        const promedio = conNota.length
          ? conNota.reduce((a, e) => a + (e.score! / e.max_score!) * 5, 0) / conNota.length
          : null;
        return {
          inscripcion: i,
          entregas: suyas,
          promedio,
          tiempo: suyas.reduce((a, e) => a + (e.time_spent_seconds || 0), 0),
          pendientes: recursosActivos.length - suyas.length,
        };
      })
      .sort((a, b) =>
        (a.inscripcion.profile?.full_name || "").localeCompare(
          b.inscripcion.profile?.full_name || "", "es"));
  }, [inscripciones, entregasActivas, recursosActivos, busqueda]);

  const hayFiltroActividad = recursosSel.length > 0;

  /**
   * Al filtrar por una actividad, la cuadrícula muestra solo a quienes la
   * entregaron. Antes seguía mostrando a todo el curso con la nota en blanco,
   * y el filtro parecía no hacer nada.
   *
   * Quién NO entregó sigue siendo un dato valioso, así que no desaparece: se
   * cuenta debajo y se puede volver a mostrar con un clic.
   */
  const ocultos = hayFiltroActividad && !mostrarSinEntrega
    ? filas.filter((f) => f.entregas.length === 0)
    : [];
  const visibles = filas.filter((f) => !ocultos.includes(f));

  const sinEmpezar = filas.filter((f) => f.entregas.length === 0).length;

  const resumenVisibles = `${visibles.length} estudiante${visibles.length === 1 ? "" : "s"}`;
  const resumenActividades =
    `viendo ${recursosActivos.length} de ${recursos.length} actividades`;
  // Concuerda con el número de ACTIVIDADES, no con el de estudiantes
  const palabraActividad = recursosActivos.length === 1 ? "esta actividad" : "estas actividades";

  const hoy = () => new Date().toLocaleDateString("es-CO",
    { day: "2-digit", month: "long", year: "numeric" });

  const nombreActividades = () =>
    recursosSel.length === 0
      ? "todas las actividades"
      : recursosActivos.map((r) => r.title).join(", ");

  /**
   * Resumen de todo el grupo, en Excel. Una fila por estudiante y actividad,
   * con la nota como NÚMERO: en CSV llegaba como texto y ordenar por nota
   * dejaba el 10 antes que el 2, que es justo lo contrario de lo que el
   * docente necesita al armar el consolidado del periodo.
   */
  const exportarResumen = async () => {
    if (entregasActivas.length === 0) return toast.error("Aún no hay entregas que exportar");

    const filasExcel: ValorCelda[][] = [];
    for (const f of filas) {
      const nombre = f.inscripcion.profile?.full_name || "Sin nombre";
      const correo = f.inscripcion.profile?.email || "";
      if (f.entregas.length === 0) {
        // Quien no entregó también sale: es justo el dato que el docente busca
        filasExcel.push([nombre, correo, "(sin entregas)", null, null, null, "", ""]);
        continue;
      }
      for (const e of f.entregas) {
        const cr = recursos.find((r) => r.id === e.course_resource_id);
        const nota = e.score !== null && e.max_score ? (e.score / e.max_score) * 5 : null;
        filasExcel.push([
          nombre, correo, cr?.title || "",
          e.score ?? null, e.max_score ?? null, nota,
          formatearDuracion(e.time_spent_seconds),
          new Date(e.submitted_at).toLocaleString("es-CO"),
        ]);
      }
    }

    await descargarExcel(`Resumen ${nombreCurso}`, [{
      nombre: "Resumen de notas",
      titulo: `${nombreCurso} — Consolidado de notas`,
      subtitulo: `${nombreActividades()} · ${filas.length} estudiantes · Generado el ${hoy()}`,
      columnas: [
        { titulo: "Estudiante", ancho: 30 },
        { titulo: "Correo", ancho: 30 },
        { titulo: "Actividad", ancho: 32 },
        { titulo: "Aciertos", ancho: 11, alineacion: "right" },
        { titulo: "Total", ancho: 9, alineacion: "right" },
        { titulo: "Nota (1-5)", ancho: 12, formato: "0.0", alineacion: "right" },
        { titulo: "Tiempo", ancho: 12 },
        { titulo: "Fecha de entrega", ancho: 20 },
      ],
      filas: filasExcel,
    }]);
    toast.success("Resumen descargado");
  };

  /** Detalle pregunta por pregunta de una actividad, para todo el grupo. */
  const exportarDetalle = async () => {
    if (entregasActivas.length === 0) return toast.error("Aún no hay entregas que exportar");

    const filasExcel: ValorCelda[][] = [];
    for (const f of filas) {
      const nombre = f.inscripcion.profile?.full_name || "Sin nombre";
      for (const e of f.entregas) {
        const cr = recursos.find((r) => r.id === e.course_resource_id);
        const preguntas = revisarEntrega(cr ? contenidos[cr.resource_id] : null, e);
        for (const p of preguntas) {
          filasExcel.push([
            nombre, cr?.title || "", p.numero, p.enunciado,
            p.opciones[p.marcada]?.text ?? "(sin responder)",
            p.opciones[p.correcta]?.text ?? "",
            p.acerto ? "Sí" : "No",
          ]);
        }
      }
    }

    if (filasExcel.length === 0) {
      return toast.error("Estas actividades no guardan respuestas por pregunta");
    }

    await descargarExcel(`Detalle ${nombreCurso}`, [{
      nombre: "Detalle por pregunta",
      titulo: `${nombreCurso} — Respuesta por respuesta`,
      subtitulo: `${nombreActividades()} · Generado el ${hoy()}`,
      columnas: [
        { titulo: "Estudiante", ancho: 28 },
        { titulo: "Actividad", ancho: 28 },
        { titulo: "N°", ancho: 6, alineacion: "center" },
        { titulo: "Enunciado", ancho: 45 },
        { titulo: "Respondió", ancho: 30 },
        { titulo: "Correcta", ancho: 30 },
        { titulo: "¿Acertó?", ancho: 11, alineacion: "center" },
      ],
      filas: filasExcel,
    }]);
    toast.success("Detalle descargado");
  };

  if (inscripciones.length === 0) {
    return (
      <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
        Sin estudiantes inscritos todavía.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Buscar estudiante"
            placeholder="Buscar estudiante..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>

        <FiltroMultiple
          etiqueta="Actividad"
          opciones={opcionesRecurso}
          seleccion={recursosSel}
          onCambio={(sel) => {
            setRecursosSel(sel);
            // Al cambiar de actividad se vuelve a ocultar a quienes no
            // entregaron: si no, el "ver" de la actividad anterior se
            // arrastra y el filtro nuevo parece no hacer nada.
            setMostrarSinEntrega(false);
          }}
          className="w-[230px]"
        />

        <Button variant="outline" size="sm" onClick={() => { void exportarResumen(); }}>
          <Download className="h-4 w-4 mr-2" /> Resumen en Excel
        </Button>
        <Button variant="outline" size="sm" onClick={() => { void exportarDetalle(); }}>
          <ClipboardList className="h-4 w-4 mr-2" /> Detalle en Excel
        </Button>
      </div>

      {hayFiltroActividad && (
        <p className="text-xs text-muted-foreground">
          Las descargas incluyen al curso completo, también a quienes no
          entregaron: es lo que hace falta para el consolidado de notas.
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        <span>{resumenVisibles}</span>
        {hayFiltroActividad && <span>{" · " + resumenActividades}</span>}
        {!hayFiltroActividad && sinEmpezar > 0 && (
          <span>{` · ${sinEmpezar} sin entregar nada`}</span>
        )}
        {ocultos.length > 0 && (
          <>
            {" · "}
            <button
              type="button"
              onClick={() => setMostrarSinEntrega(true)}
              className="underline hover:text-foreground"
            >
              {`${ocultos.length} sin entregar ${palabraActividad} (ver)`}
            </button>
          </>
        )}
        {hayFiltroActividad && mostrarSinEntrega && sinEmpezar > 0 && (
          <>
            {" · "}
            <button
              type="button"
              onClick={() => setMostrarSinEntrega(false)}
              className="underline hover:text-foreground"
            >
              ocultar a quienes no entregaron
            </button>
          </>
        )}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {visibles.map(({ inscripcion, entregas: suyas, promedio, tiempo, pendientes }) => {
          const nombre = inscripcion.profile?.full_name || "Sin nombre";
          const completo = pendientes <= 0 && recursosActivos.length > 0;

          return (
            <button
              key={inscripcion.id}
              type="button"
              onClick={() => navigate(`/resources/courses/${courseId}/student-report/${inscripcion.student_id}`)}
              className="glass-card rounded-xl p-4 text-left hover:border-primary/40 transition-colors space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                  suyas.length === 0 ? "bg-muted" : "gradient-primary"
                }`}>
                  <span className={`text-sm font-bold ${
                    suyas.length === 0 ? "text-muted-foreground" : "text-primary-foreground"
                  }`}>
                    {iniciales(nombre)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground truncate text-sm">{nombre}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {inscripcion.profile?.email}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </div>

              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1 text-muted-foreground">
                  {completo ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <MinusCircle className="h-3.5 w-3.5" />
                  )}
                  {suyas.length} de {recursosActivos.length} entregada{recursosActivos.length === 1 ? "" : "s"}
                </span>
                <span className="text-muted-foreground">{formatearDuracion(tiempo)}</span>
              </div>

              <div className="flex items-end justify-between gap-2">
                <div>
                  <div className="text-xs text-muted-foreground">Promedio</div>
                  <div className="text-lg font-semibold text-foreground">
                    {promedio === null ? "—" : promedio.toFixed(1)}
                    <span className="text-xs font-normal text-muted-foreground"> / 5,0</span>
                  </div>
                </div>
                {suyas.length === 0 && (
                  <span className="text-xs text-muted-foreground">Sin empezar</span>
                )}
              </div>

              {/* Una marca por actividad: de un vistazo se ve qué le falta y
                  en cuáles le fue mal, sin abrir el informe. */}
              {recursosActivos.length > 0 && recursosActivos.length <= 12 && (
                <div className="flex flex-wrap gap-1">
                  {recursosActivos.map((r) => {
                    const e = suyas.find((x) => x.course_resource_id === r.id);
                    const nota = e && e.max_score ? (e.score! / e.max_score) * 5 : null;
                    return (
                      <span
                        key={r.id}
                        title={`${r.title}: ${nota === null ? "sin entregar" : nota.toFixed(1)}`}
                        className={`h-1.5 flex-1 min-w-[10px] rounded-full ${
                          nota === null ? "bg-muted"
                            : nota >= 3 ? "bg-primary"
                            : "bg-destructive/60"
                        }`}
                      />
                    );
                  })}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {visibles.length === 0 && (
        <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
          Ningún estudiante coincide con la búsqueda.
        </div>
      )}
    </div>
  );
}
