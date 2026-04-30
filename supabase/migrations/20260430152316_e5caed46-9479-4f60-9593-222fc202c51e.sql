
-- TABLES FIRST (no policies that cross-reference yet)

CREATE TABLE public.mini_courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  access_code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mini_courses_teacher ON public.mini_courses(teacher_id);
CREATE INDEX idx_mini_courses_code ON public.mini_courses(access_code);

CREATE TABLE public.course_enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.mini_courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  enrolled_by UUID,
  UNIQUE (course_id, student_id)
);
CREATE INDEX idx_enrollments_course ON public.course_enrollments(course_id);
CREATE INDEX idx_enrollments_student ON public.course_enrollments(student_id);

CREATE TABLE public.course_resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.mini_courses(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES public.generated_resources(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  title TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  show_grade BOOLEAN NOT NULL DEFAULT true,
  show_feedback BOOLEAN NOT NULL DEFAULT true,
  max_attempts INT NOT NULL DEFAULT 1,
  time_limit_minutes INT,
  opens_at TIMESTAMPTZ,
  closes_at TIMESTAMPTZ,
  shuffle_questions BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, resource_id)
);
CREATE INDEX idx_course_resources_course ON public.course_resources(course_id);

CREATE TABLE public.resource_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_resource_id UUID NOT NULL REFERENCES public.course_resources(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.mini_courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  resource_type TEXT NOT NULL,
  attempt_number INT NOT NULL DEFAULT 1,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  score NUMERIC(5,2),
  max_score NUMERIC(5,2),
  time_spent_seconds INT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  feedback JSONB
);
CREATE INDEX idx_submissions_course_resource ON public.resource_submissions(course_resource_id);
CREATE INDEX idx_submissions_student ON public.resource_submissions(student_id);
CREATE INDEX idx_submissions_course ON public.resource_submissions(course_id);

-- ENABLE RLS
ALTER TABLE public.mini_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_submissions ENABLE ROW LEVEL SECURITY;

-- HELPER FUNCTIONS (avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.is_course_teacher(_course_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.mini_courses WHERE id = _course_id AND teacher_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.is_enrolled(_course_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.course_enrollments WHERE course_id = _course_id AND student_id = _user_id)
$$;

-- POLICIES: mini_courses
CREATE POLICY "Teachers can view own courses" ON public.mini_courses
  FOR SELECT TO authenticated USING (auth.uid() = teacher_id);

CREATE POLICY "Students can view enrolled courses" ON public.mini_courses
  FOR SELECT TO authenticated USING (public.is_enrolled(id, auth.uid()));

CREATE POLICY "Teachers can create courses" ON public.mini_courses
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = teacher_id
    AND (public.has_role(auth.uid(), 'docente') OR public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Teachers can update own courses" ON public.mini_courses
  FOR UPDATE TO authenticated USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teachers can delete own courses" ON public.mini_courses
  FOR DELETE TO authenticated USING (auth.uid() = teacher_id);

-- POLICIES: course_enrollments
CREATE POLICY "Students view own enrollments" ON public.course_enrollments
  FOR SELECT TO authenticated USING (auth.uid() = student_id);

CREATE POLICY "Teachers view enrollments of own courses" ON public.course_enrollments
  FOR SELECT TO authenticated USING (public.is_course_teacher(course_id, auth.uid()));

CREATE POLICY "Teachers can manually enroll" ON public.course_enrollments
  FOR INSERT TO authenticated WITH CHECK (public.is_course_teacher(course_id, auth.uid()));

CREATE POLICY "Teachers or self can remove enrollment" ON public.course_enrollments
  FOR DELETE TO authenticated
  USING (public.is_course_teacher(course_id, auth.uid()) OR auth.uid() = student_id);

-- POLICIES: course_resources
CREATE POLICY "Teachers manage course resources" ON public.course_resources
  FOR ALL TO authenticated
  USING (public.is_course_teacher(course_id, auth.uid()))
  WITH CHECK (public.is_course_teacher(course_id, auth.uid()));

CREATE POLICY "Enrolled students view course resources" ON public.course_resources
  FOR SELECT TO authenticated USING (public.is_enrolled(course_id, auth.uid()));

-- POLICIES: resource_submissions
CREATE POLICY "Students view own submissions" ON public.resource_submissions
  FOR SELECT TO authenticated USING (auth.uid() = student_id);

CREATE POLICY "Teachers view submissions of own courses" ON public.resource_submissions
  FOR SELECT TO authenticated USING (public.is_course_teacher(course_id, auth.uid()));

CREATE POLICY "Students submit to enrolled course resources" ON public.resource_submissions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = student_id AND public.is_enrolled(course_id, auth.uid()));

-- TRIGGERS
CREATE TRIGGER trg_mini_courses_updated
  BEFORE UPDATE ON public.mini_courses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_course_resources_updated
  BEFORE UPDATE ON public.course_resources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- JOIN BY CODE
CREATE OR REPLACE FUNCTION public.join_course_by_code(_code TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _course_id UUID;
  _user_id UUID := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO _course_id
  FROM public.mini_courses
  WHERE access_code = _code AND is_active = true
  LIMIT 1;

  IF _course_id IS NULL THEN
    RAISE EXCEPTION 'Clave de curso inválida';
  END IF;

  INSERT INTO public.course_enrollments (course_id, student_id, enrolled_by)
  VALUES (_course_id, _user_id, _user_id)
  ON CONFLICT (course_id, student_id) DO NOTHING;

  RETURN _course_id;
END;
$$;
