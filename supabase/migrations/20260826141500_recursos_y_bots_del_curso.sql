-- Lo que un estudiante inscrito puede ver de su curso, y bots por curso.
--
-- Dos problemas distintos que comparten la misma raiz: el estudiante ve el
-- recurso listado en su curso pero no puede leerlo.
--
-- 1. En el curso, abrir unas diapositivas o un taller dejaba la pantalla en
--    "Cargando..." para siempre. Los examenes si abrian. La causa: la lista
--    sale de course_resources, que el estudiante SI puede leer, pero el
--    contenido vive en generated_resources, cuyo permiso es "es tuyo o es
--    publico". Un estudiante inscrito no es ninguna de las dos cosas, asi
--    que la consulta devolvia cero filas y la pantalla se quedaba esperando
--    algo que nunca iba a llegar. Los examenes se salvaban porque pasan por
--    una funcion de servidor que lee con permisos propios.
--
-- 2. El docente no podia poner un bot en su curso.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. EL CONTENIDO DEL RECURSO, PARA QUIEN ESTA INSCRITO
-- ─────────────────────────────────────────────────────────────────────────

/*
 * Se excluyen a proposito los tipos evaluables.
 *
 * El contenido de un examen guarda, en cada pregunta, el campo `correct` con
 * la respuesta buena, mas `explanation` y `distractorRationale`. El de un
 * crucigrama guarda `placed` y `grid`, que es la solucion armada. Dar lectura
 * directa sobre esas filas seria entregarle al estudiante la hoja de
 * respuestas: le bastaria abrir la consola del navegador para leerla antes de
 * presentar.
 *
 * Por eso siguen pasando por la funcion de servidor course-exam, que las
 * recorta antes de enviarlas. Aqui solo se abre lo que no tiene nada que
 * esconder: diapositivas, talleres, guias, planes y rubricas.
 */
create or replace function public.recurso_visible_en_mi_curso(_resource_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
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

comment on function public.recurso_visible_en_mi_curso is
  'Si el recurso esta puesto en un curso al que la persona pertenece y no es de los que guardan respuestas.';

drop policy if exists "Enrolled students view course resource content" on public.generated_resources;
create policy "Enrolled students view course resource content"
  on public.generated_resources
  for select
  using (public.recurso_visible_en_mi_curso(id, auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────
-- 2. BOTS DEL CURSO
-- ─────────────────────────────────────────────────────────────────────────

/*
 * Tabla aparte y no una fila en course_resources: alli resource_id apunta por
 * llave foranea a generated_resources, y un bot vive en su propia tabla.
 * Forzarlo habria exigido romper esa garantia.
 */
create table if not exists public.course_bots (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.mini_courses(id) on delete cascade,
  bot_id uuid not null references public.bots(id) on delete cascade,
  -- El docente puede presentarlo distinto dentro del curso: el mismo bot de
  -- biologia puede llamarse "Preguntas de la unidad 3" en un curso.
  titulo text,
  descripcion text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, bot_id)
);

create index if not exists course_bots_course_idx on public.course_bots (course_id, position);

alter table public.course_bots enable row level security;

drop policy if exists "Ver los bots del curso" on public.course_bots;
create policy "Ver los bots del curso"
  on public.course_bots
  for select
  using (
    public.is_course_teacher(course_id, auth.uid())
    or public.is_enrolled(course_id, auth.uid())
  );

/*
 * El docente solo puede poner bots SUYOS. Sin la segunda condicion podria
 * adivinar el id de un bot ajeno, ponerlo en su curso y quedar habilitado
 * para leerlo por la puerta que abre la politica de mas abajo.
 */
drop policy if exists "El docente pone bots suyos en su curso" on public.course_bots;
create policy "El docente pone bots suyos en su curso"
  on public.course_bots
  for insert
  with check (
    public.is_course_teacher(course_id, auth.uid())
    and exists (select 1 from public.bots b where b.id = bot_id and b.user_id = auth.uid())
  );

drop policy if exists "El docente edita los bots de su curso" on public.course_bots;
create policy "El docente edita los bots de su curso"
  on public.course_bots
  for update
  using (public.is_course_teacher(course_id, auth.uid()))
  with check (public.is_course_teacher(course_id, auth.uid()));

drop policy if exists "El docente quita bots de su curso" on public.course_bots;
create policy "El docente quita bots de su curso"
  on public.course_bots
  for delete
  using (public.is_course_teacher(course_id, auth.uid()));

create or replace function public.tocar_course_bots()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_course_bots_updated on public.course_bots;
create trigger trg_course_bots_updated
  before update on public.course_bots
  for each row execute function public.tocar_course_bots();

-- ─────────────────────────────────────────────────────────────────────────
-- 3. USAR EL BOT DEL CURSO SIN SER SU DUENO
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.bot_esta_en_mi_curso(_bot_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.course_bots cb
    where cb.bot_id = _bot_id
      and (
        public.is_enrolled(cb.course_id, _user_id)
        or public.is_course_teacher(cb.course_id, _user_id)
      )
  );
$$;

comment on function public.bot_esta_en_mi_curso is
  'Si el bot fue puesto por el docente en un curso al que la persona pertenece.';

-- Leer el bot: su nombre y su especialidad, para poder conversar con el.
drop policy if exists "Ver los bots puestos en mi curso" on public.bots;
create policy "Ver los bots puestos en mi curso"
  on public.bots
  for select
  using (public.bot_esta_en_mi_curso(id, auth.uid()));

/*
 * Los documentos que el docente le cargo al bot.
 *
 * Sin esto el estudiante podria conversar con el bot pero este responderia
 * sin su material, porque la busqueda no encontraria ningun documento y el
 * bot caeria en conocimiento general. Se veria "funcionando" mientras da
 * respuestas peores, que es el peor modo de fallar: sin avisar.
 *
 * Es lectura, no escritura: el estudiante no puede cargarle documentos.
 */
drop policy if exists "Ver los documentos del bot de mi curso" on public.bot_documentos;
create policy "Ver los documentos del bot de mi curso"
  on public.bot_documentos
  for select
  using (public.bot_esta_en_mi_curso(bot_id, auth.uid()));

drop policy if exists "Ver los fragmentos del bot de mi curso" on public.bot_fragmentos;
create policy "Ver los fragmentos del bot de mi curso"
  on public.bot_fragmentos
  for select
  using (public.bot_esta_en_mi_curso(bot_id, auth.uid()));
