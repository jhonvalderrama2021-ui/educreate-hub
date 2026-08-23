-- Imagenes ilustrativas del centro de ayuda.
--
-- El asesor pidio que la ayuda incluyera capturas de pantalla. Para que no
-- haya que tocar el codigo cada vez que cambie la interfaz, el administrador
-- las sube desde su panel y quedan asociadas a la seccion correspondiente.

-- Bucket publico: son capturas de la propia interfaz, sin datos sensibles, y
-- se muestran a cualquier docente que consulte la ayuda.
INSERT INTO storage.buckets (id, name, public)
VALUES ('ayuda-imagenes', 'ayuda-imagenes', true)
ON CONFLICT (id) DO NOTHING;

-- Cualquiera puede verlas; solo el administrador las gestiona.
DROP POLICY IF EXISTS "Imagenes de ayuda visibles para todos" ON storage.objects;
CREATE POLICY "Imagenes de ayuda visibles para todos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ayuda-imagenes');

DROP POLICY IF EXISTS "Administradores suben imagenes de ayuda" ON storage.objects;
CREATE POLICY "Administradores suben imagenes de ayuda"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ayuda-imagenes' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Administradores actualizan imagenes de ayuda" ON storage.objects;
CREATE POLICY "Administradores actualizan imagenes de ayuda"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'ayuda-imagenes' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Administradores eliminan imagenes de ayuda" ON storage.objects;
CREATE POLICY "Administradores eliminan imagenes de ayuda"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ayuda-imagenes' AND public.has_role(auth.uid(), 'admin'::app_role));

-- Relacion entre cada seccion de la ayuda y sus imagenes.
CREATE TABLE IF NOT EXISTS public.ayuda_imagenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seccion text NOT NULL,
  ruta text NOT NULL,
  descripcion text,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ayuda_imagenes_seccion
  ON public.ayuda_imagenes(seccion, orden);

ALTER TABLE public.ayuda_imagenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos consultan las imagenes de ayuda"
  ON public.ayuda_imagenes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Administradores gestionan las imagenes de ayuda"
  ON public.ayuda_imagenes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
