import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/AppHeader";
import { Sparkles, Share2, Shield, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const features = [
  {
    icon: Sparkles,
    title: "Crea con facilidad",
    description: "Diseña recursos pedagógicos interactivos sin complicaciones.",
  },
  {
    icon: Share2,
    title: "Comparte al instante",
    description: "Distribuye tus materiales con estudiantes y colegas en un clic.",
  },
  {
    icon: Shield,
    title: "Seguro y confiable",
    description: "Tu contenido protegido con los más altos estándares de seguridad.",
  },
];

export default function Index() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <section className="gradient-hero">
        <div className="max-w-4xl mx-auto px-4 pt-20 pb-28 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground mb-6 animate-fade-in">
            <Sparkles className="h-4 w-4" />
            Plataforma educativa
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-foreground leading-tight mb-6 animate-fade-in" style={{ animationDelay: "0.1s" }}>
            Crea recursos educativos
            <span className="block text-primary">que inspiran</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in" style={{ animationDelay: "0.2s" }}>
            Diseña, organiza y comparte materiales pedagógicos de forma sencilla.
            La herramienta perfecta para docentes y estudiantes.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <Link to={user ? "/dashboard" : "/auth?mode=signup"}>
              <Button size="lg" className="gradient-primary text-base px-8">
                Comenzar gratis
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-20">
        <h2 className="text-2xl font-bold text-foreground text-center mb-12">
          Todo lo que necesitas
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="glass-card rounded-xl p-6 text-center animate-fade-in"
              style={{ animationDelay: `${0.1 * i}s` }}
            >
              <div className="mx-auto h-12 w-12 rounded-lg gradient-primary flex items-center justify-center mb-4">
                <f.icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} EduCrea. Todos los derechos reservados.
      </footer>
    </div>
  );
}
