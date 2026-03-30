
-- Fix 1: Restrict storage uploads to user's own folder
DROP POLICY IF EXISTS "Users can upload resource PDFs" ON storage.objects;
CREATE POLICY "Users can upload resource PDFs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'resource-pdfs'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Fix 2: Replace has_role function to prevent role enumeration
-- The function now only checks the calling user's own roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND _user_id = auth.uid()
  )
$$;
