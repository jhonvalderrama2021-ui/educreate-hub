-- Registro de observaciones de los docentes durante la prueba piloto.
--
-- Es el instrumento con el que se recoge la retroalimentacion del cuarto
-- objetivo especifico. Cada docente puede dejar anotaciones desde el modulo
-- en el que esta trabajando, sin interrumpir su tarea, y el equipo las
-- consulta despues desde el panel de administracion.

CREATE TABLE IF NOT EXISTS public.observaciones_piloto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  modulo text NOT NULL,
  recurso_id uuid REFERENCES public.generated_resources(id) ON DELETE SET NULL,
  observacion text NOT NULL,
  atendida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_observaciones_usuario ON public.observaciones_piloto(user_id);
CREATE INDEX IF NOT EXISTS idx_observaciones_modulo ON public.observaciones_piloto(modulo);
CREATE INDEX IF NOT EXISTS idx_observaciones_fecha ON public.observaciones_piloto(created_at DESC);

ALTER TABLE public.observaciones_piloto ENABLE ROW LEVEL SECURITY;

-- El docente gestiona unicamente sus propias observaciones.
CREATE POLICY "Usuarios crean sus observaciones"
  ON public.observaciones_piloto
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios ven sus observaciones"
  ON public.observaciones_piloto
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Usuarios editan sus observaciones"
  ON public.observaciones_piloto
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios eliminan sus observaciones"
  ON public.observaciones_piloto
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- El equipo investigador necesita leerlas todas para sistematizar los
-- hallazgos, y marcarlas como atendidas a medida que las resuelve.
CREATE POLICY "Administradores ven todas las observaciones"
  ON public.observaciones_piloto
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Administradores marcan observaciones como atendidas"
  ON public.observaciones_piloto
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
