export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      accesos: {
        Row: {
          created_at: string
          id: string
          inicio: string
          ultima_actividad: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          inicio?: string
          ultima_actividad?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          inicio?: string
          ultima_actividad?: string
          user_id?: string
        }
        Relationships: []
      }
      ayuda_imagenes: {
        Row: {
          created_at: string
          descripcion: string | null
          id: string
          orden: number
          ruta: string
          seccion: string
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          id?: string
          orden?: number
          ruta: string
          seccion: string
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          id?: string
          orden?: number
          ruta?: string
          seccion?: string
        }
        Relationships: []
      }
      bot_documentos: {
        Row: {
          bot_id: string
          caracteres: number
          created_at: string
          detalle_error: string | null
          estado: string
          fragmentos: number
          id: string
          nombre: string
          user_id: string
        }
        Insert: {
          bot_id: string
          caracteres?: number
          created_at?: string
          detalle_error?: string | null
          estado?: string
          fragmentos?: number
          id?: string
          nombre: string
          user_id: string
        }
        Update: {
          bot_id?: string
          caracteres?: number
          created_at?: string
          detalle_error?: string | null
          estado?: string
          fragmentos?: number
          id?: string
          nombre?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_documentos_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_documentos_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots_con_documentos"
            referencedColumns: ["bot_id"]
          },
        ]
      }
      bot_fragmentos: {
        Row: {
          bot_id: string
          created_at: string
          documento_id: string
          embedding: string | null
          id: string
          orden: number
          texto: string
          user_id: string
        }
        Insert: {
          bot_id: string
          created_at?: string
          documento_id: string
          embedding?: string | null
          id?: string
          orden: number
          texto: string
          user_id: string
        }
        Update: {
          bot_id?: string
          created_at?: string
          documento_id?: string
          embedding?: string | null
          id?: string
          orden?: number
          texto?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_fragmentos_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_fragmentos_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots_con_documentos"
            referencedColumns: ["bot_id"]
          },
          {
            foreignKeyName: "bot_fragmentos_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "bot_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_messages: {
        Row: {
          bot_id: string
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          bot_id: string
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          bot_id?: string
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_messages_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_messages_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots_con_documentos"
            referencedColumns: ["bot_id"]
          },
        ]
      }
      bots: {
        Row: {
          created_at: string
          detalle: string | null
          id: string
          name: string
          nivel_educativo: string | null
          specialty: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          detalle?: string | null
          id?: string
          name: string
          nivel_educativo?: string | null
          specialty: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          detalle?: string | null
          id?: string
          name?: string
          nivel_educativo?: string | null
          specialty?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      calendar_notes: {
        Row: {
          color: string
          created_at: string
          date: string
          description: string | null
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          date: string
          description?: string | null
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      catalogos: {
        Row: {
          activo: boolean
          creado_por: string | null
          created_at: string
          id: string
          orden: number
          tipo: string
          updated_at: string
          valor: string
        }
        Insert: {
          activo?: boolean
          creado_por?: string | null
          created_at?: string
          id?: string
          orden?: number
          tipo: string
          updated_at?: string
          valor: string
        }
        Update: {
          activo?: boolean
          creado_por?: string | null
          created_at?: string
          id?: string
          orden?: number
          tipo?: string
          updated_at?: string
          valor?: string
        }
        Relationships: []
      }
      course_enrollments: {
        Row: {
          course_id: string
          enrolled_at: string
          enrolled_by: string | null
          id: string
          student_id: string
        }
        Insert: {
          course_id: string
          enrolled_at?: string
          enrolled_by?: string | null
          id?: string
          student_id: string
        }
        Update: {
          course_id?: string
          enrolled_at?: string
          enrolled_by?: string | null
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "mini_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_resources: {
        Row: {
          closes_at: string | null
          course_id: string
          created_at: string
          id: string
          max_attempts: number
          opens_at: string | null
          position: number
          resource_id: string
          resource_type: string
          show_feedback: boolean
          show_grade: boolean
          shuffle_questions: boolean
          time_limit_minutes: number | null
          title: string
          updated_at: string
        }
        Insert: {
          closes_at?: string | null
          course_id: string
          created_at?: string
          id?: string
          max_attempts?: number
          opens_at?: string | null
          position?: number
          resource_id: string
          resource_type: string
          show_feedback?: boolean
          show_grade?: boolean
          shuffle_questions?: boolean
          time_limit_minutes?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          closes_at?: string | null
          course_id?: string
          created_at?: string
          id?: string
          max_attempts?: number
          opens_at?: string | null
          position?: number
          resource_id?: string
          resource_type?: string
          show_feedback?: boolean
          show_grade?: boolean
          shuffle_questions?: boolean
          time_limit_minutes?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_resources_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "mini_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_resources_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "generated_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_resources: {
        Row: {
          content: Json
          created_at: string | null
          grade: string | null
          id: string
          is_public: boolean | null
          resource_type: string
          source_pdf_url: string | null
          subject: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content?: Json
          created_at?: string | null
          grade?: string | null
          id?: string
          is_public?: boolean | null
          resource_type: string
          source_pdf_url?: string | null
          subject?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string | null
          grade?: string | null
          id?: string
          is_public?: boolean | null
          resource_type?: string
          source_pdf_url?: string | null
          subject?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      mini_courses: {
        Row: {
          access_code: string
          created_at: string
          description: string | null
          grado: string | null
          grupo: string | null
          id: string
          is_active: boolean
          name: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          access_code: string
          created_at?: string
          description?: string | null
          grado?: string | null
          grupo?: string | null
          id?: string
          is_active?: boolean
          name: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          access_code?: string
          created_at?: string
          description?: string | null
          grado?: string | null
          grupo?: string | null
          id?: string
          is_active?: boolean
          name?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      observaciones_piloto: {
        Row: {
          atendida: boolean
          created_at: string
          id: string
          modulo: string
          observacion: string
          recurso_id: string | null
          user_id: string
        }
        Insert: {
          atendida?: boolean
          created_at?: string
          id?: string
          modulo: string
          observacion: string
          recurso_id?: string | null
          user_id: string
        }
        Update: {
          atendida?: boolean
          created_at?: string
          id?: string
          modulo?: string
          observacion?: string
          recurso_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "observaciones_piloto_recurso_id_fkey"
            columns: ["recurso_id"]
            isOneToOne: false
            referencedRelation: "generated_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activo: boolean
          created_at: string
          desactivado_en: string | null
          desactivado_por: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          username: string | null
        }
        Insert: {
          activo?: boolean
          created_at?: string
          desactivado_en?: string | null
          desactivado_por?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          activo?: boolean
          created_at?: string
          desactivado_en?: string | null
          desactivado_por?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      resource_submissions: {
        Row: {
          answers: Json
          attempt_number: number
          course_id: string
          course_resource_id: string
          feedback: Json | null
          id: string
          max_score: number | null
          resource_type: string
          score: number | null
          started_at: string
          student_id: string
          submitted_at: string
          time_spent_seconds: number | null
        }
        Insert: {
          answers?: Json
          attempt_number?: number
          course_id: string
          course_resource_id: string
          feedback?: Json | null
          id?: string
          max_score?: number | null
          resource_type: string
          score?: number | null
          started_at?: string
          student_id: string
          submitted_at?: string
          time_spent_seconds?: number | null
        }
        Update: {
          answers?: Json
          attempt_number?: number
          course_id?: string
          course_resource_id?: string
          feedback?: Json | null
          id?: string
          max_score?: number | null
          resource_type?: string
          score?: number | null
          started_at?: string
          student_id?: string
          submitted_at?: string
          time_spent_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "resource_submissions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "mini_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_submissions_course_resource_id_fkey"
            columns: ["course_resource_id"]
            isOneToOne: false
            referencedRelation: "course_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      user_ai_preferences: {
        Row: {
          id: string
          ollama_model: string | null
          ollama_url: string | null
          provider: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          ollama_model?: string | null
          ollama_url?: string | null
          provider?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          ollama_model?: string | null
          ollama_url?: string | null
          provider?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      bots_con_documentos: {
        Row: {
          bot_id: string | null
          documentos_listos: number | null
          documentos_procesando: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_actualizar_usuario: {
        Args: { p_id: string; p_nombre: string; p_usuario: string }
        Returns: undefined
      }
      admin_cambiar_estado_usuario: {
        Args: { p_activo: boolean; p_id: string }
        Returns: undefined
      }
      admin_has_openai_key: { Args: never; Returns: boolean }
      admin_listar_usuarios: {
        Args: never
        Returns: {
          activo: boolean
          correo_confirmado: boolean
          creado_en: string
          email: string
          full_name: string
          id: string
          rol: string
          ultimo_acceso: string
          username: string
        }[]
      }
      buscar_en_documentos_bot: {
        Args: { p_bot_id: string; p_embedding: string; p_limite?: number }
        Returns: {
          documento: string
          similitud: number
          texto: string
        }[]
      }
      buscar_usuario_por_correo: { Args: { _correo: string }; Returns: string }
      duplicar_curso_para_grupo: {
        Args: { p_clave: string; p_curso_id: string; p_grupo: string }
        Returns: string
      }
      es_estudiante_de_mis_cursos: {
        Args: { _docente: string; _estudiante: string }
        Returns: boolean
      }
      es_usuario_activo: { Args: { p_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_course_teacher: {
        Args: { _course_id: string; _user_id: string }
        Returns: boolean
      }
      is_enrolled: {
        Args: { _course_id: string; _user_id: string }
        Returns: boolean
      }
      join_course_by_code: { Args: { _code: string }; Returns: string }
      registrar_acceso: { Args: never; Returns: string }
      resumen_accesos: {
        Args: { p_dias?: number }
        Returns: {
          email: string
          nombre: string
          primera_vez: string
          rol: string
          segundos_totales: number
          sesiones: number
          ultima_vez: string
          user_id: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "docente" | "estudiante"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "docente", "estudiante"],
    },
  },
} as const
