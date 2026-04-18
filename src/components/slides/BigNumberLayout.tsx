import { StructuredSlide, SlideTheme } from "@/lib/slide-types";
import { EditableText } from "./EditableText";

interface Props {
  slide: StructuredSlide;
  theme: SlideTheme;
  editable?: boolean;
  onFieldChange?: (path: string, value: any) => void;
}

/**
 * BIG NUMBER — dramatic centered number on color block, with optional image
 * faded on the side. Diagonal accent stripe for visual rhythm.
 */
export function BigNumberLayout({ slide, theme, editable, onFieldChange }: Props) {
  const imgUrl = slide.image?.url;

  return (
    <div
      className="w-full h-full relative overflow-hidden"
      style={{ background: theme.primary }}
    >
      {/* Faded background image */}
      {imgUrl && (
        <img
          src={imgUrl}
          alt=""
          crossOrigin="anonymous"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.18,
          }}
        />
      )}
      {/* Diagonal accent stripe */}
      <div
        style={{
          position: "absolute",
          top: -100,
          right: -100,
          width: 500,
          height: 500,
          background: `${theme.accent}25`,
          transform: "rotate(35deg)",
          borderRadius: 40,
        }}
      />

      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          padding: "60px 80px",
          display: "grid",
          gridTemplateRows: "auto 1fr auto",
          color: "white",
        }}
      >
        {/* Top: small label */}
        <div
          style={{
            fontFamily: theme.fontBody,
            fontSize: "13px",
            fontWeight: 600,
            letterSpacing: "2px",
            textTransform: "uppercase",
            color: theme.accent,
          }}
        >
          Dato clave
        </div>

        {/* Center: gigantic number + title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "flex-start",
          }}
        >
          <EditableText
            as="div"
            value={slide.bigNumber || "0"}
            editable={editable}
            onChange={(v) => onFieldChange?.("bigNumber", v)}
            placeholder="42%"
            style={{
              fontFamily: theme.fontHeading,
              fontSize: "240px",
              fontWeight: 900,
              color: "white",
              lineHeight: 0.9,
              letterSpacing: "-6px",
              marginBottom: "20px",
              textShadow: "0 4px 30px rgba(0,0,0,0.3)",
              display: "block",
            }}
          />
          <EditableText
            as="h2"
            value={slide.title}
            editable={editable}
            onChange={(v) => onFieldChange?.("title", v)}
            placeholder="Título"
            style={{
              fontFamily: theme.fontHeading,
              fontSize: "32px",
              fontWeight: 700,
              color: "white",
              lineHeight: 1.2,
              marginBottom: "12px",
              maxWidth: "780px",
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
                color: theme.accent,
                fontWeight: 600,
                maxWidth: "780px",
                display: "block",
              }}
            />
          )}
        </div>

        {/* Bottom: explanation */}
        {(slide.content || editable) && (
          <EditableText
            as="p"
            value={slide.content || ""}
            editable={editable}
            onChange={(v) => onFieldChange?.("content", v)}
            placeholder="Explicación detallada"
            multiline
            style={{
              fontFamily: theme.fontBody,
              fontSize: "16px",
              color: "rgba(255,255,255,0.85)",
              lineHeight: 1.6,
              maxWidth: "820px",
              borderLeft: `3px solid ${theme.accent}`,
              paddingLeft: "20px",
              display: "block",
            }}
          />
        )}
      </div>
    </div>
  );
}
