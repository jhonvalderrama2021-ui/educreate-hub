import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { FiltroMultiple, opcionesDe } from "@/components/FiltroMultiple";
import { toast } from "sonner";
import { Search, Coins, Plus, Loader2, History, Download } from "lucide-react";
import { descargarExcel, type ValorCelda } from "@/lib/export-excel";

/**
 * Tokens de generación, desde el panel de administración.
 *
 * Lo que el docente pidió poder hacer: ver cuántos tokens tiene cada persona,
 * cuántos ha usado y **en qué** los usó, y ampliarle el cupo cuando lo pida.
 */

interface Saldo {
  user_id: string;
  nombre: string | null;
  email: string | null;
  rol: string;
  limite_diario: number;
  extra_hoy: number;
  usados_hoy: number;
  disponibles: number;
  usados_semana: number;
  generaciones_semana: number;
}

interface Movimiento {
  id: string;
  tokens: number;
  tipo: string;
  recurso: string | null;
  detalle: string | null;
  created_at: string;
}

const ETIQUETA_TIPO: Record<string, string> = {
  consumo: "Generó",
  devolucion: "Devuelto (falló)",
  regalo: "Ampliación",
  ajuste_limite: "Cambio de límite",
};

export function GestorTokens() {
  const qc = useQueryClient();
  const [busqueda, setBusqueda] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [ampliando, setAmpliando] = useState<Saldo | null>(null);
  const [viendo, setViendo] = useState<Saldo | null>(null);

  const { data: saldos = [], isLoading } = useQuery({
    queryKey: ["admin_saldos_tokens"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_saldos_tokens");
      if (error) throw error;
      return (data || []) as Saldo[];
    },
  });

  const texto = busqueda.toLowerCase();
  const visibles = saldos.filter((s) =>
    (texto === "" ||
      (s.nombre || "").toLowerCase().includes(texto) ||
      (s.email || "").toLowerCase().includes(texto)) &&
    (roles.length === 0 || roles.includes(s.rol)));

  const opcionesRol = useMemo(() => opcionesDe(saldos, (s) => s.rol), [saldos]);
  const sinTokens = visibles.filter((s) => s.disponibles <= 0).length;

  const exportar = async () => {
    const fecha = new Date().toLocaleDateString("es-CO",
      { day: "2-digit", month: "long", year: "numeric" });
    await descargarExcel("Tokens NexProfe", [{
      nombre: "Tokens",
      titulo: "Uso de tokens de generación",
      subtitulo: `${visibles.length} personas · Generado el ${fecha}`,
      columnas: [
        { titulo: "Nombre", ancho: 30 },
        { titulo: "Correo", ancho: 32 },
        { titulo: "Rol", ancho: 13 },
        { titulo: "Límite diario", ancho: 14, alineacion: "right" },
        { titulo: "Usados hoy", ancho: 13, alineacion: "right" },
        { titulo: "Disponibles", ancho: 13, alineacion: "right" },
        { titulo: "Usados esta semana", ancho: 19, alineacion: "right" },
        { titulo: "Generaciones (7 días)", ancho: 20, alineacion: "right" },
      ],
      filas: visibles.map((s) => [
        s.nombre || "", s.email || "", s.rol,
        s.limite_diario, s.usados_hoy, s.disponibles,
        s.usados_semana, s.generaciones_semana,
      ] as ValorCelda[]),
    }]);
    toast.success("Archivo descargado");
  };

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["admin_saldos_tokens"] });
    qc.invalidateQueries({ queryKey: ["tokens"] });
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="p-4 border-b border-border space-y-3">
        <div>
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Coins className="h-4 w-4 text-primary" /> Tokens de generación
          </h2>
          <p className="text-sm text-muted-foreground">
            Cada persona tiene un cupo diario que se recarga a la medianoche.
            No es un cobro: es un tope para que una tarde de pruebas no agote
            la clave de OpenAI de la institución.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              aria-label="Buscar persona"
              placeholder="Buscar por nombre o correo..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9"
            />
          </div>
          <FiltroMultiple etiqueta="Rol" opciones={opcionesRol}
            seleccion={roles} onCambio={setRoles} className="w-[150px]" />
          <Button variant="outline" size="sm" onClick={() => { void exportar(); }}
            disabled={visibles.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Exportar
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          {visibles.length} de {saldos.length}
          {sinTokens > 0 && ` · ${sinTokens} sin tokens ahora mismo`}
        </p>
      </div>

      {isLoading ? (
        <div className="p-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : visibles.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">
          Nadie coincide con los filtros.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {visibles.map((s) => {
            const total = s.limite_diario + s.extra_hoy;
            const agotado = s.disponibles <= 0;
            return (
              <div key={s.user_id} className="flex flex-wrap items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground text-sm truncate">
                    {s.nombre || "Sin nombre"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {s.email} · {s.rol}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Esta semana: {s.usados_semana} tokens en {s.generaciones_semana}{" "}
                    generacion{s.generaciones_semana === 1 ? "" : "es"}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <div className={`font-semibold tabular-nums ${agotado ? "text-destructive" : "text-foreground"}`}>
                    {s.disponibles}
                    <span className="text-xs font-normal text-muted-foreground"> / {total}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {agotado ? "sin tokens hoy" : "disponibles hoy"}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => setViendo(s)}
                    aria-label={`Ver en qué gastó ${s.nombre || s.email}`}>
                    <History className="h-4 w-4 mr-1" /> En qué
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setAmpliando(s)}>
                    <Plus className="h-4 w-4 mr-1" /> Ampliar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {ampliando && (
        <DialogoAmpliar saldo={ampliando} onCerrar={() => setAmpliando(null)} onHecho={refrescar} />
      )}
      {viendo && <DialogoMovimientos saldo={viendo} onCerrar={() => setViendo(null)} />}
    </div>
  );
}

function DialogoAmpliar({ saldo, onCerrar, onHecho }: {
  saldo: Saldo; onCerrar: () => void; onHecho: () => void;
}) {
  const [tokens, setTokens] = useState("200");
  const [motivo, setMotivo] = useState("");
  const [limite, setLimite] = useState(String(saldo.limite_diario));
  const [guardando, setGuardando] = useState(false);

  const ampliarHoy = async () => {
    const n = parseInt(tokens, 10);
    if (Number.isNaN(n) || n <= 0) return toast.error("Escribe cuántos tokens le das");
    setGuardando(true);
    const { error } = await supabase.rpc("admin_regalar_tokens", {
      p_user: saldo.user_id, p_tokens: n, p_motivo: motivo.trim() || undefined,
    });
    setGuardando(false);
    if (error) return toast.error(error.message || "No se pudo ampliar");
    toast.success(`${n} tokens añadidos solo para hoy`);
    onHecho(); onCerrar();
  };

  const cambiarLimite = async () => {
    const n = parseInt(limite, 10);
    if (Number.isNaN(n) || n < 0) return toast.error("El límite debe ser un número");
    setGuardando(true);
    const { error } = await supabase.rpc("admin_cambiar_limite_tokens", {
      p_user: saldo.user_id, p_limite: n,
    });
    setGuardando(false);
    if (error) return toast.error(error.message || "No se pudo cambiar");
    toast.success(`Ahora recibe ${n} tokens cada día`);
    onHecho(); onCerrar();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ampliar tokens</DialogTitle>
          <DialogDescription>
            {saldo.nombre || saldo.email} · le quedan {saldo.disponibles} hoy
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-3 rounded-lg border border-border p-3">
            <div>
              <Label htmlFor="tokens-extra">Darle tokens solo para hoy</Label>
              <p className="text-xs text-muted-foreground">
                Para quien se quedó sin cupo en plena clase. Se pierden con la
                recarga de mañana, que es lo que lo hace excepcional.
              </p>
            </div>
            <div className="flex gap-2">
              <Input id="tokens-extra" className="w-28" inputMode="numeric"
                value={tokens} onChange={(e) => setTokens(e.target.value)} />
              <div className="flex gap-1">
                {[200, 500].map((n) => (
                  <Button key={n} variant="outline" size="sm" onClick={() => setTokens(String(n))}>
                    {n}
                  </Button>
                ))}
              </div>
            </div>
            <Input placeholder="Motivo (opcional)" value={motivo}
              onChange={(e) => setMotivo(e.target.value)} maxLength={200} />
            <Button className="gradient-primary w-full" onClick={ampliarHoy} disabled={guardando}>
              {guardando ? "Guardando..." : "Ampliar solo hoy"}
            </Button>
          </div>

          <div className="space-y-3 rounded-lg border border-border p-3">
            <div>
              <Label htmlFor="limite-diario">Cambiar su cupo de todos los días</Label>
              <p className="text-xs text-muted-foreground">
                Para quien necesita más de forma permanente. Ahora recibe{" "}
                {saldo.limite_diario} al día.
              </p>
            </div>
            <div className="flex gap-2">
              <Input id="limite-diario" className="w-28" inputMode="numeric"
                value={limite} onChange={(e) => setLimite(e.target.value)} />
              <Button variant="outline" onClick={cambiarLimite} disabled={guardando}>
                Cambiar límite
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogoMovimientos({ saldo, onCerrar }: { saldo: Saldo; onCerrar: () => void }) {
  const { data: movimientos = [], isLoading } = useQuery({
    queryKey: ["token_movimientos", saldo.user_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("token_movimientos")
        .select("id, tokens, tipo, recurso, detalle, created_at")
        .eq("user_id", saldo.user_id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as Movimiento[];
    },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>En qué gastó sus tokens</DialogTitle>
          <DialogDescription>
            {saldo.nombre || saldo.email} · últimos 200 movimientos
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : movimientos.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Todavía no ha generado nada.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {movimientos.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">
                      {ETIQUETA_TIPO[m.tipo] || m.tipo}
                      {m.recurso && <span className="text-muted-foreground"> · {m.recurso}</span>}
                    </p>
                    {m.detalle && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{m.detalle}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(m.created_at).toLocaleString("es-CO")}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums shrink-0 ${
                    m.tokens < 0 ? "text-destructive" : m.tokens > 0 ? "text-primary" : "text-muted-foreground"
                  }`}>
                    {m.tokens > 0 ? "+" : ""}{m.tokens}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
