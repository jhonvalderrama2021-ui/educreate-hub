import { StructuredSlide, SlideTheme } from "@/lib/slide-types";
import { EditableText } from "./EditableText";

interface Props {
  slide: StructuredSlide;
  theme: SlideTheme;
  editable?: boolean;
  onFieldChange?: (path: string, value: any) => void;
}

/**
 * CIRCLE HERO — circular image right + minimal text left, with concentric ring decoration.
 * Used as an alternate hero/section divider.
 */
export function CircleHeroLayout({ slide, theme, editable, onFieldChange }: Props) {
  const imgUrl = slide.image?.url;
  return (
    <div
      className="w-full h-full relative overflow-hidden"
      style={{ background: theme.background }}
    >
      {/* Decorative dotted background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `radial-gradient(${theme.secondary}25 1.5px, transparent 1.5px)`,
          backgroundSize: "24px 24px",
          opacity: 0.5,
        }}
      />

      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          alignItems: "center",
          padding: "40px 60px",
        }}
      >
        {/* Left text */}
        <div style={{ paddingRight: "40px" }}>
          <div
            style={{
              fontFamily: theme.fontBody,
              fontSize: "13px",
              fontWeight: 700,
              color: theme.accent,
              letterSpacing: "3px",
              textTransform: "uppercase",
              marginBottom: "18px",
            }}
          >
            Capítulo
          </div>
          <EditableText
            as="h1"
            value={slide.title}
            editable={editable}
            onChange={(v) => onFieldChange?.("title", v)}
            placeholder="Título"
            style={{
              fontFamily: theme.fontHeading,
              fontSize: "56px",
              fontWeight: 800,
              color: theme.text,
              lineHeight: 1.05,
              marginBottom: "22px",
              display: "block",
            }}
          />
          <div style={{ width: 60, height: 4, background: theme.accent, marginBottom: 22 }} />
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
                fontSize: "19px",
                color: "#475569",
                lineHeight: 1.5,
                display: "block",
              }}
            />
          )}
        </div>

        {/* Right circular image */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Outer ring */}
          <div
            style={{
              position: "absolute",
              width: 540,
              height: 540,
              borderRadius: "50%",
              border: `2px solid ${theme.secondary}40`,
            }}
          />
          {/* Mid ring */}
          <div
            style={{
              position: "absolute",
              width: 480,
              height: 480,
              borderRadius: "50%",
              background: `${theme.accent}10`,
            }}
          />
          {/* Image circle */}
          <div
            style={{
              width: 420,
              height: 420,
              borderRadius: "50%",
              overflow: "hidden",
              background: `linear-gradient(135deg, ${theme.secondary}, ${theme.accent})`,
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              border: `8px solid ${theme.background}`,
            }}
          >
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
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span className="material-icons" style={{ fontSize: "120px", color: "rgba(255,255,255,0.6)" }}>
                  auto_awesome
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
