-- El tipo de recurso solo puede ser uno de los que la plataforma conoce.
--
-- La columna era texto libre. Los tipos, en cambio, están escritos en el
-- código: la pantalla elige el icono y el formulario con `TIPO[valor]` sobre
-- una tabla de consulta. Un valor que no esté en esa tabla no da un icono
-- por defecto: da lo que Object.prototype tenga en esa clave.
--
-- Con `resource_type = 'constructor'` la búsqueda devuelve el constructor de
-- Object —una función, no un icono— y React intenta pintarlo como si fuera
-- un componente. La pantalla se cae en blanco.
--
-- Importa porque cualquiera puede escribir sus propias filas por la API: un
-- docente podría dejar así la página del curso DE SUS ESTUDIANTES, sin
-- proponérselo y sin que nadie entendiera por qué. Se ataja en la base, que
-- es donde vale para todas las pantallas a la vez y no solo para la que se
-- acuerde de comprobarlo.
--
-- Todas las filas existentes ya cumplen: se comprobó antes de añadirlo.
--
-- La lista se sacó de lo que la aplicación escribe de verdad, no de lo que
-- parecía razonable. Al primer intento faltaba 'tarea' —el tipo con el que se
-- guarda la entrega de un archivo, en EntregaDeTarea.tsx— y la restricción
-- dejó a los estudiantes sin poder entregar. Lo cazaron las auditorías de
-- plazos y de entregas, que hasta entonces pasaban.
--
-- Si mañana se agrega un tipo de recurso, hay que agregarlo también aquí.

do $$
declare
  t text;
begin
  foreach t in array array['generated_resources', 'course_resources', 'resource_submissions']
  loop
    execute format(
      'alter table public.%I drop constraint if exists %I',
      t, t || '_resource_type_valido'
    );
    execute format($f$
      alter table public.%I add constraint %I check (
        resource_type in (
          -- Los que genera la plataforma
          'icfes', 'quiz', 'true_false', 'mixed',
          'workshop', 'lesson_plan', 'rubric', 'guide',
          'slides', 'crossword', 'story',
          -- La entrega de un archivo por parte del estudiante
          'tarea'
        )
      )
    $f$, t, t || '_resource_type_valido');
  end loop;
end $$;

comment on constraint generated_resources_resource_type_valido on public.generated_resources is
  'Los tipos van escritos en el código de la aplicación; uno desconocido rompe la pantalla que lo pinta.';
