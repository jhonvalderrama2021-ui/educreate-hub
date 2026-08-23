export interface MiniCourse {
  id: string;
  teacher_id: string;
  name: string;
  description: string | null;
  access_code: string;
  grado: string | null;
  grupo: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CourseEnrollment {
  id: string;
  course_id: string;
  student_id: string;
  enrolled_at: string;
  enrolled_by: string | null;
}

export interface CourseResource {
  id: string;
  course_id: string;
  resource_id: string;
  resource_type: string;
  title: string;
  position: number;
  show_grade: boolean;
  show_feedback: boolean;
  max_attempts: number;
  time_limit_minutes: number | null;
  opens_at: string | null;
  closes_at: string | null;
  shuffle_questions: boolean;
  created_at: string;
  updated_at: string;
}

export interface ResourceSubmission {
  id: string;
  course_resource_id: string;
  course_id: string;
  student_id: string;
  resource_type: string;
  attempt_number: number;
  answers: any;
  score: number | null;
  max_score: number | null;
  time_spent_seconds: number | null;
  started_at: string;
  submitted_at: string;
  feedback: any;
}

export function generateAccessCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}
