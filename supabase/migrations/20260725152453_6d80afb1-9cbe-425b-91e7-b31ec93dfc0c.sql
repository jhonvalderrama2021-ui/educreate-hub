
-- Tighten course_resources insert/update: teacher must own the referenced resource
DROP POLICY IF EXISTS "Teachers manage course_resources" ON public.course_resources;
DROP POLICY IF EXISTS "Teachers insert course_resources" ON public.course_resources;
DROP POLICY IF EXISTS "Teachers update course_resources" ON public.course_resources;
DROP POLICY IF EXISTS "Teachers delete course_resources" ON public.course_resources;
DROP POLICY IF EXISTS "Teachers select course_resources" ON public.course_resources;

CREATE POLICY "Teachers select course_resources"
ON public.course_resources FOR SELECT
TO authenticated
USING (public.is_course_teacher(course_id, auth.uid()) OR public.is_enrolled(course_id, auth.uid()));

CREATE POLICY "Teachers insert course_resources"
ON public.course_resources FOR INSERT
TO authenticated
WITH CHECK (
  public.is_course_teacher(course_id, auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.generated_resources gr
    WHERE gr.id = resource_id AND gr.user_id = auth.uid()
  )
);

CREATE POLICY "Teachers update course_resources"
ON public.course_resources FOR UPDATE
TO authenticated
USING (public.is_course_teacher(course_id, auth.uid()))
WITH CHECK (
  public.is_course_teacher(course_id, auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.generated_resources gr
    WHERE gr.id = resource_id AND gr.user_id = auth.uid()
  )
);

CREATE POLICY "Teachers delete course_resources"
ON public.course_resources FOR DELETE
TO authenticated
USING (public.is_course_teacher(course_id, auth.uid()));

-- Tighten teacher SELECT on generated_resources: only own resources within own courses
DROP POLICY IF EXISTS "Teachers view generated resources in own courses" ON public.generated_resources;
