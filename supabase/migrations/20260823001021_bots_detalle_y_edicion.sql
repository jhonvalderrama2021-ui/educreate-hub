-- Personalizacion y edicion de los asistentes conversacionales.
--
-- El asesor observo que con solo nombre y especialidad el bot queda muy
-- basico, y pidio un campo de detalle para precisar como debe comportarse.
-- Tambien senalo que no habia forma de corregir un bot: unicamente crearlo o
-- borrarlo y volver a crearlo.

ALTER TABLE public.bots
  ADD COLUMN IF NOT EXISTS detalle text,
  ADD COLUMN IF NOT EXISTS nivel_educativo text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Sin politica de actualizacion la edicion es imposible aunque la interfaz
-- la ofrezca: la base de datos rechazaria el cambio.
DROP POLICY IF EXISTS "Users can update own bots" ON public.bots;
CREATE POLICY "Users can update own bots"
  ON public.bots
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
