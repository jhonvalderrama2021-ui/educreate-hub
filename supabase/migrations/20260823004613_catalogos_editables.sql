-- Catalogos editables desde el panel de administracion.
--
-- Pedido del asesor: "si hay una nueva metodologia que no este aqui, ¿donde
-- se agregaria? ... que este sistema no quede congelado en el tiempo".
--
-- Hasta ahora las 18 metodologias, las 32 asignaturas y los tipos de rubrica
-- estaban escritos en el codigo: agregar una exigia tocar el codigo y volver
-- a desplegar. Ahora viven en esta tabla y el administrador las mantiene.
--
-- Se siembra exactamente con los valores que ya estaban en el codigo, para
-- que el primer dia nadie note un cambio.

CREATE TABLE IF NOT EXISTS public.catalogos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('asignatura', 'metodologia')),
  valor text NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  -- Desactivar en vez de borrar: si una metodologia deja de usarse, los
  -- recursos que ya la citan siguen teniendo sentido.
  activo boolean NOT NULL DEFAULT true,
  creado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tipo, valor)
);

CREATE INDEX IF NOT EXISTS idx_catalogos_tipo_activo
  ON public.catalogos (tipo, orden, valor) WHERE activo = true;

ALTER TABLE public.catalogos ENABLE ROW LEVEL SECURITY;

-- Cualquier persona autenticada necesita leerlos: son las opciones de los
-- formularios de generacion.
DROP POLICY IF EXISTS "Todos leen los catalogos activos" ON public.catalogos;
CREATE POLICY "Todos leen los catalogos activos"
  ON public.catalogos FOR SELECT TO authenticated
  USING (activo = true);

-- El administrador ve tambien los desactivados, para poder reactivarlos.
DROP POLICY IF EXISTS "Admin ve todos los catalogos" ON public.catalogos;
CREATE POLICY "Admin ve todos los catalogos"
  ON public.catalogos FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admin agrega catalogos" ON public.catalogos;
CREATE POLICY "Admin agrega catalogos"
  ON public.catalogos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admin edita catalogos" ON public.catalogos;
CREATE POLICY "Admin edita catalogos"
  ON public.catalogos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admin borra catalogos" ON public.catalogos;
CREATE POLICY "Admin borra catalogos"
  ON public.catalogos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ── Siembra con lo que ya estaba en el codigo ──────────────────────────
INSERT INTO public.catalogos (tipo, valor, orden) VALUES
  ('asignatura', 'Matemáticas', 1),
  ('asignatura', 'Español y Literatura', 2),
  ('asignatura', 'Lengua Castellana', 3),
  ('asignatura', 'Inglés', 4),
  ('asignatura', 'Francés', 5),
  ('asignatura', 'Ciencias Naturales', 6),
  ('asignatura', 'Biología', 7),
  ('asignatura', 'Química', 8),
  ('asignatura', 'Física', 9),
  ('asignatura', 'Ciencias Sociales', 10),
  ('asignatura', 'Historia', 11),
  ('asignatura', 'Geografía', 12),
  ('asignatura', 'Filosofía', 13),
  ('asignatura', 'Economía', 14),
  ('asignatura', 'Política y Constitución', 15),
  ('asignatura', 'Cátedra de la Paz', 16),
  ('asignatura', 'Educación Ética y Valores Humanos', 17),
  ('asignatura', 'Educación Religiosa', 18),
  ('asignatura', 'Educación Artística', 19),
  ('asignatura', 'Música', 20),
  ('asignatura', 'Danza', 21),
  ('asignatura', 'Teatro', 22),
  ('asignatura', 'Artes Plásticas', 23),
  ('asignatura', 'Educación Física, Recreación y Deportes', 24),
  ('asignatura', 'Tecnología e Informática', 25),
  ('asignatura', 'Programación y Computación', 26),
  ('asignatura', 'Robótica', 27),
  ('asignatura', 'Emprendimiento', 28),
  ('asignatura', 'Educación Ambiental', 29),
  ('asignatura', 'Lectura Crítica', 30),
  ('asignatura', 'Competencias Ciudadanas', 31),
  ('asignatura', 'Orientación Vocacional', 32),

  ('metodologia', 'Aprendizaje Basado en Proyectos (ABP)', 1),
  ('metodologia', 'Aprendizaje Basado en Problemas', 2),
  ('metodologia', 'Aula Invertida (Flipped Classroom)', 3),
  ('metodologia', 'Aprendizaje Cooperativo', 4),
  ('metodologia', 'Gamificación', 5),
  ('metodologia', 'Design Thinking aplicado a la educación', 6),
  ('metodologia', 'Método Socrático', 7),
  ('metodologia', 'Aprendizaje Experiencial (Kolb)', 8),
  ('metodologia', 'Aprendizaje Basado en Competencias', 9),
  ('metodologia', 'Método Montessori (adaptado)', 10),
  ('metodologia', 'Aprendizaje Servicio', 11),
  ('metodologia', 'Enseñanza Explícita', 12),
  ('metodologia', 'Pensamiento Visible (Visible Thinking)', 13),
  ('metodologia', 'Aprendizaje Multimodal', 14),
  ('metodologia', 'STEM / STEAM', 15),
  ('metodologia', 'Aprendizaje Personalizado', 16),
  ('metodologia', 'Aprendizaje colaborativo', 17),
  ('metodologia', 'Clase magistral', 18)
ON CONFLICT (tipo, valor) DO NOTHING;

DROP TRIGGER IF EXISTS trg_catalogos_updated_at ON public.catalogos;
CREATE TRIGGER trg_catalogos_updated_at
  BEFORE UPDATE ON public.catalogos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
