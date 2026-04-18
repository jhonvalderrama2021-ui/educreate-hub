import { StructuredSlide, SlideTheme } from "@/lib/slide-types";
import { EditableText } from "./EditableText";

interface Props {
  slide: StructuredSlide;
  theme: SlideTheme;
  editable?: boolean;
  onFieldChange?: (path: string, value: any) => void;
}

const STAT_COLORS = ["#3B82F6", "#6366F1", "#22C55E", "#F59E0B"];

export function StatsLayout({ slide, theme, editable, onFieldChange }: Props) {
  const stats = slide.stats || [];
  const cols = stats.length <= 3 ? stats.length : Math.min(4, stats.length);

  return (
    <div
      className="w-full h-full flex flex-col"
      style={{ padding: "60px 70px", gap: "40px", background: theme.background }}
    >
      <EditableText
        as="h2"
        value={slide.title}
        editable={editable}
        onChange={(v) => onFieldChange?.("title", v)}
        placeholder="Título"
        style={{
          fontFamily: theme.fontHeading,
          fontSize: "36px",
          fontWeight: 700,
          color: theme.text,
          textAlign: "center",
          display: "block",
        }}
      />
      {(slide.subtitle || editable) && (
        <EditableText
          as="p"
          value={slide.subtitle || ""}
          editable={editable}
          onChange={(v) => onFieldChange?.("subtitle", v)}
          placeholder="Subtítulo"
          multiline
          style={{ fontFamily: theme.fontBody, fontSize: "18px", color: "#64748B", textAlign: "center", marginTop: "-24px", display: "block" }}
        />
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: "24px",
          flex: 1,
          alignItems: "center",
        }}
      >
        {stats.map((stat, i) => {
          const color = stat.color || STAT_COLORS[i % STAT_COLORS.length];
          return (
            <div
              key={i}
              style={{
                textAlign: "center",
                background: "white",
                borderRadius: "16px",
                padding: "40px 24px",
                boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
              }}
            >
              <EditableText
                as="div"
                value={stat.value}
                editable={editable}
                onChange={(v) => onFieldChange?.(`stats.${i}.value`, v)}
                placeholder="Valor"
                style={{
                  fontFamily: theme.fontHeading,
                  fontSize: "56px",
                  fontWeight: 700,
                  color,
                }}
              />
              <EditableText
                as="p"
                value={stat.label}
                editable={editable}
                onChange={(v) => onFieldChange?.(`stats.${i}.label`, v)}
                placeholder="Etiqueta"
                multiline
                style={{ fontFamily: theme.fontBody, fontSize: "16px", color: "#64748B", marginTop: "8px", display: "block" }}
              />
              {(stat.source || editable) && (
                <EditableText
                  as="p"
                  value={stat.source ? `Fuente: ${stat.source}` : ""}
                  editable={editable}
                  onChange={(v) => onFieldChange?.(`stats.${i}.source`, v.replace(/^Fuente:\s*/i, ""))}
                  placeholder="Fuente: ..."
                  style={{
                    fontFamily: theme.fontBody,
                    fontSize: "12px",
                    color: "#94A3B8",
                    fontStyle: "italic",
                    marginTop: "12px",
                    display: "block",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
