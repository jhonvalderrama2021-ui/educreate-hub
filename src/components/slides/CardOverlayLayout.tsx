import { StructuredSlide, SlideTheme } from "@/lib/slide-types";
import { EditableText } from "./EditableText";

interface Props {
  slide: StructuredSlide;
  theme: SlideTheme;
  editable?: boolean;
  onFieldChange?: (path: string, value: any) => void;
}

/**
 * CARD OVERLAY — full-bleed image with a floating glass card containing
 * the title and content. Magazine cover energy.
 */
export function CardOverlayLayout({ slide, theme, editable, onFieldChange }: Props) {
  const imgUrl = slide.image?.url;
  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: theme.primary }}>
      {imgUrl ? (
        <img
          src={imgUrl}
          alt={slide.image?.alt || ""}
          crossOrigin="anonymous"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.4) 100%)",
        }}
      />
      {/* Floating card */}
      <div
        style={{
          position: "absolute",
          left: 60,
          bottom: 60,
          right: 60,
          maxWidth: 720,
          background: "rgba(255,255,255,0.97)",
          padding: "40px 44px",
          borderRadius: "20px",
          borderLeft: `6px solid ${theme.accent}`,
          boxShadow: "0 30px 80px rgba(0,0,0,0.4)",
        }}
      >
        <div
          style={{
            fontFamily: theme.fontBody,
            fontSize: "12px",
            fontWeight: 700,
            color: theme.accent,
            letterSpacing: "2px",
            textTransform: "uppercase",
            marginBottom: "10px",
          }}
        >
          Concepto destacado
        </div>
        <EditableText
          as="h2"
          value={slide.title}
          editable={editable}
          onChange={(v) => onFieldChange?.("title", v)}
          placeholder="Título"
          style={{
            fontFamily: theme.fontHeading,
            fontSize: "38px",
            fontWeight: 800,
            color: theme.text,
            lineHeight: 1.15,
            marginBottom: "14px",
            display: "block",
          }}
        />
        {(slide.content || editable) && (
          <EditableText
            as="p"
            value={slide.content || ""}
            editable={editable}
            onChange={(v) => onFieldChange?.("content", v)}
            placeholder="Contenido"
            multiline
            style={{
              fontFamily: theme.fontBody,
              fontSize: "16px",
              color: "#475569",
              lineHeight: 1.65,
              display: "block",
            }}
          />
        )}
      </div>
    </div>
  );
}
