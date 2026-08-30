-- Los ayudantes de pertenencia al curso solo responden sobre uno mismo.
--
-- `recurso_visible_en_mi_curso` y `bot_esta_en_mi_curso` se crearon sin tocar
-- sus permisos, así que quedaron ejecutables por todo el mundo, `anon`
-- incluido. Comprobado llamándolas desde fuera CON los argumentos correctos:
-- respondían 200. Quien las llame obtiene un sí/no sobre si tal persona
-- pertenece al curso de tal recurso: poco con dos UUID que hay que conocer de
-- antemano, pero es información sobre quién está en qué curso.
--
-- El primer intento fue revocarle el permiso a `anon`, como ya lo tienen
-- has_role, is_enrolled e is_course_teacher. Rompió otra cosa: las políticas
-- se evalúan con el rol de quien consulta, así que un visitante sin sesión
-- que mirara los recursos públicos pasaba de recibir una lista vacía a
-- recibir "permission denied". Se descartó.
--
-- Lo que sí funciona: que la función se niegue a hablar de nadie que no sea
-- quien pregunta. Las políticas siempre le pasan `auth.uid()`, así que para
-- ellas no cambia nada; una llamada directa preguntando por otra persona
-- recibe `false` en vez de la respuesta. Y sin sesión, donde `auth.uid()` es
-- nulo, la política sigue devolviendo cero filas en lugar de un error.

create or replace function public.recurso_visible_en_mi_curso(_resource_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- Solo se responde sobre quien pregunta. Sin esto, la funcion contesta a
    -- cualquiera que traiga dos UUID validos.
    _user_id is not distinct from auth.uid()
    and exists (
      select 1
      from public.course_resources cr
      where cr.resource_id = _resource_id
        and cr.resource_type not in ('icfes', 'quiz', 'true_false', 'mixed', 'crossword')
        and (
          public.is_enrolled(cr.course_id, _user_id)
          or public.is_course_teacher(cr.course_id, _user_id)
        )
    );
$$;

create or replace function public.bot_esta_en_mi_curso(_bot_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    _user_id is not distinct from auth.uid()
    and exists (
      select 1
      from public.course_bots cb
      where cb.bot_id = _bot_id
        and (
          public.is_enrolled(cb.course_id, _user_id)
          or public.is_course_teacher(cb.course_id, _user_id)
        )
    );
$$;

-- Se restituyen los permisos que el intento anterior habia quitado.
grant execute on function public.recurso_visible_en_mi_curso(uuid, uuid)
  to anon, authenticated, service_role;
grant execute on function public.bot_esta_en_mi_curso(uuid, uuid)
  to anon, authenticated, service_role;
