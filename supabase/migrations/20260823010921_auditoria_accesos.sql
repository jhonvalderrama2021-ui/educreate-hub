-- Auditoria de tiempos de acceso.
--
-- Pedido del asesor: "ustedes guardan cuando un estudiante entra y cuanto se
-- demoro... eso se llama los times", y el motivo concreto: "a veces los
-- estudiantes dicen 'es que yo si me conecte toda la noche' y se va a ver la
-- auditoria: entro 10 minutos".
--
-- Que mide esto exactamente: el tiempo con la plataforma abierta y activa. No
-- es lo mismo que el tiempo dedicado a un examen (eso ya lo guarda
-- resource_submissions.time_spent_seconds) ni prueba que la persona estuviera
-- leyendo. Es lo que se puede medir con honestidad desde el navegador.

CREATE TABLE IF NOT EXISTS public.accesos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  inicio timestamptz NOT NULL DEFAULT now(),
  -- Se refresca mientras la pestana este visible. La duracion de la sesion es
  -- la diferencia con `inicio`.
  ultima_actividad timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accesos_usuario_inicio
  ON public.accesos (user_id, inicio DESC);

ALTER TABLE public.accesos ENABLE ROW LEVEL SECURITY;

-- Cada persona ve su propio historial: aparece en "Mis datos", que es lo que
-- exige el habeas data colombiano.
DROP POLICY IF EXISTS "Cada quien ve sus accesos" ON public.accesos;
CREATE POLICY "Cada quien ve sus accesos"
  ON public.accesos FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin ve todos los accesos" ON public.accesos;
CREATE POLICY "Admin ve todos los accesos"
  ON public.accesos FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- El docente solo ve los de sus propios estudiantes inscritos, no los de
-- toda la institucion.
DROP POLICY IF EXISTS "Docentes ven accesos de sus estudiantes" ON public.accesos;
CREATE POLICY "Docentes ven accesos de sus estudiantes"
  ON public.accesos FOR SELECT TO authenticated
  USING (public.es_estudiante_de_mis_cursos(user_id, auth.uid()));

-- Nadie escribe directamente: se hace por la funcion de abajo, que decide si
-- prolonga la sesion abierta o abre una nueva. Si el cliente pudiera insertar
-- a voluntad, el registro dejaria de ser auditoria.

-- ── Registrar actividad ────────────────────────────────────────────────
-- Se llama al abrir la plataforma y cada pocos minutos mientras se usa.
-- Si la ultima senal fue hace menos de 15 minutos se considera la misma
-- sesion; si fue hace mas, la persona se fue y vuelve: sesion nueva.
CREATE OR REPLACE FUNCTION public.registrar_acceso()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Se requiere una sesion iniciada';
  END IF;

  SELECT id INTO v_id
  FROM public.accesos
  WHERE user_id = auth.uid()
    AND ultima_actividad > now() - interval '15 minutes'
  ORDER BY ultima_actividad DESC
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE public.accesos SET ultima_actividad = now() WHERE id = v_id;
    RETURN v_id;
  END IF;

  INSERT INTO public.accesos (user_id) VALUES (auth.uid()) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_acceso() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_acceso() TO authenticated;

-- ── Resumen para el administrador ──────────────────────────────────────
-- Una fila por persona con lo que el asesor queria poder contestar: cuantas
-- veces entro, cuanto tiempo estuvo y cuando fue la ultima vez.
CREATE OR REPLACE FUNCTION public.resumen_accesos(p_dias integer DEFAULT 30)
RETURNS TABLE (
  user_id uuid,
  nombre text,
  email text,
  rol text,
  sesiones bigint,
  segundos_totales bigint,
  primera_vez timestamptz,
  ultima_vez timestamptz
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
    COUNT(a.id),
    -- Una sesion de un solo latido dura 0 segundos, no null
    COALESCE(SUM(EXTRACT(EPOCH FROM (a.ultima_actividad - a.inicio)))::bigint, 0),
    MIN(a.inicio),
    MAX(a.ultima_actividad)
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.id
  LEFT JOIN public.accesos a
    ON a.user_id = p.id
   AND a.inicio > now() - (GREATEST(p_dias, 1) || ' days')::interval
  WHERE public.has_role(auth.uid(), 'admin'::public.app_role)
  GROUP BY p.id, p.full_name, p.email, ur.role
  ORDER BY MAX(a.ultima_actividad) DESC NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.resumen_accesos(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resumen_accesos(integer) TO authenticated;
