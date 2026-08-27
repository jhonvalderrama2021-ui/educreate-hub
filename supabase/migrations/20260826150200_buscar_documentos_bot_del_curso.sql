-- Que el bot del curso responda CON el material que le cargó el docente.
--
-- buscar_en_documentos_bot exigía ser dueño del bot. Un estudiante del curso
-- no lo es, así que la función lanzaba "No tienes acceso a este bot".
--
-- Eso importa más de lo que parece: quien llama esta función atrapa el error
-- y sigue adelante sin pasajes, de modo que el bot habría contestado con
-- conocimiento general en vez de con la cartilla de la clase. Se habría visto
-- funcionando mientras daba peores respuestas, que es la peor forma de
-- fallar: sin avisarle a nadie.
--
-- Se mantiene la exigencia de pertenecer al curso: sigue siendo un permiso,
-- solo que ahora reconoce las dos formas legítimas de tener acceso al bot.

create or replace function public.buscar_en_documentos_bot(
  p_bot_id uuid,
  p_embedding text,
  p_limite integer default 5
)
-- La firma se respeta al pie de la letra: la columna se llama `documento`
-- y p_limite trae valor por defecto. Cambiar cualquiera de las dos rompe a
-- quien ya la llama.
returns table (texto text, documento text, similitud double precision)
language plpgsql
stable
security definer
-- extensions va en la lista a proposito: el operador <=> de pgvector vive
-- alli. Fijar solo `public` deja la busqueda sin operador y la funcion falla
-- para TODO el mundo, no solo para los estudiantes.
set search_path = public, extensions
as $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.bots b
    WHERE b.id = p_bot_id AND b.user_id = auth.uid()
  ) AND NOT public.bot_esta_en_mi_curso(p_bot_id, auth.uid()) THEN
    RAISE EXCEPTION 'No tienes acceso a este bot';
  END IF;

  RETURN QUERY
  SELECT
    f.texto,
    d.nombre AS documento,
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
