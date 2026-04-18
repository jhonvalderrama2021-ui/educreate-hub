-- 1) Fix has_role: drop the misleading self-referential clause.
--    Admin-write policies on user_roles still gate insert/update/delete to admins.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$function$;

-- 2) Server-side check for whether the OpenAI key exists, without ever returning the value.
CREATE OR REPLACE FUNCTION public.admin_has_openai_key()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.platform_settings
    WHERE key = 'openai_api_key'
      AND value IS NOT NULL
      AND length(trim(value)) > 0
  );
END;
$function$;

-- 3) Add UPDATE policy on resource-pdfs storage bucket so only file owners can overwrite their files.
CREATE POLICY "Users can update own resource pdfs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'resource-pdfs' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'resource-pdfs' AND (auth.uid())::text = (storage.foldername(name))[1]);