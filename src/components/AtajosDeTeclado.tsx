import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ATAJOS, DESTINOS, estaEscribiendo, tieneModificador } from "@/lib/atajos";

/**
 * Escucha los atajos de teclado y muestra la lista cuando se pulsa "?".
 *
 * Se monta una sola vez, en el armazon de la plataforma, para que los atajos
 * valgan en todas las pantallas sin repetir el listener.
 */
export function AtajosDeTeclado() {
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(false);
  /** Si la tecla anterior fue "g", para completar la secuencia "ir a". */
  const esperandoDestino = useRef(false);
  const temporizador = useRef<number>();

  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (tieneModificador(e) || estaEscribiendo(e.target)) return;

      // Segunda tecla de "g" + letra.
      if (esperandoDestino.current) {
        esperandoDestino.current = false;
        window.clearTimeout(temporizador.current);
        const destino = DESTINOS[e.key.toLowerCase()];
        if (destino) {
          e.preventDefault();
          navigate(destino);
        }
        return;
      }

      if (e.key === "?") {
        e.preventDefault();
        setAbierto(true);
        return;
      }

      if (e.key === "/") {
        // Lleva el foco al buscador de la pantalla, si lo tiene.
        const buscador = document.querySelector<HTMLInputElement>('input[type="search"]');
        if (buscador) {
          e.preventDefault();
          buscador.focus();
          buscador.select();
        }
        return;
      }

      if (e.key.toLowerCase() === "g") {
        esperandoDestino.current = true;
        // La secuencia caduca: si pasa un segundo sin segunda tecla, la "g"
        // deja de estar pendiente y no se dispara una navegación inesperada.
        window.clearTimeout(temporizador.current);
        temporizador.current = window.setTimeout(() => { esperandoDestino.current = false; }, 1000);
      }
    };

    window.addEventListener("keydown", alPulsar);
    return () => {
      window.removeEventListener("keydown", alPulsar);
      window.clearTimeout(temporizador.current);
    };
  }, [navigate]);

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Atajos de teclado</DialogTitle>
          <DialogDescription>
            Funcionan en cualquier pantalla, salvo mientras escribes en un campo.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2">
          {ATAJOS.map((a) => (
            <li key={a.teclas.join("+")} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">{a.descripcion}</span>
              <span className="flex items-center gap-1 shrink-0">
                {a.teclas.map((t, i) => (
                  <kbd
                    key={i}
                    className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground"
                  >
                    {t}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Las secuencias de dos teclas se pulsan una después de otra, no a la vez.
        </p>
      </DialogContent>
    </Dialog>
  );
}
