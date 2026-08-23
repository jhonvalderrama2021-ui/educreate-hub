-- Cursos por grupo, no solo por grado.
--
-- Observacion del asesor: "en los colegios hay sexto A, sexto B, sexto C...
-- serian 200 estudiantes en este listado".
--
-- Un curso ya podia llamarse "Matematicas 8A", pero el nombre es texto libre:
-- no se puede agrupar, ni filtrar, ni saber que 8A y 8B son la misma materia.
-- Con grado y grupo como columnas, la lista se organiza sola.

ALTER TABLE public.mini_courses
  ADD COLUMN IF NOT EXISTS grado text,
  ADD COLUMN IF NOT EXISTS grupo text;

COMMENT ON COLUMN public.mini_courses.grado IS 'Grado escolar (1 a 11). Texto porque algunas instituciones usan etiquetas propias.';
COMMENT ON COLUMN public.mini_courses.grupo IS 'Grupo dentro del grado: A, B, C, 01, "Manana"...';

CREATE INDEX IF NOT EXISTS idx_mini_courses_docente_grado
  ON public.mini_courses (teacher_id, grado, grupo);

-- ── Duplicar un curso para otro grupo ──────────────────────────────────
-- Sin esto, el docente que dicta la misma materia en 6A, 6B y 6C tiene que
-- crear tres cursos y volver a agregar los mismos recursos uno por uno. Se
-- copian los recursos con su configuracion, pero NO las inscripciones: los
-- estudiantes de 6A no son los de 6B.
CREATE OR REPLACE FUNCTION public.duplicar_curso_para_grupo(
  p_curso_id uuid,
  p_grupo text,
  p_clave text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nuevo_id uuid;
  v_origen public.mini_courses%ROWTYPE;
BEGIN
  SELECT * INTO v_origen FROM public.mini_courses WHERE id = p_curso_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El curso no existe';
  END IF;

  IF v_origen.teacher_id <> auth.uid() THEN
    RAISE EXCEPTION 'Solo el docente del curso puede duplicarlo';
  END IF;

  IF btrim(COALESCE(p_grupo, '')) = '' THEN
    RAISE EXCEPTION 'Indica el grupo del curso nuevo';
  END IF;

  IF btrim(COALESCE(p_clave, '')) = '' THEN
    RAISE EXCEPTION 'El curso nuevo necesita su propia clave de acceso';
  END IF;

  INSERT INTO public.mini_courses (teacher_id, name, description, access_code, grado, grupo, is_active)
  VALUES (
    v_origen.teacher_id,
    v_origen.name,
    v_origen.description,
    upper(btrim(p_clave)),
    v_origen.grado,
    btrim(p_grupo),
    true
  )
  RETURNING id INTO v_nuevo_id;

  INSERT INTO public.course_resources (
    course_id, resource_id, resource_type, title, position,
    show_grade, show_feedback, max_attempts, time_limit_minutes,
    shuffle_questions
  )
  SELECT
    v_nuevo_id, cr.resource_id, cr.resource_type, cr.title, cr.position,
    cr.show_grade, cr.show_feedback, cr.max_attempts, cr.time_limit_minutes,
    cr.shuffle_questions
  FROM public.course_resources cr
  WHERE cr.course_id = p_curso_id;

  -- Las fechas de apertura y cierre no se copian a proposito: casi nunca
  -- coinciden entre grupos y una fecha heredada en silencio cerraria el
  -- curso nuevo antes de que el docente lo note.

  RETURN v_nuevo_id;
END;
$$;

REVOKE ALL ON FUNCTION public.duplicar_curso_para_grupo(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duplicar_curso_para_grupo(uuid, text, text) TO authenticated;
