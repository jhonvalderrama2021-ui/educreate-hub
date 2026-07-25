
-- 1) Remove RLS that let enrolled students read raw exam answers
DROP POLICY IF EXISTS "Enrolled students view course generated resources" ON public.generated_resources;

-- 2) Lock down SECURITY DEFINER functions: revoke from PUBLIC/anon, keep authenticated where needed
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.is_course_teacher(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_course_teacher(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_enrolled(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_enrolled(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.join_course_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_course_by_code(text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_has_openai_key() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_has_openai_key() TO authenticated;

-- Trigger / internal helpers: not callable directly
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
