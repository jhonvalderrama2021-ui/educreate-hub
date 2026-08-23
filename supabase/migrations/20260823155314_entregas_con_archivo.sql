-- Tareas que el estudiante entrega subiendo un archivo.
--
-- Pedido del docente al revisar la plataforma: los recursos que no son
-- examenes -un taller, una guia- no tenian forma de entregarse. El estudiante
-- los abria y ahi terminaba todo, asi que el docente no podia comprobar que
-- los hubiera hecho.
--
-- Ahora el docente marca un recurso del curso como "se entrega con archivo" y
-- el estudiante sube su trabajo en PDF o Word.

-- ── El docente decide que recursos se entregan ─────────────────────────
ALTER TABLE public.course_resources
  ADD COLUMN IF NOT EXISTS requiere_entrega boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS instrucciones_entrega text,
  ADD COLUMN IF NOT EXISTS entrega_hasta timestamptz;

COMMENT ON COLUMN public.course_resources.requiere_entrega IS
  'El estudiante debe subir un archivo. Solo tiene sentido en recursos que no se califican solos.';
COMMENT ON COLUMN public.course_resources.entrega_hasta IS
  'Fecha limite. Se sigue admitiendo despues, marcada como tardia: rechazarla dejaria al docente sin el trabajo.';

-- ── El archivo entregado ───────────────────────────────────────────────
ALTER TABLE public.resource_submissions
  ADD COLUMN IF NOT EXISTS archivo_ruta text,
  ADD COLUMN IF NOT EXISTS archivo_nombre text,
  ADD COLUMN IF NOT EXISTS archivo_tamano integer,
  ADD COLUMN IF NOT EXISTS comentario_estudiante text,
  -- La nota la pone el docente a mano: un taller no se califica solo.
  ADD COLUMN IF NOT EXISTS calificado_en timestamptz,
  ADD COLUMN IF NOT EXISTS comentario_docente text;

CREATE INDEX IF NOT EXISTS idx_submissions_con_archivo
  ON public.resource_submissions (course_resource_id)
  WHERE archivo_ruta IS NOT NULL;

-- ── El estudiante puede corregir su entrega ────────────────────────────
-- Sin esto, subir el archivo equivocado seria definitivo. Solo puede tocar
-- lo suyo, y NO la nota ni el comentario del docente: para eso estan las
-- columnas de la politica del docente, mas abajo.
DROP POLICY IF EXISTS "Estudiantes corrigen su propia entrega" ON public.resource_submissions;
CREATE POLICY "Estudiantes corrigen su propia entrega"
  ON public.resource_submissions
  FOR UPDATE TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- ── El docente califica ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Docentes califican las entregas de sus cursos" ON public.resource_submissions;
CREATE POLICY "Docentes califican las entregas de sus cursos"
  ON public.resource_submissions
  FOR UPDATE TO authenticated
  USING (public.is_course_teacher(course_id, auth.uid()))
  WITH CHECK (public.is_course_teacher(course_id, auth.uid()));

-- Un estudiante NO puede ponerse la nota a si mismo. La politica de arriba le
-- deja actualizar su fila, asi que la restriccion tiene que estar en un
-- disparador: comprueba que quien no es el docente del curso no toque score,
-- max_score ni el comentario del docente.
CREATE OR REPLACE FUNCTION public.proteger_calificacion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_course_teacher(NEW.course_id, auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.score IS DISTINCT FROM OLD.score
     OR NEW.max_score IS DISTINCT FROM OLD.max_score
     OR NEW.comentario_docente IS DISTINCT FROM OLD.comentario_docente
     OR NEW.calificado_en IS DISTINCT FROM OLD.calificado_en
     OR NEW.feedback IS DISTINCT FROM OLD.feedback THEN
    RAISE EXCEPTION 'Solo el docente del curso puede calificar';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_calificacion ON public.resource_submissions;
CREATE TRIGGER trg_proteger_calificacion
  BEFORE UPDATE ON public.resource_submissions
  FOR EACH ROW EXECUTE FUNCTION public.proteger_calificacion();

-- ── Almacen de las entregas ────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'entregas-tareas', 'entregas-tareas', false,
  -- 20 MB: un taller escaneado en PDF cabe de sobra y evita que una subida
  -- descuidada llene el almacenamiento del proyecto.
  20971520,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg', 'image/png'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- La ruta es {course_id}/{course_resource_id}/{student_id}/{archivo}
DROP POLICY IF EXISTS "Estudiantes suben su entrega" ON storage.objects;
CREATE POLICY "Estudiantes suben su entrega"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'entregas-tareas'
    AND auth.uid()::text = (storage.foldername(name))[3]
    AND public.is_enrolled(((storage.foldername(name))[1])::uuid, auth.uid())
  );

DROP POLICY IF EXISTS "Estudiantes reemplazan su entrega" ON storage.objects;
CREATE POLICY "Estudiantes reemplazan su entrega"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'entregas-tareas' AND auth.uid()::text = (storage.foldername(name))[3]);

DROP POLICY IF EXISTS "Estudiantes ven su entrega" ON storage.objects;
CREATE POLICY "Estudiantes ven su entrega"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'entregas-tareas' AND auth.uid()::text = (storage.foldername(name))[3]);

-- El docente ve las entregas de SUS cursos, no las de todos.
DROP POLICY IF EXISTS "Docentes ven las entregas de sus cursos" ON storage.objects;
CREATE POLICY "Docentes ven las entregas de sus cursos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'entregas-tareas'
    AND public.is_course_teacher(((storage.foldername(name))[1])::uuid, auth.uid())
  );

DROP POLICY IF EXISTS "Estudiantes borran su entrega" ON storage.objects;
CREATE POLICY "Estudiantes borran su entrega"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'entregas-tareas' AND auth.uid()::text = (storage.foldername(name))[3]);
