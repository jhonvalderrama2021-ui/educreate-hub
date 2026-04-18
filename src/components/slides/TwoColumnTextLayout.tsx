import { StructuredSlide, SlideTheme } from "@/lib/slide-types";
import { EditableText } from "./EditableText";

interface Props {
  slide: StructuredSlide;
  theme: SlideTheme;
  editable?: boolean;
  onFieldChange?: (path: string, value: any) => void;
}

export function TwoColumnTextLayout({ slide, theme, editable, onFieldChange }: Props) {
  const cols = slide.columns || [];
  return (
    <div
      className="w-full h-full flex flex-col"
      style={{ background: theme.background, padding: "60px 70px", gap: "40px" }}
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
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "40px",
          flex: 1,
        }}
      >
        {cols.slice(0, 2).map((col, i) => {
          const accent = col.color || (i === 0 ? theme.secondary : theme.accent);
          return (
            <div
              key={i}
              style={{
                background: "white",
                borderTop: `6px solid ${accent}`,
                borderRadius: "12px",
                padding: "32px",
                boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <EditableText
                as="h3"
                value={col.title}
                editable={editable}
                onChange={(v) => onFieldChange?.(`columns.${i}.title`, v)}
                placeholder="Título columna"
                style={{
                  fontFamily: theme.fontHeading,
                  fontSize: "24px",
                  fontWeight: 700,
                  color: accent,
                  display: "block",
                }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {col.points.map((pt, j) => (
                  <EditableText
                    key={j}
                    as="p"
                    value={pt}
                    editable={editable}
                    onChange={(v) => onFieldChange?.(`columns.${i}.points.${j}`, v)}
                    placeholder="Punto"
                    multiline
                    style={{
                      fontFamily: theme.fontBody,
                      fontSize: "16px",
                      color: theme.text,
                      lineHeight: 1.55,
                      display: "block",
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
