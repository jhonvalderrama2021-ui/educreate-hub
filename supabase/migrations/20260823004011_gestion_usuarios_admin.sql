-- Gestion de usuarios desde el panel de administracion.
--
-- Pedido del asesor en la reunion: "en el modulo administrador debe poderse
-- verificar los usuarios, editar usuarios, desactivar usuarios - desactivar
-- el docente, desactivar el estudiante".
--
-- Hasta ahora el panel solo permitia cambiar el rol. No habia forma de saber
-- si un usuario confirmo su correo ni cuando entro por ultima vez, ni de
-- cerrarle el acceso a alguien que ya no pertenece a la institucion.

-- ── Estado del usuario ─────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS desactivado_en timestamptz,
  ADD COLUMN IF NOT EXISTS desactivado_por uuid;

COMMENT ON COLUMN public.profiles.activo IS
  'false = el administrador le cerro el acceso. No se borra la cuenta para no perder sus recursos ni las entregas de sus estudiantes.';

-- Se consulta en cada peticion de las Edge Functions: conviene el indice
-- parcial, que solo pesa lo que ocupan los desactivados.
CREATE INDEX IF NOT EXISTS idx_profiles_inactivos
  ON public.profiles (id) WHERE activo = false;

-- ── Comprobacion de acceso ─────────────────────────────────────────────
-- SECURITY DEFINER porque un usuario desactivado debe poder ser evaluado
-- aunque sus propias politicas ya no le permitan leer nada.
CREATE OR REPLACE FUNCTION public.es_usuario_activo(p_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE((SELECT activo FROM public.profiles WHERE id = p_id), true);
$$;

REVOKE ALL ON FUNCTION public.es_usuario_activo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.es_usuario_activo(uuid) TO authenticated, service_role;

-- ── Listado para el administrador ──────────────────────────────────────
-- `email_confirmed_at` y `last_sign_in_at` viven en auth.users, que no es
-- accesible desde el cliente. Esta funcion es la unica via para que el
-- administrador pueda "verificar los usuarios" como pidio el asesor.
CREATE OR REPLACE FUNCTION public.admin_listar_usuarios()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  username text,
  rol text,
  activo boolean,
  correo_confirmado boolean,
  ultimo_acceso timestamptz,
  creado_en timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    p.id,
    p.email,
    p.full_name,
    p.username,
    COALESCE(ur.role::text, 'estudiante'),
    p.activo,
    (au.email_confirmed_at IS NOT NULL),
    au.last_sign_in_at,
    p.created_at
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.id
  LEFT JOIN auth.users au ON au.id = p.id
  -- Sin esta condicion la funcion filtraria nada y expondria auth.users
  -- entero a cualquier usuario autenticado.
  WHERE public.has_role(auth.uid(), 'admin'::public.app_role)
  ORDER BY p.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_listar_usuarios() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_listar_usuarios() TO authenticated;

-- ── Editar los datos de un usuario ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_actualizar_usuario(
  p_id uuid,
  p_nombre text,
  p_usuario text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo un administrador puede editar usuarios';
  END IF;

  UPDATE public.profiles
  SET full_name = NULLIF(btrim(p_nombre), ''),
      username  = NULLIF(btrim(p_usuario), ''),
      updated_at = now()
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El usuario no existe';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_actualizar_usuario(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_actualizar_usuario(uuid, text, text) TO authenticated;

-- ── Activar o desactivar ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_cambiar_estado_usuario(
  p_id uuid,
  p_activo boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar el estado de un usuario';
  END IF;

  -- Un administrador que se desactive a si mismo dejaria la plataforma sin
  -- quien pueda revertirlo.
  IF p_id = auth.uid() AND p_activo = false THEN
    RAISE EXCEPTION 'No puedes desactivar tu propia cuenta';
  END IF;

  UPDATE public.profiles
  SET activo = p_activo,
      desactivado_en  = CASE WHEN p_activo THEN NULL ELSE now() END,
      desactivado_por = CASE WHEN p_activo THEN NULL ELSE auth.uid() END,
      updated_at = now()
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El usuario no existe';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_cambiar_estado_usuario(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_cambiar_estado_usuario(uuid, boolean) TO authenticated;
