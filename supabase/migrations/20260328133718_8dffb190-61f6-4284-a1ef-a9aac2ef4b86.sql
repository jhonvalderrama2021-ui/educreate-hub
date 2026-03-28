
-- Admin can view all profiles (for admin panel)
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Platform settings (admin-only, for API keys etc.)
CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage platform settings"
ON public.platform_settings FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- User AI preferences
CREATE TABLE public.user_ai_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'openai',
  ollama_url text DEFAULT 'http://localhost:11434',
  ollama_model text DEFAULT 'llama3',
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_ai_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own AI preferences"
ON public.user_ai_preferences FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Generated resources
CREATE TABLE public.generated_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  resource_type text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}',
  source_pdf_url text,
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.generated_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own resources"
ON public.generated_resources FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own resources"
ON public.generated_resources FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own resources"
ON public.generated_resources FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can view own resources"
ON public.generated_resources FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view public resources"
ON public.generated_resources FOR SELECT
TO authenticated
USING (is_public = true);

-- Storage bucket for PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('resource-pdfs', 'resource-pdfs', false);

CREATE POLICY "Users can upload resource PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'resource-pdfs');

CREATE POLICY "Users can view own resource PDFs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'resource-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own resource PDFs"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'resource-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);
