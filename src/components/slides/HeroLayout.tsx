import { StructuredSlide, SlideTheme } from "@/lib/slide-types";
import { EditableText } from "./EditableText";

interface Props {
  slide: StructuredSlide;
  theme: SlideTheme;
  editable?: boolean;
  onFieldChange?: (path: string, value: any) => void;
}

/**
 * HERO — asymmetric: large image LEFT, dark color block RIGHT with title.
 * Decorative concentric circles in the corner for visual interest.
 */
export function HeroLayout({ slide, theme, editable, onFieldChange }: Props) {
  const imgUrl = slide.image?.url;

  return (
    <div className="w-full h-full flex" style={{ background: theme.primary }}>
      {/* LEFT — image or color block (55%) */}
      <div style={{ width: "55%", position: "relative", overflow: "hidden", background: theme.secondary }}>
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={slide.image?.alt || slide.title}
            crossOrigin="anonymous"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: `linear-gradient(135deg, ${theme.secondary}, ${theme.accent})`,
            }}
          />
        )}
        {/* dark gradient at bottom for cohesion */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(90deg, transparent 0%, transparent 60%, ${theme.primary} 100%)`,
          }}
        />
      </div>

      {/* RIGHT — title block (45%) */}
      <div
        style={{
          width: "45%",
          position: "relative",
          padding: "70px 60px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: theme.primary,
          overflow: "hidden",
        }}
      >
        {/* Decorative concentric circles top-right */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -120,
            width: 280,
            height: 280,
            borderRadius: "50%",
            border: `2px solid ${theme.accent}40`,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: -60,
            right: -60,
            width: 160,
            height: 160,
            borderRadius: "50%",
            background: `${theme.accent}20`,
          }}
        />

        <div
          style={{
            display: "inline-block",
            padding: "6px 14px",
            borderRadius: "20px",
            background: `${theme.accent}30`,
            color: "white",
            fontFamily: theme.fontBody,
            fontSize: "13px",
            fontWeight: 600,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            marginBottom: "24px",
            width: "fit-content",
            position: "relative",
            zIndex: 2,
          }}
        >
          Presentación
        </div>

        <EditableText
          as="h1"
          value={slide.title}
          editable={editable}
          onChange={(v) => onFieldChange?.("title", v)}
          placeholder="Título"
          style={{
            fontFamily: theme.fontHeading,
            fontSize: "54px",
            fontWeight: 800,
            color: "white",
            lineHeight: 1.05,
            marginBottom: "20px",
            display: "block",
            position: "relative",
            zIndex: 2,
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
            style={{
              fontFamily: theme.fontBody,
              fontSize: "20px",
              color: "rgba(255,255,255,0.8)",
              lineHeight: 1.5,
              display: "block",
              position: "relative",
              zIndex: 2,
            }}
          />
        )}

        {/* Bottom accent line */}
        <div
          style={{
            position: "absolute",
            left: 60,
            bottom: 60,
            width: 60,
            height: 4,
            background: theme.accent,
            borderRadius: 2,
          }}
        />
      </div>
    </div>
  );
}
