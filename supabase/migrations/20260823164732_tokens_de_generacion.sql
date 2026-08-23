-- Tokens de generacion: un tope diario por persona.
--
-- No es un cobro. La plataforma es beta y va para instituciones: el tope
-- existe para que una tarde de pruebas no se lleve por delante la clave de
-- OpenAI del proyecto. Quien se queda sin tokens espera al dia siguiente, o
-- habla con el administrador para que le amplie.
--
-- Solo cuesta GENERAR. Editar, exportar y armar mini cursos son gratis:
-- ninguno gasta IA, y cobrarlos empujaria al docente a no revisar lo que
-- genero, que es justo lo contrario de lo que se busca.

-- ── Cuanto cuesta cada recurso ─────────────────────────────────────────
-- En una tabla y no en el codigo, para poder afinar el precio sin desplegar.
-- Los numeros salen del costo real medido: un examen ICFES cuesta unos
-- $0,065 y una rubrica $0,020, mas del triple. Cobrar lo mismo por los dos
-- haria que quien genera examenes agotara su cupo tres veces mas rapido.
CREATE TABLE IF NOT EXISTS public.token_costos (
  recurso text PRIMARY KEY,
  tokens integer NOT NULL CHECK (tokens >= 0),
  descripcion text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.token_costos (recurso, tokens, descripcion) VALUES
  ('icfes',       15, 'Examen tipo ICFES'),
  ('true_false',  15, 'Examen de falso y verdadero'),
  ('mixed',       15, 'Examen mixto'),
  ('slides',      15, 'Diapositivas'),
  ('workshop',    10, 'Taller'),
  ('lesson_plan', 10, 'Plan de clase'),
  ('guide',       10, 'Guía'),
  ('rubric',       6, 'Rúbrica'),
  ('crossword',    6, 'Crucigrama'),
  ('story',       25, 'Cuento ilustrado (incluye las imágenes)'),
  ('bot_documento', 5, 'Procesar un documento para un bot'),
  ('chat_bot',     1, 'Cada mensaje al bot')
ON CONFLICT (recurso) DO NOTHING;

ALTER TABLE public.token_costos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Todos ven los costos" ON public.token_costos;
CREATE POLICY "Todos ven los costos"
  ON public.token_costos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin ajusta los costos" ON public.token_costos;
CREATE POLICY "Admin ajusta los costos"
  ON public.token_costos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ── El saldo de cada persona ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.token_saldos (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Cuanto le toca cada dia. El administrador puede subirlo de forma
  -- permanente para alguien que lo necesite.
  limite_diario integer NOT NULL DEFAULT 200 CHECK (limite_diario >= 0),
  -- Un regalo que vale SOLO hoy: para el docente que se quedo sin cupo en
  -- plena clase. Se pierde con la recarga, que es lo que lo hace excepcional.
  extra_hoy integer NOT NULL DEFAULT 0 CHECK (extra_hoy >= 0),
  usados_hoy integer NOT NULL DEFAULT 0 CHECK (usados_hoy >= 0),
  -- El dia al que corresponden `usados_hoy` y `extra_hoy`. Cuando cambia, se
  -- recarga solo: no hace falta una tarea programada que pueda no ejecutarse.
  dia date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Bogota')::date,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.token_saldos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cada quien ve su saldo" ON public.token_saldos;
CREATE POLICY "Cada quien ve su saldo"
  ON public.token_saldos FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin ve todos los saldos" ON public.token_saldos;
CREATE POLICY "Admin ve todos los saldos"
  ON public.token_saldos FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Nadie escribe directo: se pasa por las funciones. Si el saldo se pudiera
-- actualizar desde el navegador, el tope no existiria.

-- ── Cada movimiento, para saber en que se gasto ────────────────────────
CREATE TABLE IF NOT EXISTS public.token_movimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Negativo al consumir, positivo al devolver o al regalar
  tokens integer NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('consumo', 'devolucion', 'regalo', 'ajuste_limite')),
  recurso text,
  detalle text,
  otorgado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_token_mov_usuario
  ON public.token_movimientos (user_id, created_at DESC);

ALTER TABLE public.token_movimientos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cada quien ve sus movimientos" ON public.token_movimientos;
CREATE POLICY "Cada quien ve sus movimientos"
  ON public.token_movimientos FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin ve todos los movimientos" ON public.token_movimientos;
CREATE POLICY "Admin ve todos los movimientos"
  ON public.token_movimientos FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ── Consultar el saldo, recargando el dia si toca ──────────────────────
CREATE OR REPLACE FUNCTION public.tokens_disponibles(p_user uuid DEFAULT auth.uid())
RETURNS TABLE (
  disponibles integer,
  limite_diario integer,
  usados_hoy integer,
  extra_hoy integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.token_saldos%ROWTYPE;
  v_hoy date := (now() AT TIME ZONE 'America/Bogota')::date;
BEGIN
  IF p_user <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'No puedes consultar el saldo de otra persona';
  END IF;

  INSERT INTO public.token_saldos (user_id) VALUES (p_user)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v FROM public.token_saldos WHERE user_id = p_user;

  -- La recarga ocurre al consultar, no con una tarea programada: una tarea
  -- que no se ejecute dejaria a todo el mundo sin tokens sin motivo visible.
  IF v.dia < v_hoy THEN
    UPDATE public.token_saldos
       SET usados_hoy = 0, extra_hoy = 0, dia = v_hoy, updated_at = now()
     WHERE user_id = p_user
    RETURNING * INTO v;
  END IF;

  RETURN QUERY SELECT
    GREATEST(0, v.limite_diario + v.extra_hoy - v.usados_hoy),
    v.limite_diario, v.usados_hoy, v.extra_hoy;
END;
$$;

REVOKE ALL ON FUNCTION public.tokens_disponibles(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tokens_disponibles(uuid) TO authenticated, service_role;

-- ── Cobrar ─────────────────────────────────────────────────────────────
-- Se cobra ANTES de llamar a OpenAI y se devuelve si la generacion falla.
-- Al reves —cobrar al terminar— dejaria disparar veinte peticiones a la vez
-- antes de que la primera descuente nada.
CREATE OR REPLACE FUNCTION public.consumir_tokens(
  p_user uuid,
  p_recurso text,
  p_detalle text DEFAULT NULL
)
RETURNS TABLE (disponibles integer, cobrado integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_costo integer;
  v public.token_saldos%ROWTYPE;
  v_hoy date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_disponible integer;
BEGIN
  SELECT tokens INTO v_costo FROM public.token_costos WHERE recurso = p_recurso;
  -- Un recurso sin precio no bloquea la plataforma: se cobra el precio medio
  -- y se deja constancia, mejor que dejar pasar la generacion gratis.
  IF v_costo IS NULL THEN v_costo := 10; END IF;
  IF v_costo = 0 THEN
    RETURN QUERY SELECT (SELECT t.disponibles FROM public.tokens_disponibles(p_user) t), 0;
    RETURN;
  END IF;

  INSERT INTO public.token_saldos (user_id) VALUES (p_user)
  ON CONFLICT (user_id) DO NOTHING;

  -- FOR UPDATE: dos generaciones a la vez no pueden leer el mismo saldo y
  -- descontar cada una por su cuenta.
  SELECT * INTO v FROM public.token_saldos WHERE user_id = p_user FOR UPDATE;

  IF v.dia < v_hoy THEN
    UPDATE public.token_saldos
       SET usados_hoy = 0, extra_hoy = 0, dia = v_hoy
     WHERE user_id = p_user
    RETURNING * INTO v;
  END IF;

  v_disponible := v.limite_diario + v.extra_hoy - v.usados_hoy;

  IF v_disponible < v_costo THEN
    RAISE EXCEPTION 'SIN_TOKENS:%:%', v_costo, GREATEST(0, v_disponible);
  END IF;

  UPDATE public.token_saldos
     SET usados_hoy = usados_hoy + v_costo, updated_at = now()
   WHERE user_id = p_user;

  INSERT INTO public.token_movimientos (user_id, tokens, tipo, recurso, detalle)
  VALUES (p_user, -v_costo, 'consumo', p_recurso, p_detalle);

  RETURN QUERY SELECT GREATEST(0, v_disponible - v_costo), v_costo;
END;
$$;

REVOKE ALL ON FUNCTION public.consumir_tokens(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consumir_tokens(uuid, text, text) TO service_role;

-- ── Devolver lo cobrado si la generacion fallo ─────────────────────────
CREATE OR REPLACE FUNCTION public.devolver_tokens(
  p_user uuid,
  p_tokens integer,
  p_recurso text DEFAULT NULL,
  p_detalle text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_tokens <= 0 THEN RETURN; END IF;

  UPDATE public.token_saldos
     SET usados_hoy = GREATEST(0, usados_hoy - p_tokens), updated_at = now()
   WHERE user_id = p_user;

  INSERT INTO public.token_movimientos (user_id, tokens, tipo, recurso, detalle)
  VALUES (p_user, p_tokens, 'devolucion', p_recurso, p_detalle);
END;
$$;

REVOKE ALL ON FUNCTION public.devolver_tokens(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.devolver_tokens(uuid, integer, text, text) TO service_role;

-- ── El administrador amplia ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_regalar_tokens(
  p_user uuid,
  p_tokens integer,
  p_motivo text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoy date := (now() AT TIME ZONE 'America/Bogota')::date;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo un administrador puede ampliar tokens';
  END IF;
  IF p_tokens <= 0 OR p_tokens > 5000 THEN
    RAISE EXCEPTION 'La ampliación debe estar entre 1 y 5000 tokens';
  END IF;

  INSERT INTO public.token_saldos (user_id) VALUES (p_user)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.token_saldos
     SET extra_hoy = CASE WHEN dia < v_hoy THEN p_tokens ELSE extra_hoy + p_tokens END,
         usados_hoy = CASE WHEN dia < v_hoy THEN 0 ELSE usados_hoy END,
         dia = v_hoy,
         updated_at = now()
   WHERE user_id = p_user;

  INSERT INTO public.token_movimientos (user_id, tokens, tipo, detalle, otorgado_por)
  VALUES (p_user, p_tokens, 'regalo', p_motivo, auth.uid());

  RETURN (SELECT GREATEST(0, limite_diario + extra_hoy - usados_hoy)
            FROM public.token_saldos WHERE user_id = p_user);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_regalar_tokens(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_regalar_tokens(uuid, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_cambiar_limite_tokens(
  p_user uuid,
  p_limite integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar el límite';
  END IF;
  IF p_limite < 0 OR p_limite > 5000 THEN
    RAISE EXCEPTION 'El límite diario debe estar entre 0 y 5000 tokens';
  END IF;

  INSERT INTO public.token_saldos (user_id, limite_diario) VALUES (p_user, p_limite)
  ON CONFLICT (user_id) DO UPDATE SET limite_diario = p_limite, updated_at = now();

  INSERT INTO public.token_movimientos (user_id, tokens, tipo, detalle, otorgado_por)
  VALUES (p_user, 0, 'ajuste_limite',
          'Límite diario cambiado a ' || p_limite, auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.admin_cambiar_limite_tokens(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_cambiar_limite_tokens(uuid, integer) TO authenticated;

-- ── Lo que ve el administrador ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_saldos_tokens()
RETURNS TABLE (
  user_id uuid,
  nombre text,
  email text,
  rol text,
  limite_diario integer,
  extra_hoy integer,
  usados_hoy integer,
  disponibles integer,
  usados_semana bigint,
  generaciones_semana bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    p.id,
    p.full_name,
    p.email,
    COALESCE(ur.role::text, 'estudiante'),
    COALESCE(s.limite_diario, 200),
    -- Si el saldo es de ayer, hoy cuenta como recien recargado
    CASE WHEN s.dia = (now() AT TIME ZONE 'America/Bogota')::date
         THEN COALESCE(s.extra_hoy, 0) ELSE 0 END,
    CASE WHEN s.dia = (now() AT TIME ZONE 'America/Bogota')::date
         THEN COALESCE(s.usados_hoy, 0) ELSE 0 END,
    GREATEST(0, COALESCE(s.limite_diario, 200)
      + CASE WHEN s.dia = (now() AT TIME ZONE 'America/Bogota')::date
             THEN COALESCE(s.extra_hoy, 0) ELSE 0 END
      - CASE WHEN s.dia = (now() AT TIME ZONE 'America/Bogota')::date
             THEN COALESCE(s.usados_hoy, 0) ELSE 0 END),
    COALESCE((SELECT -SUM(m.tokens) FROM public.token_movimientos m
               WHERE m.user_id = p.id AND m.tipo = 'consumo'
                 AND m.created_at > now() - interval '7 days'), 0),
    COALESCE((SELECT COUNT(*) FROM public.token_movimientos m
               WHERE m.user_id = p.id AND m.tipo = 'consumo'
                 AND m.created_at > now() - interval '7 days'), 0)
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.id
  LEFT JOIN public.token_saldos s ON s.user_id = p.id
  WHERE public.has_role(auth.uid(), 'admin'::public.app_role)
  ORDER BY p.full_name NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.admin_saldos_tokens() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_saldos_tokens() TO authenticated;
