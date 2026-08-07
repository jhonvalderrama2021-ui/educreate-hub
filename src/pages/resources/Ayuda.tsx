import { useState } from "react";
import {
  HelpCircle, ChevronDown, FileCheck, ClipboardList, Table2, FileEdit,
  Presentation, Bot, Puzzle, BookText, GraduationCap, History, Upload,
  Pencil, Download, ShieldCheck, Sparkles, Server,
} from "lucide-react";

interface Seccion {
  id: string;
  titulo: string;
  icono: any;
  pasos: string[];
  consejo?: string;
}

const PRIMEROS_PASOS: Seccion[] = [
  {
    id: "generar",
    titulo: "Generar tu primer recurso",
    icono: Sparkles,
    pasos: [
      "Elige en el menú lateral el tipo de recurso que necesitas: examen, taller, plan de clase, rúbrica o diapositivas.",
      "Selecciona el área y escribe el tema en el campo de instrucciones. Entre más específico seas, mejor sale el resultado.",
      "Si quieres que el recurso se base en un documento tuyo, súbelo en formato PDF.",
      "Pulsa Generar y espera. Según el recurso puede tardar entre 15 y 60 segundos.",
      "Revisa el resultado, ajústalo si hace falta y guárdalo o expórtalo.",
    ],
    consejo:
      "En vez de escribir «sistema circulatorio», escribe «el sistema circulatorio humano, enfocado en la diferencia entre circulación mayor y menor, para grado 8». El resultado cambia bastante.",
  },
  {
    id: "pdf",
    titulo: "Usar un documento propio como fuente",
    icono: Upload,
    pasos: [
      "En el formulario de generación, usa el botón para subir un archivo PDF.",
      "La plataforma extrae el texto y se lo entrega a la inteligencia artificial como material base.",
      "El contenido generado se apoyará en ese documento en lugar de en conocimiento general.",
    ],
    consejo:
      "Funciona con PDF de texto. Si el PDF es una foto o un escaneo sin texto seleccionable, no se puede extraer nada.",
  },
  {
    id: "editar",
    titulo: "Editar el contenido antes de usarlo",
    icono: Pencil,
    pasos: [
      "Con el recurso en pantalla, activa el modo de edición.",
      "Haz clic sobre cualquier texto para corregirlo directamente.",
      "Guarda cuando termines. Los cambios quedan en tu historial.",
    ],
    consejo:
      "La inteligencia artificial puede equivocarse en datos y conceptos. Revisa siempre antes de llevar el material al aula: la decisión pedagógica es tuya.",
  },
  {
    id: "exportar",
    titulo: "Exportar a PDF, Word o PowerPoint",
    icono: Download,
    pasos: [
      "Con el recurso generado o abierto desde el historial, pulsa Descargar.",
      "Elige el formato: PDF y Word para exámenes, talleres, planes y rúbricas; PowerPoint para diapositivas.",
      "Ajusta las opciones de exportación si quieres incluir o no las respuestas.",
    ],
  },
];

const MODULOS: Seccion[] = [
  {
    id: "examenes",
    titulo: "Exámenes",
    icono: FileCheck,
    pasos: [
      "Tipo ICFES: selección múltiple con única respuesta, siguiendo la estructura de las pruebas Saber 11.",
      "Falso y Verdadero: afirmaciones para evaluar conceptos puntuales.",
      "Mixto: combina ambos formatos en una sola prueba.",
      "Puedes definir cuántas preguntas quieres, entre 1 y 30.",
    ],
    consejo:
      "Cada pregunta incluye la explicación de la respuesta correcta y qué error comete quien elige cada opción incorrecta. Sirve para retroalimentar al estudiante.",
  },
  {
    id: "plan",
    titulo: "Plan de clase",
    icono: ClipboardList,
    pasos: [
      "Genera un plan por fases: inicio, desarrollo y cierre.",
      "Cada fase trae qué hace el docente, qué hacen los estudiantes y preguntas orientadoras concretas.",
      "Incluye metas de aprendizaje, saberes previos, materiales y criterios de evaluación.",
    ],
  },
  {
    id: "rubricas",
    titulo: "Rúbricas",
    icono: Table2,
    pasos: [
      "Elige el tipo: analítica, holística, lista de verificación, escalar o de puntos.",
      "Define cuántos niveles de desempeño quieres (3, 4, 5 o personalizado).",
      "La rúbrica sale con criterios, descriptores por nivel y pesos que suman 100.",
    ],
  },
  {
    id: "talleres",
    titulo: "Talleres",
    icono: FileEdit,
    pasos: [
      "Selecciona la metodología: aprendizaje basado en proyectos, aula invertida, gamificación y otras.",
      "Indica la duración disponible.",
      "El taller sale con actividades paso a paso, materiales con cantidades y un producto observable por actividad.",
    ],
  },
  {
    id: "diapositivas",
    titulo: "Diapositivas",
    icono: Presentation,
    pasos: [
      "Indica el tema y cuántas diapositivas necesitas.",
      "Elige la paleta de colores.",
      "Se exportan a PowerPoint o PDF para proyectarlas en clase.",
    ],
  },
  {
    id: "bots",
    titulo: "Bots educativos",
    icono: Bot,
    pasos: [
      "Crea un bot dándole un nombre y una especialidad, por ejemplo «Matemáticas grado 9».",
      "Conversa con él para resolver dudas de esa materia.",
      "El bot está diseñado para guiar al estudiante, no para resolverle la tarea.",
    ],
  },
  {
    id: "juegos",
    titulo: "Crucigramas y cuentos",
    icono: Puzzle,
    pasos: [
      "Crucigrama: indica el tema y cuántas palabras quieres en horizontal y vertical.",
      "Cuento: define el personaje, la temática, la edad de los lectores y la extensión.",
      "Los cuentos se generan con ilustraciones automáticas.",
    ],
  },
  {
    id: "cursos",
    titulo: "Mini cursos",
    icono: GraduationCap,
    pasos: [
      "Crea un curso y comparte con tus estudiantes el código de acceso que se genera.",
      "Agrega al curso los recursos que ya generaste y define su orden.",
      "Marca como evaluables los exámenes y crucigramas para que los resuelvan en línea.",
      "Consulta el reporte de cada estudiante con sus entregas y resultados.",
    ],
  },
  {
    id: "historial",
    titulo: "Historial",
    icono: History,
    pasos: [
      "Todos los recursos que guardes quedan aquí.",
      "Puedes volver a verlos, exportarlos de nuevo o eliminarlos.",
      "Marca un recurso como público si quieres compartirlo con otros docentes.",
    ],
  },
];

const PROBLEMAS = [
  {
    p: "La generación tarda mucho o parece congelada",
    r: "Los recursos más extensos, como un examen de 20 preguntas, pueden tardar cerca de un minuto. Mientras veas el indicador de carga, el proceso sigue en marcha. Si tu conexión es inestable, evita cerrar o recargar la página.",
  },
  {
    p: "Aparece «Servicio de IA no disponible»",
    r: "La clave del servicio de inteligencia artificial no está configurada o dejó de ser válida. Es algo que resuelve el administrador de la plataforma desde su panel.",
  },
  {
    p: "El contenido generado tiene errores",
    r: "Puede pasar: la inteligencia artificial se equivoca. Para eso está el modo de edición. Si el resultado no te sirve, ajusta las instrucciones con más detalle y vuelve a generar.",
  },
  {
    p: "No puedo subir mi PDF",
    r: "Revisa que sea un PDF con texto seleccionable y no un escaneo o una foto. Los documentos muy pesados también pueden fallar: intenta con uno más liviano o con solo el capítulo que necesitas.",
  },
  {
    p: "No veo algunos módulos en el menú",
    r: "El menú muestra opciones distintas según tu rol. Las cuentas de estudiante ven menos módulos que las de docente. Si crees que tu rol está mal asignado, contacta al administrador.",
  },
];

function Acordeon({ seccion }: { seccion: Seccion }) {
  const [abierto, setAbierto] = useState(false);
  const Icono = seccion.icono;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/40 transition-colors"
      >
        <Icono className="h-5 w-5 shrink-0 text-primary" />
        <span className="flex-1 font-medium text-foreground">{seccion.titulo}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${abierto ? "rotate-180" : ""}`}
        />
      </button>
      {abierto && (
        <div className="px-4 pb-4 space-y-3">
          <ol className="space-y-2 text-sm text-foreground">
            {seccion.pasos.map((paso, i) => (
              <li key={i} className="flex gap-3">
                <span className="shrink-0 h-5 w-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{paso}</span>
              </li>
            ))}
          </ol>
          {seccion.consejo && (
            <p className="text-xs text-muted-foreground bg-muted/40 rounded-md p-3 leading-relaxed">
              <strong className="text-foreground">Consejo: </strong>
              {seccion.consejo}
            </p>
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
        {PRIMEROS_PASOS.map((s) => <Acordeon key={s.id} seccion={s} />)}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Qué hace cada módulo</h2>
        {MODULOS.map((s) => <Acordeon key={s.id} seccion={s} />)}
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
            <Server className="h-5 w-5 shrink-0 text-primary" />
            <p className="text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Cuida los datos de tus estudiantes.</strong>{" "}
              No incluyas nombres, documentos de identidad ni información personal
              de menores en las instrucciones que envías a la inteligencia artificial.
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
    </div>
  );
}
