import { StructuredSlide, SlideTheme } from "@/lib/slide-types";
import { EditableText } from "./EditableText";

interface Props {
  slide: StructuredSlide;
  theme: SlideTheme;
  editable?: boolean;
  onFieldChange?: (path: string, value: any) => void;
}

const CARD_COLORS = ["#3B82F6", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

/**
 * GRID — magazine-style with image hero on left + numbered cards on right.
 * If no image: bento grid with one big card + smaller ones.
 */
export function GridLayout({ slide, theme, editable, onFieldChange }: Props) {
  const cards = slide.cards || [];
  const imgUrl = slide.image?.url;

  // With image: left image panel + right cards stacked
  if (imgUrl) {
    return (
      <div className="w-full h-full flex" style={{ background: theme.background }}>
        <div style={{ width: "38%", position: "relative", overflow: "hidden" }}>
          <img
            src={imgUrl}
            alt={slide.image?.alt || ""}
            crossOrigin="anonymous"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <div
            style={{
              position: "absolute",
              left: 30,
              bottom: 30,
              right: 30,
              padding: "16px 20px",
              background: "rgba(255,255,255,0.95)",
              borderRadius: "12px",
              borderLeft: `4px solid ${theme.accent}`,
            }}
          >
            <EditableText
              as="h2"
              value={slide.title}
              editable={editable}
              onChange={(v) => onFieldChange?.("title", v)}
              placeholder="Título"
              style={{
                fontFamily: theme.fontHeading,
                fontSize: "26px",
                fontWeight: 700,
                color: theme.text,
                lineHeight: 1.2,
              }}
            />
          </div>
        </div>
        <div
          style={{
            width: "62%",
            padding: "50px 55px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: "16px",
          }}
        >
          {cards.slice(0, 4).map((card, i) => {
            const color = card.color || CARD_COLORS[i % CARD_COLORS.length];
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "18px",
                  padding: "18px 20px",
                  background: "white",
                  borderRadius: "12px",
                  borderLeft: `4px solid ${color}`,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "10px",
                    background: `${color}15`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <span className="material-icons" style={{ color, fontSize: "22px" }}>
                    {card.icon || "star"}
                  </span>
                </div>
                <div style={{ flex: 1 }}>
                  <EditableText
                    as="h3"
                    value={card.title}
                    editable={editable}
                    onChange={(v) => onFieldChange?.(`cards.${i}.title`, v)}
                    placeholder="Título"
                    style={{
                      fontFamily: theme.fontHeading,
                      fontSize: "16px",
                      fontWeight: 700,
                      color: theme.text,
                      marginBottom: "4px",
                      display: "block",
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
                      fontSize: "13px",
                      color: "#475569",
                      lineHeight: 1.55,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Without image: bento grid — first card big, others smaller
  return (
    <div className="w-full h-full flex flex-col" style={{ padding: "50px 60px", background: theme.background }}>
      <EditableText
        as="h2"
        value={slide.title}
        editable={editable}
        onChange={(v) => onFieldChange?.("title", v)}
        placeholder="Título"
        style={{
          fontFamily: theme.fontHeading,
          fontSize: "36px",
          fontWeight: 800,
          color: theme.text,
          marginBottom: "30px",
          display: "block",
        }}
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: cards.length >= 3 ? "1.4fr 1fr" : `repeat(${cards.length}, 1fr)`,
          gridTemplateRows: cards.length >= 3 ? "1fr 1fr" : "1fr",
          gap: "16px",
          flex: 1,
        }}
      >
        {cards.map((card, i) => {
          const color = card.color || CARD_COLORS[i % CARD_COLORS.length];
          const isFirst = i === 0 && cards.length >= 3;
          return (
            <div
              key={i}
              style={{
                gridRow: isFirst ? "span 2" : undefined,
                background: isFirst ? `linear-gradient(135deg, ${color}, ${color}cc)` : "white",
                color: isFirst ? "white" : theme.text,
                borderRadius: "16px",
                padding: "28px",
                boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                display: "flex",
                flexDirection: "column",
                justifyContent: isFirst ? "space-between" : "flex-start",
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "12px",
                  background: isFirst ? "rgba(255,255,255,0.2)" : `${color}15`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "18px",
                }}
              >
                <span
                  className="material-icons"
                  style={{ color: isFirst ? "white" : color, fontSize: "26px" }}
                >
                  {card.icon || "star"}
                </span>
              </div>
              <div>
                <EditableText
                  as="h3"
                  value={card.title}
                  editable={editable}
                  onChange={(v) => onFieldChange?.(`cards.${i}.title`, v)}
                  placeholder="Título"
                  style={{
                    fontFamily: theme.fontHeading,
                    fontSize: isFirst ? "22px" : "17px",
                    fontWeight: 700,
                    color: isFirst ? "white" : theme.text,
                    marginBottom: "8px",
                    display: "block",
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
                    fontSize: isFirst ? "15px" : "13px",
                    color: isFirst ? "rgba(255,255,255,0.92)" : "#64748B",
                    lineHeight: 1.6,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
