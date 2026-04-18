import { StructuredSlide, SlideTheme } from "@/lib/slide-types";
import { EditableText } from "./EditableText";

interface Props {
  slide: StructuredSlide;
  theme: SlideTheme;
  editable?: boolean;
  onFieldChange?: (path: string, value: any) => void;
}

/**
 * SPLIT — text + image with rounded asymmetric image frame and number badge.
 */
export function SplitLayout({ slide, theme, editable, onFieldChange }: Props) {
  const imgRight = !slide.image?.placement || slide.image.placement === "right";
  const slideNum = slide.slideNumber;

  const textBlock = (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "60px 70px",
        background: theme.background,
        position: "relative",
      }}
    >
      {slideNum && (
        <div
          style={{
            fontFamily: theme.fontHeading,
            fontSize: "14px",
            fontWeight: 700,
            color: theme.secondary,
            letterSpacing: "2px",
            marginBottom: "10px",
          }}
        >
          {String(slideNum).padStart(2, "0")} —
        </div>
      )}
      <EditableText
        as="h2"
        value={slide.title}
        editable={editable}
        onChange={(v) => onFieldChange?.("title", v)}
        placeholder="Título"
        style={{
          fontFamily: theme.fontHeading,
          fontSize: "40px",
          fontWeight: 800,
          color: theme.text,
          marginBottom: "20px",
          lineHeight: 1.15,
          display: "block",
        }}
      />
      <div
        style={{
          width: 50,
          height: 4,
          background: theme.accent,
          borderRadius: 2,
          marginBottom: "24px",
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
            color: theme.secondary,
            fontWeight: 600,
            marginBottom: "20px",
            lineHeight: 1.5,
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
            fontSize: "16px",
            color: "#475569",
            lineHeight: 1.7,
            display: "block",
          }}
        />
      )}
    </div>
  );

  const imageBlock = (
    <div
      style={{
        flex: 1,
        position: "relative",
        background: theme.primary,
        padding: "30px",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "20px",
          overflow: "hidden",
          background: `linear-gradient(135deg, ${theme.secondary}, ${theme.accent})`,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        }}
      >
        {slide.image?.url ? (
          <img
            src={slide.image.url}
            alt={slide.image.alt}
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
            <span className="material-icons" style={{ fontSize: "100px", color: "rgba(255,255,255,0.5)" }}>
              image
            </span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="w-full h-full flex" style={{ background: theme.background }}>
      {imgRight ? (
        <>
          {textBlock}
          {imageBlock}
        </>
      ) : (
        <>
          {imageBlock}
          {textBlock}
        </>
      )}
    </div>
  );
}
