-- Allow enrolled students to read generated_resources that are attached to a course they are enrolled in
CREATE POLICY "Enrolled students view course generated resources"
ON public.generated_resources
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.course_resources cr
    WHERE cr.resource_id = generated_resources.id
      AND public.is_enrolled(cr.course_id, auth.uid())
  )
);

-- Allow course teachers to read generated_resources attached to their courses
CREATE POLICY "Teachers view generated resources in own courses"
ON public.generated_resources
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.course_resources cr
    WHERE cr.resource_id = generated_resources.id
      AND public.is_course_teacher(cr.course_id, auth.uid())
  )
);