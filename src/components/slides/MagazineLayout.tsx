import { StructuredSlide, SlideTheme } from "@/lib/slide-types";
import { EditableText } from "./EditableText";

interface Props {
  slide: StructuredSlide;
  theme: SlideTheme;
  editable?: boolean;
  onFieldChange?: (path: string, value: any) => void;
}

/**
 * MAGAZINE — editorial layout: vertical sidebar with image + drop-cap article on right.
 * Uses listItems if available, else content.
 */
export function MagazineLayout({ slide, theme, editable, onFieldChange }: Props) {
  const imgUrl = slide.image?.url;
  const items = slide.listItems || [];

  return (
    <div className="w-full h-full flex" style={{ background: theme.background }}>
      {/* Left vertical image */}
      <div style={{ width: "32%", position: "relative", overflow: "hidden", background: theme.primary }}>
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={slide.image?.alt || ""}
            crossOrigin="anonymous"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: `linear-gradient(180deg, ${theme.primary}, ${theme.secondary})`,
            }}
          />
        )}
        {/* Vertical title overlay */}
        <div
          style={{
            position: "absolute",
            left: 24,
            bottom: 30,
            color: "white",
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            fontFamily: theme.fontHeading,
            fontSize: "13px",
            letterSpacing: "4px",
            textTransform: "uppercase",
            fontWeight: 600,
            opacity: 0.9,
          }}
        >
          Sección
        </div>
      </div>

      {/* Right article */}
      <div
        style={{
          width: "68%",
          padding: "60px 70px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontFamily: theme.fontBody,
            fontSize: "12px",
            fontWeight: 700,
            color: theme.accent,
            letterSpacing: "3px",
            textTransform: "uppercase",
            marginBottom: "14px",
          }}
        >
          Análisis
        </div>
        <EditableText
          as="h2"
          value={slide.title}
          editable={editable}
          onChange={(v) => onFieldChange?.("title", v)}
          placeholder="Título"
          style={{
            fontFamily: theme.fontHeading,
            fontSize: "44px",
            fontWeight: 800,
            color: theme.text,
            lineHeight: 1.1,
            marginBottom: "26px",
            display: "block",
          }}
        />
        <div style={{ height: 1, background: "#CBD5E1", marginBottom: "26px" }} />

        {items.length > 0 ? (
          <div style={{ columnCount: 2, columnGap: "40px" }}>
            {items.map((item, i) => (
              <div key={i} style={{ breakInside: "avoid", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span className="material-icons" style={{ color: theme.secondary, fontSize: "18px" }}>
                    {item.icon || "circle"}
                  </span>
                  <EditableText
                    as="strong"
                    value={item.title}
                    editable={editable}
                    onChange={(v) => onFieldChange?.(`listItems.${i}.title`, v)}
                    placeholder="Título"
                    style={{
                      fontFamily: theme.fontHeading,
                      fontSize: "15px",
                      fontWeight: 700,
                      color: theme.text,
                    }}
                  />
                </div>
                <EditableText
                  as="p"
                  value={item.description}
                  editable={editable}
                  onChange={(v) => onFieldChange?.(`listItems.${i}.description`, v)}
                  placeholder="Descripción"
                  multiline
                  style={{
                    fontFamily: theme.fontBody,
                    fontSize: "13px",
                    color: "#64748B",
                    lineHeight: 1.55,
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            {/* Drop cap */}
            {slide.content && (
              <span
                style={{
                  fontFamily: theme.fontHeading,
                  fontSize: "82px",
                  fontWeight: 800,
                  color: theme.accent,
                  float: "left",
                  lineHeight: 0.85,
                  marginRight: "12px",
                  marginTop: "4px",
                }}
              >
                {slide.content.charAt(0)}
              </span>
            )}
            <EditableText
              as="p"
              value={slide.content?.slice(1) || ""}
              editable={editable}
              onChange={(v) => onFieldChange?.("content", (slide.content?.charAt(0) || "") + v)}
              placeholder="Contenido"
              multiline
              style={{
                fontFamily: theme.fontBody,
                fontSize: "16px",
                color: "#475569",
                lineHeight: 1.7,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
