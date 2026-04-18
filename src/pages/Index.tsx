import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/AppHeader";
import {
  Sparkles,
  ArrowRight,
  FileText,
  ClipboardList,
  Presentation,
  Bot,
  Upload,
  Clock,
  MousePointerClick,
  Layers,
  Brain,
  Accessibility,
  GraduationCap,
  Users,
  Heart,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const tools = [
  {
    icon: ClipboardList,
    title: "Planes de clase",
    description: "Estructurados y listos para aplicar en el aula.",
  },
  {
    icon: FileText,
    title: "Exámenes tipo ICFES",
    description: "Y preguntas de falso/verdadero, alineadas con los estándares colombianos.",
  },
  {
    icon: Presentation,
    title: "Presentaciones dinámicas",
    description: "Diapositivas atractivas para apoyar tus clases.",
  },
  {
    icon: Bot,
    title: "ChatBot educativo",
    description: "Resuelve dudas y orienta tu proceso de enseñanza.",
  },
  {
    icon: Upload,
    title: "Desde PDF o Word",
    description: "Genera recursos a partir de tus archivos o solo el nombre del tema.",
  },
  {
    icon: Sparkles,
    title: "IA pedagógica",
    description: "Tecnología aplicada al contexto educativo colombiano.",
  },
];

const benefits = [
  {
    icon: Clock,
    title: "Ahorro de tiempo",
    description: "Genera recursos completos en segundos, sin partir desde cero.",
  },
  {
    icon: MousePointerClick,
    title: "Facilidad de uso",
    description: "Solo necesitas el nombre del tema o subir un archivo.",
  },
  {
    icon: Layers,
    title: "Versatilidad",
    description: "Múltiples tipos de recursos disponibles en un solo lugar.",
  },
  {
    icon: Brain,
    title: "IA especializada",
    description: "Pensada para el contexto pedagógico colombiano.",
  },
  {
    icon: Accessibility,
    title: "Accesibilidad",
    description: "Plataforma intuitiva, sin conocimientos técnicos avanzados.",
  },
  {
    icon: GraduationCap,
    title: "Para docentes y estudiantes",
    description: "Apoya la planificación académica y refuerza el aprendizaje.",
  },
];

const team = [
  { name: "Jhon Eduar Valderrama", role: "Cofundador & Desarrollador" },
  { name: "José Manuel Sánchez", role: "Cofundador & Desarrollador" },
];

export default function Index() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      {/* Hero */}
      <section className="gradient-hero">
        <div className="max-w-4xl mx-auto px-4 pt-20 pb-28 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground mb-6 animate-fade-in">
            <Sparkles className="h-4 w-4" />
            Plataforma educativa inteligente
          </div>
          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-foreground leading-tight mb-6 animate-fade-in"
            style={{ animationDelay: "0.1s" }}
          >
            Crea recursos educativos
            <span className="block text-primary">que inspiran</span>
          </h1>
          <p
            className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in"
            style={{ animationDelay: "0.2s" }}
          >
            NexProfe transforma la manera en que los docentes diseñan, organizan y comparten materiales pedagógicos
            usando el poder de la inteligencia artificial.
          </p>
          <div
            className="flex flex-col sm:flex-row gap-3 justify-center animate-fade-in"
            style={{ animationDelay: "0.3s" }}
          >
            <Link to={user ? "/dashboard" : "/auth?mode=signup"}>
              <Button size="lg" className="gradient-primary text-base px-8">
                Comenzar
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
            <a href="#about">
              <Button size="lg" variant="outline" className="text-base px-8">
                Conoce más
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="max-w-5xl mx-auto px-4 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="animate-fade-in">
            <div className="inline-flex items-center gap-2 text-sm font-medium text-primary mb-3">
              <Sparkles className="h-4 w-4" /> ¿Qué es NexProfe?
            </div>
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Inteligencia artificial al servicio de la educación
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              NexProfe es una plataforma educativa inteligente diseñada para transformar la manera en que los docentes
              crean y gestionan sus recursos pedagógicos. A través del poder de la IA, permite generar materiales de
              alta calidad en cuestión de minutos, optimizando el tiempo y el esfuerzo de los educadores.
            </p>
          </div>
          <div className="glass-card rounded-2xl p-8 animate-fade-in" style={{ animationDelay: "0.15s" }}>
            <div className="flex items-start gap-4 mb-5">
              <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center shrink-0">
                <Users className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">¿A quién está dirigido?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Pensado principalmente para docentes de educación primaria y secundaria que buscan agilizar la
                  planificación académica. También es un recurso valioso para estudiantes que deseen reforzar su
                  aprendizaje.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center shrink-0">
                <Heart className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Hecho con pasión</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Comprometidos con crear soluciones tecnológicas que impacten positivamente el sector educativo
                  colombiano.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tools */}
      <section className="bg-muted/30 border-y border-border">
        <div className="max-w-6xl mx-auto px-4 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-3">¿Qué puedes hacer en NexProfe?</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Un conjunto de herramientas especializadas para la creación de recursos educativos completos.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tools.map((t, i) => (
              <div
                key={t.title}
                className="glass-card rounded-xl p-6 animate-fade-in"
                style={{ animationDelay: `${0.05 * i}s` }}
              >
                <div className="h-12 w-12 rounded-lg gradient-primary flex items-center justify-center mb-4">
                  <t.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{t.title}</h3>
                <p className="text-sm text-muted-foreground">{t.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-3">Beneficios</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Diseñado para que enseñar y aprender sea más simple, rápido y efectivo.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map((b, i) => (
            <div
              key={b.title}
              className="rounded-xl p-6 border border-border bg-card animate-fade-in"
              style={{ animationDelay: `${0.05 * i}s` }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
                  <b.icon className="h-5 w-5 text-accent-foreground" />
                </div>
                <h3 className="font-semibold text-foreground">{b.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground">{b.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Team */}
      <section className="bg-muted/30 border-t border-border">
        <div className="max-w-5xl mx-auto px-4 py-20">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 text-sm font-medium text-primary mb-3">
              <Users className="h-4 w-4" /> Nuestro equipo
            </div>
            <h2 className="text-3xl font-bold text-foreground mb-3">Pasión por la educación y la tecnología</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              NexProfe fue desarrollado por estudiantes de la Institución Universitaria del Putumayo (UniPutumayo),
              comprometidos con el sector educativo colombiano.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {team.map((member, i) => (
              <div
                key={member.name}
                className="glass-card rounded-xl p-6 text-center animate-fade-in"
                style={{ animationDelay: `${0.1 * i}s` }}
              >
                <div className="mx-auto h-16 w-16 rounded-full gradient-primary flex items-center justify-center mb-4 text-2xl font-bold text-primary-foreground">
                  {member.name
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")}
                </div>
                <h3 className="font-semibold text-foreground">{member.name}</h3>
                <p className="text-sm text-muted-foreground">{member.role}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground mt-8">
            Institución Universitaria del Putumayo · UniPutumayo
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="gradient-hero">
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Empieza a crear con NexProfe hoy
          </h2>
          <p className="text-muted-foreground mb-8">
            Únete a los docentes que ya están ahorrando horas de trabajo gracias a la inteligencia artificial.
          </p>
          <Link to={user ? "/dashboard" : "/auth?mode=signup"}>
            <Button size="lg" className="gradient-primary text-base px-8">
              Comenzar gratis
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} NexProfe. Todos los derechos reservados.
      </footer>
    </div>
  );
}
