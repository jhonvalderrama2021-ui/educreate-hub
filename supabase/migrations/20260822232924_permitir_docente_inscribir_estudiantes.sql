-- Corrige que un docente no pudiera inscribir estudiantes en sus cursos.
--
-- La politica de course_enrollments si permitia al docente insertar, pero la
-- tabla profiles solo dejaba ver el perfil propio o, si era administrador,
-- todos. Al buscar al estudiante por correo el docente recibia cero filas y la
-- aplicacion respondia "no existe el usuario con ese e-mail". Por la misma
-- razon, el listado de inscritos aparecia sin nombre ni correo.
--
-- No se abre profiles a todos los docentes: se resuelve con dos mecanismos
-- acotados.

-- 1) Resolver un correo a un identificador, sin exponer el resto del perfil.
--    Se limita a docentes y administradores para no permitir que cualquier
--    usuario averigue que correos estan registrados en la plataforma.
CREATE OR REPLACE FUNCTION public.buscar_usuario_por_correo(_correo text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT (public.has_role(auth.uid(), 'docente'::app_role)
       OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RETURN NULL;
  END IF;

  SELECT id INTO _id
  FROM public.profiles
  WHERE lower(email) = lower(trim(_correo))
  LIMIT 1;

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.buscar_usuario_por_correo(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buscar_usuario_por_correo(text) TO authenticated;

-- 2) Permitir que el docente vea el perfil de los estudiantes ya inscritos en
--    sus propios cursos, para poder mostrarlos en el listado y en los reportes.
CREATE OR REPLACE FUNCTION public.es_estudiante_de_mis_cursos(_estudiante uuid, _docente uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.course_enrollments ce
    JOIN public.mini_courses mc ON mc.id = ce.course_id
    WHERE ce.student_id = _estudiante
      AND mc.teacher_id = _docente
  );
$$;

REVOKE ALL ON FUNCTION public.es_estudiante_de_mis_cursos(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.es_estudiante_de_mis_cursos(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Docentes ven perfiles de sus estudiantes inscritos" ON public.profiles;
CREATE POLICY "Docentes ven perfiles de sus estudiantes inscritos"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.es_estudiante_de_mis_cursos(id, auth.uid()));
