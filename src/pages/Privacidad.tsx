import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * Política de Tratamiento de Datos Personales.
 *
 * Da cumplimiento a la Ley 1581 de 2012, al Decreto 1377 de 2013 y a la
 * Ley 1266 de 2008 (hábeas data), citados en el marco legal del proyecto.
 * Debe ser accesible ANTES del registro, ya que allí se solicita la
 * autorización de tratamiento.
 */
export default function Privacidad() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center shrink-0">
            <ShieldCheck className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Política de Tratamiento de Datos Personales
            </h1>
            <p className="text-sm text-muted-foreground">
              NexProfe · Conforme a la Ley 1581 de 2012 y el Decreto 1377 de 2013
            </p>
          </div>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">1. Responsable del tratamiento</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            NexProfe es una plataforma desarrollada en el marco de un trabajo de grado del
            programa de Ingeniería de Sistemas del Instituto Tecnológico del Putumayo
            (UniPutumayo), en Mocoa, Putumayo. Los responsables del tratamiento son los
            autores del proyecto, quienes atienden las solicitudes relacionadas con datos
            personales a través del correo institucional registrado en la plataforma.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">2. Datos que se recolectan</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {[
              ["Datos de identificación", "nombre completo, nombre de usuario y correo electrónico."],
              ["Datos de la cuenta", "rol asignado (docente, estudiante o administrador) y fecha de registro."],
              ["Contenido generado", "los recursos educativos que produces y los documentos PDF que cargues como fuente."],
              ["Datos de actividad académica", "en los mini cursos: inscripciones, entregas y calificaciones."],
              ["Conversaciones con los asistentes", "los mensajes que intercambias con los bots educativos."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-2">
                <span className="text-primary shrink-0">•</span>
                <span><strong className="text-foreground">{t}:</strong> {d}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground leading-relaxed">
            La plataforma <strong className="text-foreground">no solicita</strong> documentos de
            identidad, datos financieros, datos biométricos ni datos sensibles en los términos
            del artículo 5 de la Ley 1581 de 2012.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">3. Finalidad</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Los datos se tratan únicamente para permitir el funcionamiento de la plataforma:
            autenticar tu cuenta, guardar y mostrar los recursos que generas, administrar los
            mini cursos y el seguimiento académico, y elaborar estadísticas agregadas de uso
            en el marco de la investigación. No se utilizan con fines comerciales, publicitarios
            ni de perfilamiento, y no se venden ni ceden a terceros.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">4. Servicios de terceros</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            La generación de recursos se apoya en modelos de inteligencia artificial operados
            por <strong className="text-foreground">OpenAI</strong>. Cuando generas un recurso,
            el texto de tus instrucciones y el contenido del PDF que cargues se envían a ese
            servicio para producir el resultado. El almacenamiento de la base de datos y de los
            archivos se realiza en la infraestructura de <strong className="text-foreground">Supabase</strong>.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Por esta razón, <strong className="text-foreground">no incluyas datos personales de
            estudiantes</strong> —nombres, documentos de identidad o cualquier información que
            permita identificarlos— en las instrucciones ni en los documentos que cargues.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">5. Tus derechos como titular</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            De acuerdo con el artículo 8 de la Ley 1581 de 2012, tienes derecho a:
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {[
              ["Conocer", "saber qué datos tuyos se están tratando y con qué finalidad."],
              ["Actualizar y rectificar", "corregir tus datos cuando estén incompletos o sean inexactos."],
              ["Suprimir", "solicitar que tus datos sean eliminados de la plataforma."],
              ["Revocar la autorización", "retirar el consentimiento que otorgaste al registrarte."],
              ["Presentar quejas", "acudir a la Superintendencia de Industria y Comercio."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-2">
                <span className="text-primary shrink-0">•</span>
                <span><strong className="text-foreground">{t}:</strong> {d}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">6. Cómo ejercer tus derechos</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Puedes ejercerlos desde la propia plataforma, en la sección{" "}
            <strong className="text-foreground">Mis datos</strong> del menú de usuario, donde
            encontrarás qué información está registrada a tu nombre y podrás solicitar su
            corrección o eliminación.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Las solicitudes de consulta se atienden en un máximo de diez (10) días hábiles y
            los reclamos en quince (15) días hábiles, conforme a los artículos 14 y 15 de la
            Ley 1581 de 2012.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">7. Conservación y seguridad</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Los datos se conservan mientras la cuenta permanezca activa. La plataforma aplica
            políticas de seguridad a nivel de registro que impiden que un usuario acceda a la
            información de otro, y las credenciales de los servicios externos se mantienen
            exclusivamente del lado del servidor.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">8. Menores de edad</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Cuando un docente inscribe estudiantes menores de edad en un mini curso, el
            tratamiento de sus datos debe contar con la autorización de sus padres o
            representantes legales, y responde a una finalidad estrictamente académica,
            conforme al artículo 7 de la Ley 1581 de 2012 y a la Sentencia C-748 de 2011 de
            la Corte Constitucional.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">9. Vigencia</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Esta política rige a partir de su publicación. Cualquier modificación se informará
            dentro de la plataforma antes de su entrada en vigor.
          </p>
        </section>
      </main>
    </div>
  );
}
