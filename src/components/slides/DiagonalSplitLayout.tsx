import { StructuredSlide, SlideTheme } from "@/lib/slide-types";
import { EditableText } from "./EditableText";

interface Props {
  slide: StructuredSlide;
  theme: SlideTheme;
  editable?: boolean;
  onFieldChange?: (path: string, value: any) => void;
}

/**
 * DIAGONAL SPLIT — image and text split by a sharp diagonal line. Energetic.
 */
export function DiagonalSplitLayout({ slide, theme, editable, onFieldChange }: Props) {
  const imgUrl = slide.image?.url;
  return (
    <div
      className="w-full h-full relative overflow-hidden"
      style={{ background: theme.primary }}
    >
      {/* Image side (left), clipped diagonal */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          clipPath: "polygon(0 0, 60% 0, 40% 100%, 0 100%)",
          background: theme.secondary,
          overflow: "hidden",
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
              background: `linear-gradient(135deg, ${theme.secondary}, ${theme.accent})`,
            }}
          />
        )}
      </div>

      {/* Diagonal line accent */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "60%",
          width: 6,
          height: "115%",
          background: theme.accent,
          transform: "rotate(11deg)",
          transformOrigin: "top left",
        }}
      />

      {/* Text side (right) */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: "55%",
          padding: "70px 70px 70px 90px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          color: "white",
        }}
      >
        <div
          style={{
            fontFamily: theme.fontBody,
            fontSize: "13px",
            fontWeight: 700,
            color: theme.accent,
            letterSpacing: "3px",
            textTransform: "uppercase",
            marginBottom: "16px",
          }}
        >
          Punto clave
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
            color: "white",
            lineHeight: 1.1,
            marginBottom: "20px",
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
            style={{
              fontFamily: theme.fontBody,
              fontSize: "18px",
              color: "rgba(255,255,255,0.85)",
              lineHeight: 1.55,
              marginBottom: "16px",
              display: "block",
            }}
          />
        )}
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
              fontSize: "15px",
              color: "rgba(255,255,255,0.8)",
              lineHeight: 1.65,
              display: "block",
            }}
          />
        )}
      </div>
    </div>
  );
}
