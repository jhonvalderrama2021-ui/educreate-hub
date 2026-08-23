-- Bots que responden a partir de un documento del docente.
--
-- Ultimo punto pendiente de la tarea 8 de la reunion de asesoria:
--   "El bot puede partir de un documento que yo pueda anexar"
--   "Nos tocaria hacerle como una vectorizacion a los PDF"
--
-- Que resuelve la vectorizacion y por que no basta con pegar el texto en el
-- prompt: una cartilla del MEN o un plan de area tiene decenas de miles de
-- caracteres. Mandarlo entero en cada pregunta costaria mucho y ademas el
-- modelo se pierde entre tanto texto. En su lugar el documento se parte en
-- fragmentos, cada fragmento se convierte en un vector que representa su
-- significado, y ante cada pregunta se recuperan solo los cinco fragmentos
-- mas parecidos. El bot responde con eso.

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- ── Documentos anexados a un bot ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bot_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  caracteres integer NOT NULL DEFAULT 0,
  fragmentos integer NOT NULL DEFAULT 0,
  -- Procesar un documento largo tarda: el docente necesita ver en que va.
  estado text NOT NULL DEFAULT 'procesando'
    CHECK (estado IN ('procesando', 'listo', 'error')),
  detalle_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_documentos_bot
  ON public.bot_documentos (bot_id, created_at DESC);

-- ── Fragmentos con su vector ───────────────────────────────────────────
-- 1536 dimensiones: es lo que devuelve text-embedding-3-small, el modelo de
-- OpenAI mas barato. Cambiar de modelo obliga a reprocesar todo, porque los
-- vectores de modelos distintos no son comparables entre si.
CREATE TABLE IF NOT EXISTS public.bot_fragmentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL REFERENCES public.bot_documentos(id) ON DELETE CASCADE,
  bot_id uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  orden integer NOT NULL,
  texto text NOT NULL,
  embedding extensions.vector(1536),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_fragmentos_bot
  ON public.bot_fragmentos (bot_id);

-- HNSW y no ivfflat: ivfflat necesita que la tabla ya tenga datos para
-- construir bien sus listas, y aqui los documentos entran de a poco. HNSW
-- funciona bien desde el primer registro.
-- vector_cosine_ops porque los embeddings de OpenAI se comparan por coseno.
CREATE INDEX IF NOT EXISTS idx_bot_fragmentos_embedding
  ON public.bot_fragmentos
  USING hnsw (embedding extensions.vector_cosine_ops);

-- ── Seguridad ──────────────────────────────────────────────────────────
ALTER TABLE public.bot_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_fragmentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cada quien ve los documentos de sus bots" ON public.bot_documentos;
CREATE POLICY "Cada quien ve los documentos de sus bots"
  ON public.bot_documentos FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Cada quien borra los documentos de sus bots" ON public.bot_documentos;
CREATE POLICY "Cada quien borra los documentos de sus bots"
  ON public.bot_documentos FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- No hay politica de INSERT ni de UPDATE a proposito: los documentos los
-- crea la Edge Function, que es la unica que sabe generar los vectores. Una
-- fila insertada desde el navegador quedaria sin fragmentos y el bot diria
-- que tiene un documento que en realidad no puede consultar.

DROP POLICY IF EXISTS "Cada quien ve los fragmentos de sus bots" ON public.bot_fragmentos;
CREATE POLICY "Cada quien ve los fragmentos de sus bots"
  ON public.bot_fragmentos FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ── Busqueda por significado ───────────────────────────────────────────
-- El vector llega como texto porque PostgREST no sabe serializar el tipo
-- vector; se convierte aqui dentro.
--
-- SECURITY DEFINER para poder usar el indice sin que RLS reescriba la
-- consulta, pero con la propiedad del bot comprobada explicitamente: sin esa
-- comprobacion cualquiera podria leer los documentos de otro docente.
CREATE OR REPLACE FUNCTION public.buscar_en_documentos_bot(
  p_bot_id uuid,
  p_embedding text,
  p_limite integer DEFAULT 5
)
RETURNS TABLE (
  texto text,
  documento text,
  similitud double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.bots b
    WHERE b.id = p_bot_id AND b.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'No tienes acceso a este bot';
  END IF;

  RETURN QUERY
  SELECT
    f.texto,
    d.nombre,
    -- El operador <=> devuelve distancia coseno (0 = identico). Se invierte
    -- para que el numero se lea como "que tanto se parece".
    1 - (f.embedding <=> p_embedding::extensions.vector) AS similitud
  FROM public.bot_fragmentos f
  JOIN public.bot_documentos d ON d.id = f.documento_id
  WHERE f.bot_id = p_bot_id
    AND d.estado = 'listo'
    AND f.embedding IS NOT NULL
  ORDER BY f.embedding <=> p_embedding::extensions.vector
  LIMIT GREATEST(1, LEAST(p_limite, 20));
END;
$$;

REVOKE ALL ON FUNCTION public.buscar_en_documentos_bot(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buscar_en_documentos_bot(uuid, text, integer) TO authenticated, service_role;

-- ── Cuantos documentos tiene cada bot ──────────────────────────────────
-- Para el contador de la lista de bots, sin traerse los fragmentos.
CREATE OR REPLACE VIEW public.bots_con_documentos
WITH (security_invoker = true) AS
  SELECT
    b.id AS bot_id,
    COUNT(d.id) FILTER (WHERE d.estado = 'listo') AS documentos_listos,
    COUNT(d.id) FILTER (WHERE d.estado = 'procesando') AS documentos_procesando
  FROM public.bots b
  LEFT JOIN public.bot_documentos d ON d.bot_id = b.id
  GROUP BY b.id;

GRANT SELECT ON public.bots_con_documentos TO authenticated;
