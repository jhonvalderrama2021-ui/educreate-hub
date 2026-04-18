import { StructuredSlide, SlideTheme } from "@/lib/slide-types";
import { EditableText } from "./EditableText";

interface Props {
  slide: StructuredSlide;
  theme: SlideTheme;
  editable?: boolean;
  onFieldChange?: (path: string, value: any) => void;
}

const CARD_COLORS = ["#3B82F6", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

export function GridLayout({ slide, theme, editable, onFieldChange }: Props) {
  const cards = slide.cards || [];
  const cols = cards.length <= 2 ? cards.length : cards.length <= 4 ? 2 : 3;

  return (
    <div
      className="w-full h-full flex flex-col"
      style={{ padding: "60px 70px", gap: "36px", background: theme.background }}
    >
      <div className="flex items-center" style={{ gap: "16px" }}>
        <div
          className="flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${theme.secondary}, ${theme.accent})`,
            borderRadius: "14px",
            padding: "12px",
          }}
        >
          <span className="material-icons" style={{ color: "white", fontSize: "28px" }}>
            auto_awesome
          </span>
        </div>
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
          }}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: "20px",
          flex: 1,
        }}
      >
        {cards.map((card, i) => {
          const color = card.color || CARD_COLORS[i % CARD_COLORS.length];
          return (
            <div
              key={i}
              style={{
                background: "white",
                borderRadius: "16px",
                padding: "28px",
                boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                border: "1px solid #E2E8F0",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {card.icon && (
                <div
                  style={{
                    background: `${color}15`,
                    borderRadius: "12px",
                    width: "48px",
                    height: "48px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "16px",
                  }}
                >
                  <span className="material-icons" style={{ color, fontSize: "24px" }}>
                    {card.icon}
                  </span>
                </div>
              )}
              <EditableText
                as="h3"
                value={card.title}
                editable={editable}
                onChange={(v) => onFieldChange?.(`cards.${i}.title`, v)}
                placeholder="Título de tarjeta"
                style={{
                  fontFamily: theme.fontHeading,
                  fontSize: "18px",
                  fontWeight: 600,
                  color: theme.text,
                  marginBottom: "8px",
                }}
              />
              <EditableText
                as="p"
                value={card.description}
                editable={editable}
                onChange={(v) => onFieldChange?.(`cards.${i}.description`, v)}
                placeholder="Descripción"
                multiline
                style={{
                  fontFamily: theme.fontBody,
                  fontSize: "14px",
                  color: "#64748B",
                  lineHeight: 1.6,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
