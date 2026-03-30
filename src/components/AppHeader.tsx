import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";

interface AppHeaderProps {
  maxWidth?: string;
}

export function AppHeader({ maxWidth = "max-w-6xl" }: AppHeaderProps) {
  const { user, loading } = useAuth();

  return (
    <header className={`flex items-center justify-between px-6 py-4 ${maxWidth} mx-auto`}>
      <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-2 text-primary font-bold text-xl">
        <BookOpen className="h-6 w-6" />
        NexProfe
      </Link>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        {!loading && (
          user ? (
            <UserMenu />
          ) : (
            <>
              <Link to="/auth">
                <Button variant="ghost" size="sm">Iniciar sesión</Button>
              </Link>
              <Link to="/auth?mode=signup">
                <Button size="sm" className="gradient-primary">Registrarse</Button>
              </Link>
            </>
          )
        )}
      </div>
    </header>
  );
}
