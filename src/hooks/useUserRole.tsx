import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setLoading(false);
      return;
    }

    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (data && data.length > 0) {
          // Prioritize admin > docente > estudiante
          const roles = data.map((r) => r.role);
          if (roles.includes("admin")) setRole("admin");
          else if (roles.includes("docente")) setRole("docente");
          else setRole(roles[0] || "estudiante");
        } else {
          setRole("estudiante");
        }
        setLoading(false);
      });
  }, [user]);

  const isAdmin = role === "admin";
  const isDocente = role === "docente" || role === "admin";

  return { role, isAdmin, isDocente, loading };
}
