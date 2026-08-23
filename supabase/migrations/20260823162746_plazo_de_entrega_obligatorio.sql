-- El plazo de entrega deja de ser un aviso y pasa a bloquear.
--
-- En la version anterior se admitia la entrega tardia y solo se marcaba como
-- tal. El docente pidio lo contrario: si el plazo termino, ya no se entrega
-- ni se edita. Es su criterio de evaluacion y es el que manda.
--
-- Se comprueba en la base y no solo en la pantalla: una comprobacion que vive
-- en el navegador se salta abriendo la consola, y aqui hay una nota de por
-- medio.

CREATE OR REPLACE FUNCTION public.validar_plazo_de_entrega()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cr public.course_resources%ROWTYPE;
  v_ahora timestamptz := now();
BEGIN
  -- El docente del curso siempre puede tocar: es quien califica, y a veces
  -- necesita registrar la entrega de alguien que la llevo en papel.
  IF public.is_course_teacher(NEW.course_id, auth.uid()) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_cr FROM public.course_resources WHERE id = NEW.course_resource_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Antes de la apertura tampoco: adelantarse es tan invalido como llegar tarde.
  IF v_cr.opens_at IS NOT NULL AND v_cr.opens_at > v_ahora THEN
    RAISE EXCEPTION 'Esta actividad todavía no está abierta (abre el %)',
      to_char(v_cr.opens_at AT TIME ZONE 'America/Bogota', 'DD/MM/YYYY HH24:MI');
  END IF;

  -- `entrega_hasta` manda para las tareas con archivo; `closes_at` es el
  -- cierre general del recurso. Vale el primero que haya puesto el docente.
  IF v_cr.entrega_hasta IS NOT NULL AND v_cr.entrega_hasta < v_ahora THEN
    RAISE EXCEPTION 'El plazo de entrega terminó el %',
      to_char(v_cr.entrega_hasta AT TIME ZONE 'America/Bogota', 'DD/MM/YYYY HH24:MI');
  END IF;

  IF v_cr.closes_at IS NOT NULL AND v_cr.closes_at < v_ahora THEN
    RAISE EXCEPTION 'Esta actividad cerró el %',
      to_char(v_cr.closes_at AT TIME ZONE 'America/Bogota', 'DD/MM/YYYY HH24:MI');
  END IF;

  RETURN NEW;
END;
$$;

-- Vale igual para entregar por primera vez que para reemplazar el archivo:
-- editar despues del plazo es entregar despues del plazo.
DROP TRIGGER IF EXISTS trg_validar_plazo_entrega ON public.resource_submissions;
CREATE TRIGGER trg_validar_plazo_entrega
  BEFORE INSERT OR UPDATE ON public.resource_submissions
  FOR EACH ROW EXECUTE FUNCTION public.validar_plazo_de_entrega();

-- ── Que el estudiante sepa si puede entregar ANTES de intentarlo ───────
-- Sin esto, la pantalla tendria que deducirlo comparando fechas por su
-- cuenta, que es justo donde se cuelan los errores de zona horaria.
CREATE OR REPLACE FUNCTION public.estado_de_entrega(p_course_resource_id uuid)
RETURNS TABLE (
  abierto boolean,
  motivo text,
  abre_en timestamptz,
  cierra_en timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_cr public.course_resources%ROWTYPE;
  v_ahora timestamptz := now();
  v_cierre timestamptz;
BEGIN
  SELECT * INTO v_cr FROM public.course_resources WHERE id = p_course_resource_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'La actividad no existe'::text, NULL::timestamptz, NULL::timestamptz;
    RETURN;
  END IF;

  IF NOT (public.is_enrolled(v_cr.course_id, auth.uid())
          OR public.is_course_teacher(v_cr.course_id, auth.uid())) THEN
    RETURN QUERY SELECT false, 'No estás inscrito en este curso'::text, NULL::timestamptz, NULL::timestamptz;
    RETURN;
  END IF;

  v_cierre := LEAST(
    COALESCE(v_cr.entrega_hasta, 'infinity'::timestamptz),
    COALESCE(v_cr.closes_at, 'infinity'::timestamptz)
  );
  IF v_cierre = 'infinity'::timestamptz THEN v_cierre := NULL; END IF;

  IF v_cr.opens_at IS NOT NULL AND v_cr.opens_at > v_ahora THEN
    RETURN QUERY SELECT false, 'Todavía no está abierta'::text, v_cr.opens_at, v_cierre;
  ELSIF v_cierre IS NOT NULL AND v_cierre < v_ahora THEN
    RETURN QUERY SELECT false, 'El plazo terminó'::text, v_cr.opens_at, v_cierre;
  ELSE
    RETURN QUERY SELECT true, NULL::text, v_cr.opens_at, v_cierre;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.estado_de_entrega(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.estado_de_entrega(uuid) TO authenticated;

-- ── Conexiones de un estudiante, para el docente ───────────────────────
-- El docente pidio ver cuando entro cada estudiante y cuanto tiempo estuvo,
-- sin tener que abrir uno por uno.
--
-- OJO con lo que mide: es tiempo en la PLATAFORMA, no dentro de este curso.
-- El latido no sabe en que pantalla esta la persona. Se dice asi en la
-- interfaz para que el dato no se use para mas de lo que aguanta.
CREATE OR REPLACE FUNCTION public.conexiones_del_curso(
  p_course_id uuid,
  p_dias integer DEFAULT 30
)
RETURNS TABLE (
  student_id uuid,
  nombre text,
  email text,
  inicio timestamptz,
  fin timestamptz,
  segundos integer
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    a.user_id,
    p.full_name,
    p.email,
    a.inicio,
    a.ultima_actividad,
    GREATEST(0, EXTRACT(EPOCH FROM (a.ultima_actividad - a.inicio))::integer)
  FROM public.accesos a
  JOIN public.course_enrollments ce ON ce.student_id = a.user_id
  LEFT JOIN public.profiles p ON p.id = a.user_id
  WHERE ce.course_id = p_course_id
    AND public.is_course_teacher(p_course_id, auth.uid())
    AND a.inicio > now() - (GREATEST(p_dias, 1) || ' days')::interval
  ORDER BY a.inicio DESC;
$$;

REVOKE ALL ON FUNCTION public.conexiones_del_curso(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conexiones_del_curso(uuid, integer) TO authenticated;
