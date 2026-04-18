import { useEffect, useMemo, useState } from "react";
import { format, isSameDay, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Plus, Trash2, StickyNote } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type NoteColor = "primary" | "destructive" | "amber" | "emerald" | "sky";

interface CalendarNote {
  id: string;
  date: string;
  title: string;
  description: string | null;
  color: NoteColor;
}

const COLORS: { value: NoteColor; label: string; dot: string; bg: string; ring: string }[] = [
  { value: "primary", label: "General", dot: "bg-primary", bg: "bg-primary/15", ring: "ring-primary/40" },
  { value: "destructive", label: "Examen / urgente", dot: "bg-destructive", bg: "bg-destructive/15", ring: "ring-destructive/40" },
  { value: "amber", label: "Recordatorio", dot: "bg-amber-500", bg: "bg-amber-500/15", ring: "ring-amber-500/40" },
  { value: "emerald", label: "Tarea / clase", dot: "bg-emerald-500", bg: "bg-emerald-500/15", ring: "ring-emerald-500/40" },
  { value: "sky", label: "Reunión", dot: "bg-sky-500", bg: "bg-sky-500/15", ring: "ring-sky-500/40" },
];

const colorMeta = (c: string) => COLORS.find((x) => x.value === c) ?? COLORS[0];

export function CalendarPopover() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Date>(new Date());
  const [notes, setNotes] = useState<CalendarNote[]>([]);
  const [loading, setLoading] = useState(false);

  // Form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<NoteColor>("primary");
  const [saving, setSaving] = useState(false);

  const today = new Date();

  const fetchNotes = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("calendar_notes")
      .select("id, date, title, description, color")
      .eq("user_id", user.id)
      .order("date", { ascending: true });
    if (error) {
      toast.error("No se pudieron cargar las notas");
    } else {
      setNotes((data as CalendarNote[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open && user) fetchNotes();
  }, [open, user]);

  const notesForSelected = useMemo(
    () => notes.filter((n) => isSameDay(parseISO(n.date), selected)),
    [notes, selected],
  );

  const markedDates = useMemo(() => notes.map((n) => parseISO(n.date)), [notes]);

  const colorByDate = useMemo(() => {
    const map = new Map<string, NoteColor>();
    for (const n of notes) map.set(n.date, n.color);
    return map;
  }, [notes]);

  const handleSave = async () => {
    if (!user) return;
    if (!title.trim()) {
      toast.error("Escribe un título para la nota");
      return;
    }
    setSaving(true);
    const dateStr = format(selected, "yyyy-MM-dd");
    const { error } = await (supabase as any).from("calendar_notes").insert({
      user_id: user.id,
      date: dateStr,
      title: title.trim(),
      description: description.trim() || null,
      color,
    });
    setSaving(false);
    if (error) {
      toast.error("Error al guardar la nota");
      return;
    }
    toast.success("Nota agregada");
    setTitle("");
    setDescription("");
    setColor("primary");
    fetchNotes();
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase as any).from("calendar_notes").delete().eq("id", id);
    if (error) {
      toast.error("Error al eliminar");
      return;
    }
    toast.success("Nota eliminada");
    fetchNotes();
  };

  const todayLabel = format(today, "d MMM", { locale: es });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 h-9 rounded-full border-border/70 hover:border-primary hover:text-primary transition-colors"
          aria-label="Abrir calendario de notas"
        >
          <CalendarIcon className="h-4 w-4" />
          <span className="hidden sm:inline text-xs font-medium capitalize">{todayLabel}</span>
          {notes.length > 0 && (
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[340px] sm:w-[380px] p-0 overflow-hidden"
        sideOffset={8}
      >
        <div className="p-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Calendario de notas</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Marca fechas importantes y agrega notas.
          </p>
        </div>

        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => d && setSelected(d)}
          locale={es}
          modifiers={{ marked: markedDates }}
          modifiersClassNames={{ marked: "calendar-day-marked" }}
          components={{
            DayContent: ({ date }) => {
              const key = format(date, "yyyy-MM-dd");
              const c = colorByDate.get(key);
              return (
                <div className="relative flex items-center justify-center w-full h-full">
                  <span>{date.getDate()}</span>
                  {c && (
                    <span
                      className={cn(
                        "absolute bottom-0.5 h-1 w-1 rounded-full",
                        colorMeta(c).dot,
                      )}
                    />
                  )}
                </div>
              );
            },
          }}
          className={cn("p-3 pointer-events-auto")}
        />

        <div className="border-t border-border p-3 space-y-3 bg-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground capitalize">
              {format(selected, "EEEE d 'de' MMMM yyyy", { locale: es })}
            </p>
            {notesForSelected.length > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {notesForSelected.length} nota{notesForSelected.length === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {notesForSelected.length > 0 && (
            <ScrollArea className="max-h-32">
              <div className="space-y-1.5 pr-2">
                {notesForSelected.map((n) => {
                  const meta = colorMeta(n.color);
                  return (
                    <div
                      key={n.id}
                      className={cn(
                        "rounded-md px-2 py-1.5 ring-1 flex items-start gap-2",
                        meta.bg,
                        meta.ring,
                      )}
                    >
                      <span className={cn("h-2 w-2 rounded-full mt-1.5 shrink-0", meta.dot)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{n.title}</p>
                        {n.description && (
                          <p className="text-[11px] text-muted-foreground line-clamp-2">
                            {n.description}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(n.id)}
                        aria-label="Eliminar nota"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Nueva nota</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Examen final de matemáticas"
                className="h-8 text-xs"
              />
            </div>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalles (opcional)"
              className="text-xs min-h-[52px] resize-none"
            />
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    className={cn(
                      "h-5 w-5 rounded-full transition-transform",
                      c.dot,
                      color === c.value
                        ? "ring-2 ring-offset-2 ring-offset-card ring-foreground/40 scale-110"
                        : "opacity-70 hover:opacity-100",
                    )}
                    aria-label={c.label}
                    title={c.label}
                  />
                ))}
              </div>
              <Button
                size="sm"
                className="h-8 gradient-primary text-xs gap-1"
                onClick={handleSave}
                disabled={saving || !title.trim()}
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar
              </Button>
            </div>
          </div>

          {loading && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <StickyNote className="h-3 w-3" /> Cargando notas...
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
