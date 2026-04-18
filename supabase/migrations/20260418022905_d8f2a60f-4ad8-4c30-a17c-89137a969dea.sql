CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, username)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email, NEW.raw_user_meta_data->>'username');

  -- Only allow safe self-assigned roles. 'admin' must NEVER be assignable from signup metadata.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    CASE
      WHEN NEW.raw_user_meta_data->>'role' = 'docente' THEN 'docente'::app_role
      ELSE 'estudiante'::app_role
    END
  );

  RETURN NEW;
END;
$function$;

-- Allow users to update their own bots (completes RLS coverage)
CREATE POLICY "Users can update own bots"
ON public.bots
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);