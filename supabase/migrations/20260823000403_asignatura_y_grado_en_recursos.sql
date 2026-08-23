-- Asignatura y grado como columnas consultables de cada recurso.
--
-- El docente ya los indicaba al generar, pero quedaban dentro del contenido y
-- no se podian usar para filtrar. El asesor pidio poder agrupar los recursos
-- por asignatura y grado al agregarlos a un curso, porque con veinte examenes
-- y treinta planes de clase la lista plana resulta inmanejable.

ALTER TABLE public.generated_resources
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS grade text;

-- Se filtra siempre acotando por usuario, de ahi los indices compuestos.
CREATE INDEX IF NOT EXISTS idx_recursos_usuario_asignatura
  ON public.generated_resources(user_id, subject);

CREATE INDEX IF NOT EXISTS idx_recursos_usuario_grado
  ON public.generated_resources(user_id, grade);

CREATE INDEX IF NOT EXISTS idx_recursos_usuario_tipo
  ON public.generated_resources(user_id, resource_type, created_at DESC);

-- Los recursos ya creados llevan estos datos dentro del contenido generado,
-- con nombres distintos segun el tipo. Se recuperan de ahi para que el filtro
-- funcione tambien con lo anterior a este cambio.
UPDATE public.generated_resources
SET subject = COALESCE(
      NULLIF(trim(content->>'subject'), ''),
      NULLIF(trim(content->>'asignatura'), ''),
      NULLIF(trim(content->>'area'), '')
    )
WHERE subject IS NULL
  AND content IS NOT NULL
  AND jsonb_typeof(content) = 'object';

UPDATE public.generated_resources
SET grade = COALESCE(
      NULLIF(trim(content->>'grade'), ''),
      NULLIF(trim(content->>'grado'), ''),
      NULLIF(trim(content->>'nivel'), '')
    )
WHERE grade IS NULL
  AND content IS NOT NULL
  AND jsonb_typeof(content) = 'object';
