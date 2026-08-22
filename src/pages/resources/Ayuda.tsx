import { useState } from "react";
import {
  HelpCircle, ChevronDown, FileCheck, ClipboardList, Table2, FileEdit,
  Presentation, Bot, Puzzle, BookText, GraduationCap, History, Upload,
  Pencil, Download, ShieldCheck, Sparkles, X, Check, Lightbulb,
} from "lucide-react";
import { CampoObservacion } from "@/components/CampoObservacion";

/* ─────────────────────────── Tipos ─────────────────────────── */

interface Opcion {
  nombre: string;
  cuandoUsar: string;
}

interface Modulo {
  id: string;
  titulo: string;
  icono: any;
  paraQue: string;
  campos?: { nombre: string; explicacion: string }[];
  opciones?: { titulo: string; lista: Opcion[] };
  ejemploMal?: string;
  ejemploBien?: string;
  queObtienes?: string[];
  consejo?: string;
}

/* ─────────────────────── Primeros pasos ─────────────────────── */

const PRIMEROS_PASOS: Modulo[] = [
  {
    id: "generar",
    titulo: "Cómo crear tu primer recurso",
    icono: Sparkles,
    paraQue:
      "Todos los módulos funcionan igual: llenas un formulario corto, la plataforma le pide el contenido a la inteligencia artificial y tú revisas el resultado antes de usarlo.",
    campos: [
      { nombre: "Tema", explicacion: "De qué trata el recurso. Es el campo que más influye en el resultado." },
      { nombre: "Título", explicacion: "Opcional. Si lo dejas vacío, la plataforma propone uno." },
      { nombre: "Asignatura", explicacion: "El área. Ayuda a que el contenido use el lenguaje propio de la materia." },
      { nombre: "Nivel educativo", explicacion: "El grado. Ajusta el vocabulario y la exigencia." },
      { nombre: "Instrucciones adicionales", explicacion: "Opcional. Aquí pides lo que no cabe en los otros campos." },
      { nombre: "Archivo fuente", explicacion: "Opcional. Un PDF, Word o texto del que se tomará el contenido." },
    ],
    ejemploMal: "fracciones",
    ejemploBien:
      "Suma y resta de fracciones con distinto denominador, aplicada a situaciones de cocina y de reparto, para grado 5",
    queObtienes: [
      "El recurso aparece en pantalla en 15 a 60 segundos, según su extensión.",
      "Puedes editarlo antes de guardarlo o descargarlo.",
      "Queda en tu historial para volver a usarlo cuando quieras.",
    ],
    consejo:
      "Entre más específico seas en el tema, mejor sale. Escribir solo una palabra funciona, pero el resultado será genérico: la IA no sabe qué enfoque quieres darle.",
  },
  {
    id: "pdf",
    titulo: "Usar tu propio documento como base",
    icono: Upload,
    paraQue:
      "Si ya tienes el material de tu clase en un archivo, la plataforma puede generar el recurso a partir de él en lugar de inventar el contenido desde cero.",
    queObtienes: [
      "El texto del archivo se extrae en tu propio computador, sin subirlo entero a internet.",
      "Verás cuántos caracteres se extrajeron: si dice 0, algo salió mal.",
      "El examen, taller o plan de clase se basará en ese material.",
    ],
    consejo:
      "Funciona con PDF de texto, es decir, aquellos donde puedes seleccionar y copiar palabras. Si tu PDF es una foto o un escaneo, no hay texto que extraer y la plataforma te lo dirá. En ese caso, copia el contenido y pégalo en Instrucciones adicionales.",
  },
  {
    id: "editar",
    titulo: "Revisar y corregir antes de usarlo",
    icono: Pencil,
    paraQue:
      "La inteligencia artificial se equivoca. Puede inventar datos, confundir conceptos o proponer actividades que no encajan con tu grupo. Por eso todo lo que genera es un borrador.",
    queObtienes: [
      "Activa el modo de edición y haz clic sobre cualquier texto para corregirlo.",
      "Guarda cuando termines: los cambios quedan en tu historial.",
    ],
    consejo:
      "Revisa siempre los datos concretos: fechas, cifras, nombres y fórmulas. Es donde la IA más se equivoca, y lo hace con total seguridad, sin avisar de que duda.",
  },
  {
    id: "exportar",
    titulo: "Descargar en Word, PDF o PowerPoint",
    icono: Download,
    paraQue: "Para imprimir el material o llevarlo al aula sin depender de la plataforma.",
    queObtienes: [
      "PDF y Word para exámenes, talleres, planes de clase, rúbricas, crucigramas y cuentos.",
      "PowerPoint y PDF para las diapositivas.",
      "En los exámenes puedes elegir si incluir o no la hoja de respuestas.",
    ],
    consejo:
      "Si vas a entregar el examen a los estudiantes, descárgalo sin respuestas. Descarga una segunda copia con respuestas para ti.",
  },
];

/* ─────────────────────────── Módulos ─────────────────────────── */

const MODULOS: Modulo[] = [
  {
    id: "examenes",
    titulo: "Exámenes",
    icono: FileCheck,
    paraQue:
      "Crear evaluaciones escritas con la estructura de las pruebas Saber 11, listas para imprimir o para resolver en línea dentro de un mini curso.",
    opciones: {
      titulo: "Qué tipo de examen elegir",
      lista: [
        { nombre: "Tipo ICFES", cuandoUsar: "Selección múltiple con única respuesta. Cada pregunta parte de un contexto y evalúa comprensión, no memoria. Es el más parecido a la prueba Saber 11." },
        { nombre: "Falso y verdadero", cuandoUsar: "Afirmaciones para verificar conceptos puntuales. Útil para un repaso rápido o un diagnóstico al inicio de un tema." },
        { nombre: "Mixto", cuandoUsar: "Combina los dos anteriores. Sirve cuando quieres medir comprensión profunda y también cobertura de varios conceptos." },
      ],
    },
    campos: [
      { nombre: "Número de preguntas", explicacion: "Entre 1 y 30. Ten en cuenta que 20 preguntas tardan cerca de un minuto en generarse." },
    ],
    ejemploMal: "Examen de biología",
    ejemploBien:
      "Sistema circulatorio humano: diferencia entre circulación mayor y menor, función de las válvulas cardíacas y recorrido de la sangre oxigenada. Grado 8",
    queObtienes: [
      "Cada pregunta con su contexto, la competencia que evalúa y su nivel de dificultad.",
      "La explicación de por qué la respuesta correcta lo es.",
      "Qué error comete quien elige cada opción incorrecta, útil para retroalimentar.",
      "Hoja de respuestas aparte, para uso del docente.",
    ],
    consejo:
      "Las opciones incorrectas están construidas para parecer razonables: representan errores que un estudiante realmente cometería. Por eso el examen discrimina entre quien entendió y quien no.",
  },
  {
    id: "rubricas",
    titulo: "Rúbricas",
    icono: Table2,
    paraQue:
      "Definir con antelación cómo vas a calificar un trabajo, y poder sustentarlo si un estudiante reclama la nota.",
    opciones: {
      titulo: "Qué tipo de rúbrica elegir",
      lista: [
        { nombre: "Analítica", cuandoUsar: "Evalúa por separado cada aspecto del trabajo (contenido, ortografía, presentación) y les da un peso distinto. Es la más usada y la que mejor retroalimenta, porque el estudiante ve exactamente dónde falló." },
        { nombre: "Holística", cuandoUsar: "Da una sola valoración global del trabajo. Se califica más rápido, pero el estudiante no sabe qué parte mejorar. Útil cuando tienes muchos trabajos y poco tiempo." },
        { nombre: "Lista de verificación", cuandoUsar: "Solo marca si cada elemento está presente o no, sin grados intermedios. Ideal para requisitos objetivos: entregó portada, citó tres fuentes, incluyó bibliografía." },
        { nombre: "Escalar", cuandoUsar: "Ubica el desempeño en una escala continua, por ejemplo de 1 a 5. Sirve cuando la diferencia entre niveles es de grado y no de tipo." },
        { nombre: "De puntos", cuandoUsar: "Asigna un puntaje numérico a cada criterio y suma. Conveniente cuando la nota final debe salir de una cuenta clara." },
      ],
    },
    campos: [
      { nombre: "Niveles de desempeño", explicacion: "Cuántos escalones tendrá la rúbrica: 3, 4, 5 o los que definas tú con sus propios nombres." },
      { nombre: "Objetivo", explicacion: "Qué competencia o desempeño vas a evaluar. De aquí se derivan los criterios." },
    ],
    ejemploMal: "Rúbrica para exposición",
    ejemploBien:
      "Rúbrica analítica de 4 niveles para evaluar una exposición oral en grupo sobre los ecosistemas de Colombia, valorando dominio del tema, uso del material de apoyo, claridad al hablar y trabajo en equipo. Grado 7",
    queObtienes: [
      "Entre 4 y 6 criterios, cada uno con su peso porcentual.",
      "Los pesos suman exactamente 100.",
      "Un descriptor observable por cada nivel, redactado de forma que dos docentes distintos califiquen igual.",
      "Indicaciones de cómo aplicarla y cómo convertir los niveles en nota.",
    ],
    consejo:
      "Los descriptores evitan a propósito expresiones como excelente, bueno o regular. En su lugar describen qué hace o qué produce el estudiante en cada nivel, que es lo que permite defender la calificación ante un reclamo.",
  },
  {
    id: "plan",
    titulo: "Plan de clase",
    icono: ClipboardList,
    paraQue:
      "Preparar una clase completa, con el detalle suficiente para que otro docente pudiera dictarla en tu lugar.",
    campos: [
      { nombre: "Metodología", explicacion: "El enfoque pedagógico. La estructura del plan cambia realmente según cuál elijas." },
      { nombre: "Duración", explicacion: "El tiempo disponible. Los tiempos de cada fase suman exactamente esta duración." },
    ],
    ejemploMal: "Plan de clase de historia",
    ejemploBien:
      "La Independencia de Colombia: causas económicas y sociales del 20 de julio de 1810, para grado 9, en 55 minutos, con aprendizaje basado en problemas",
    queObtienes: [
      "Fases de inicio, desarrollo y cierre, con su tiempo asignado.",
      "Qué hace el docente y qué hacen los estudiantes, por separado y paso a paso.",
      "Preguntas orientadoras redactadas tal como las dirías en voz alta.",
      "Saberes previos, materiales con cantidades, y criterios de evaluación con indicadores.",
      "Ajustes para quienes necesitan apoyo y retos para quienes terminan antes.",
    ],
  },
  {
    id: "talleres",
    titulo: "Talleres",
    icono: FileEdit,
    paraQue:
      "Diseñar una sesión práctica donde los estudiantes producen algo, en lugar de escuchar.",
    opciones: {
      titulo: "Metodologías más usadas",
      lista: [
        { nombre: "Aprendizaje basado en proyectos", cuandoUsar: "Los estudiantes elaboran un producto a lo largo de varias sesiones. Útil para temas amplios." },
        { nombre: "Aprendizaje basado en problemas", cuandoUsar: "Se parte de una situación real que deben resolver. Bueno para ciencias y matemáticas." },
        { nombre: "Aula invertida", cuandoUsar: "Revisan el contenido en casa y la clase se dedica a practicar. Requiere que tengan acceso al material." },
        { nombre: "Gamificación", cuandoUsar: "Se estructura como un juego con retos y puntos. Funciona bien con grupos difíciles de motivar." },
        { nombre: "Aprendizaje cooperativo", cuandoUsar: "Grupos con roles asignados donde cada uno responde por una parte." },
      ],
    },
    ejemploMal: "Taller de ciencias",
    ejemploBien:
      "Taller sobre densidad de líquidos usando materiales caseros, con aprendizaje basado en problemas, para grado 6, en 90 minutos",
    queObtienes: [
      "Entre 3 y 5 actividades con secuencia lógica.",
      "Instrucciones numeradas y ejecutables, no descripciones vagas.",
      "Un producto observable por actividad: qué queda hecho al terminar.",
      "Materiales con cantidades, pensados para un aula pública.",
    ],
    consejo:
      "La metodología que elijas cambia de verdad la estructura del taller, no solo su nombre. Si eliges aprendizaje basado en problemas, el taller arranca con la situación a resolver.",
  },
  {
    id: "diapositivas",
    titulo: "Diapositivas",
    icono: Presentation,
    paraQue: "Preparar el apoyo visual de una clase sin tener que diseñarlo.",
    campos: [
      { nombre: "Número de diapositivas", explicacion: "Entre 3 y 20. Cada una se genera por separado, así que más diapositivas tardan más." },
      { nombre: "Paleta de colores", explicacion: "El esquema visual de la presentación." },
    ],
    ejemploBien:
      "Los estados de la materia y sus cambios, con ejemplos cotidianos, para grado 4, en 8 diapositivas",
    queObtienes: [
      "Una diapositiva de apertura, varias de desarrollo y una de cierre.",
      "Distintos formatos: tarjetas, procesos, comparaciones, líneas de tiempo.",
      "Descarga en PowerPoint para editarla, o en PDF para proyectarla.",
    ],
  },
  {
    id: "bots",
    titulo: "Bots educativos",
    icono: Bot,
    paraQue:
      "Crear un asistente que responde dudas de una materia concreta, para que tus estudiantes consulten cuando tú no estás disponible.",
    queObtienes: [
      "Un asistente que solo responde sobre la especialidad que le asignaste.",
      "Conversación guardada, para retomarla después.",
    ],
    consejo:
      "El bot está diseñado para no resolverle la tarea al estudiante. Explica el concepto, muestra un ejemplo distinto y le devuelve el ejercicio. Es deliberado: un asistente que da la respuesta lista no enseña nada.",
  },
  {
    id: "juegos",
    titulo: "Crucigramas y cuentos",
    icono: Puzzle,
    paraQue: "Trabajar vocabulario y comprensión de una forma más ligera.",
    queObtienes: [
      "Crucigrama: indica el tema y cuántas palabras quieres en horizontal y vertical.",
      "Cuento: define personaje, temática, edad de los lectores y extensión.",
      "Los cuentos se generan con ilustraciones automáticas.",
    ],
    consejo:
      "En el crucigrama puedes subir un PDF para que las palabras salgan de tu propio material, en lugar de conocimiento general.",
  },
  {
    id: "cursos",
    titulo: "Mini cursos",
    icono: GraduationCap,
    paraQue:
      "Reunir varios recursos para un grupo de estudiantes y hacerles seguimiento.",
    queObtienes: [
      "Un código de acceso que compartes con tus estudiantes para que se inscriban.",
      "Los recursos que ya generaste, ordenados como tú decidas.",
      "Exámenes y crucigramas resolubles en línea, con calificación automática.",
      "Reporte por estudiante con sus entregas y resultados.",
    ],
    consejo:
      "Para inscribir a un estudiante escribiendo su correo, esa persona debe haber creado antes su cuenta en la plataforma. Si aún no lo ha hecho, compártele el código de acceso y que se inscriba sola.",
  },
  {
    id: "historial",
    titulo: "Historial",
    icono: History,
    paraQue: "Recuperar cualquier recurso que hayas creado antes.",
    queObtienes: [
      "Todos tus recursos, filtrables por tipo.",
      "Volver a verlos, exportarlos de nuevo o eliminarlos.",
      "Marcar uno como público para compartirlo con otros docentes.",
    ],
  },
];

/* ─────────────────── Solución de problemas ─────────────────── */

const PROBLEMAS = [
  {
    p: "La generación tarda mucho o parece congelada",
    r: "Los recursos extensos, como un examen de 20 preguntas o una presentación de 15 diapositivas, pueden tardar cerca de un minuto. Mientras veas el indicador de carga, el proceso sigue en marcha. Evita cerrar o recargar la página.",
  },
  {
    p: "Dice que el archivo tiene 0 caracteres",
    r: "Tu PDF es una imagen o un escaneo: no tiene texto que se pueda seleccionar, así que no hay nada que extraer. Prueba con un PDF donde puedas copiar palabras, o copia el contenido y pégalo en Instrucciones adicionales.",
  },
  {
    p: "Aparece «Servicio de IA no disponible»",
    r: "La clave del servicio de inteligencia artificial no está configurada o dejó de ser válida. Lo resuelve el administrador de la plataforma desde su panel.",
  },
  {
    p: "El contenido generado tiene errores",
    r: "Puede pasar, y es esperable. Usa el modo de edición para corregirlo. Si el resultado no te sirve del todo, agrega más detalle en el tema o en las instrucciones y vuelve a generar: el resultado cambia bastante.",
  },
  {
    p: "No puedo inscribir a un estudiante por su correo",
    r: "Esa persona debe tener una cuenta creada en la plataforma antes de que puedas inscribirla. Si aún no la tiene, compártele el código de acceso del curso para que se inscriba sola.",
  },
  {
    p: "No veo algunos módulos en el menú",
    r: "El menú cambia según tu rol. Las cuentas de estudiante ven menos módulos que las de docente. Si crees que tu rol está mal asignado, contacta al administrador.",
  },
  {
    p: "Olvidé mi contraseña",
    r: "En la pantalla de acceso, pulsa «¿Olvidaste tu contraseña?», escribe tu correo y recibirás un enlace para crear una nueva. Revisa también la carpeta de correo no deseado.",
  },
];

/* ─────────────────────── Componentes ─────────────────────── */

function Acordeon({ modulo }: { modulo: Modulo }) {
  const [abierto, setAbierto] = useState(false);
  const Icono = modulo.icono;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/40 transition-colors"
      >
        <Icono className="h-5 w-5 shrink-0 text-primary" />
        <span className="flex-1 font-medium text-foreground">{modulo.titulo}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${abierto ? "rotate-180" : ""}`}
        />
      </button>

      {abierto && (
        <div className="px-4 pb-4 space-y-4">
          <p className="text-sm text-foreground leading-relaxed">{modulo.paraQue}</p>

          {modulo.opciones && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">
                {modulo.opciones.titulo}
              </p>
              <div className="space-y-2">
                {modulo.opciones.lista.map((o) => (
                  <div key={o.nombre} className="rounded-md bg-muted/40 p-3">
                    <p className="text-sm font-medium text-foreground">{o.nombre}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">
                      {o.cuandoUsar}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {modulo.campos && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">
                Qué significa cada campo
              </p>
              <dl className="space-y-1.5">
                {modulo.campos.map((c) => (
                  <div key={c.nombre} className="text-sm">
                    <dt className="inline font-medium text-foreground">{c.nombre}: </dt>
                    <dd className="inline text-muted-foreground">{c.explicacion}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {(modulo.ejemploMal || modulo.ejemploBien) && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">
                Ejemplo de qué escribir en el tema
              </p>
              {modulo.ejemploMal && (
                <div className="flex gap-2 rounded-md border border-destructive/25 bg-destructive/5 p-3">
                  <X className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-foreground mb-0.5">Muy escueto</p>
                    <p className="text-sm text-muted-foreground italic">«{modulo.ejemploMal}»</p>
                  </div>
                </div>
              )}
              {modulo.ejemploBien && (
                <div className="flex gap-2 rounded-md border border-primary/25 bg-primary/5 p-3">
                  <Check className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-foreground mb-0.5">Así sí</p>
                    <p className="text-sm text-muted-foreground italic">«{modulo.ejemploBien}»</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {modulo.queObtienes && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Qué obtienes</p>
              <ul className="space-y-1 text-sm text-foreground">
                {modulo.queObtienes.map((q, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-primary shrink-0">•</span>
                    <span className="leading-relaxed">{q}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {modulo.consejo && (
            <div className="flex gap-2 rounded-md bg-muted/40 p-3">
              <Lightbulb className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed">{modulo.consejo}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Ayuda() {
  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
      <header className="text-center">
        <div className="mx-auto h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center mb-4">
          <HelpCircle className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Centro de ayuda</h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Guía de uso de NexProfe. No necesitas conocimientos previos de
          inteligencia artificial para trabajar con la plataforma.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Primeros pasos</h2>
        <p className="text-sm text-muted-foreground">
          Si es tu primera vez, empieza por aquí.
        </p>
        {PRIMEROS_PASOS.map((m) => <Acordeon key={m.id} modulo={m} />)}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Guía de cada módulo</h2>
        <p className="text-sm text-muted-foreground">
          Qué hace, cuándo usar cada opción y un ejemplo de qué escribir.
        </p>
        {MODULOS.map((m) => <Acordeon key={m.id} modulo={m} />)}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Si algo no funciona</h2>
        <div className="space-y-2">
          {PROBLEMAS.map((item, i) => (
            <div key={i} className="border border-border rounded-lg p-4">
              <p className="font-medium text-foreground text-sm mb-1">{item.p}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.r}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Uso responsable de la IA</h2>

        <div className="border border-border rounded-lg p-4 space-y-3 text-sm">
          <div className="flex gap-3">
            <Sparkles className="h-5 w-5 shrink-0 text-amber-600" />
            <p className="text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Todo lo que genera la plataforma es un borrador.</strong>{" "}
              La inteligencia artificial puede cometer errores conceptuales, inventar datos
              o proponer actividades que no encajan con tu grupo. Revisa siempre antes de usar.
            </p>
          </div>
          <div className="flex gap-3">
            <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
            <p className="text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Tú decides.</strong>{" "}
              La plataforma es una herramienta de apoyo: no reemplaza tu criterio pedagógico
              ni el currículo oficial de tu institución.
            </p>
          </div>
          <div className="flex gap-3">
            <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
            <p className="text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Cuida los datos de tus estudiantes.</strong>{" "}
              No incluyas nombres, documentos de identidad ni información personal
              de menores en las instrucciones ni en los archivos que cargues.
            </p>
          </div>
          <div className="flex gap-3">
            <BookText className="h-5 w-5 shrink-0 text-primary" />
            <p className="text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Cada recurso indica su origen.</strong>{" "}
              Verás un aviso con el modelo que lo generó y la fecha. Esa información
              queda guardada junto al recurso.
            </p>
          </div>
        </div>
      </section>

      <div className="mt-6">
        <CampoObservacion modulo="ayuda" />
      </div>
    </div>
  );
}
