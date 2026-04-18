import { StructuredSlide, SlideTheme } from "@/lib/slide-types";
import { EditableText } from "./EditableText";

interface Props {
  slide: StructuredSlide;
  theme: SlideTheme;
  editable?: boolean;
  onFieldChange?: (path: string, value: any) => void;
}

export function ImageFullLayout({ slide, theme, editable, onFieldChange }: Props) {
  const imgUrl = slide.image?.url;
  return (
    <div
      className="w-full h-full relative"
      style={{ background: theme.primary, overflow: "hidden" }}
    >
      {imgUrl && (
        <img
          src={imgUrl}
          alt={slide.image?.alt || slide.title}
          crossOrigin="anonymous"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      )}
      {/* Dark gradient overlay for legibility */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.2) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "60px 80px",
          color: "white",
        }}
      >
        <EditableText
          as="h1"
          value={slide.title}
          editable={editable}
          onChange={(v) => onFieldChange?.("title", v)}
          placeholder="Título"
          style={{
            fontFamily: theme.fontHeading,
            fontSize: "56px",
            fontWeight: 700,
            color: "white",
            lineHeight: 1.15,
            marginBottom: "16px",
            textShadow: "0 2px 16px rgba(0,0,0,0.4)",
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
              fontSize: "22px",
              color: "rgba(255,255,255,0.95)",
              maxWidth: "900px",
              textShadow: "0 1px 8px rgba(0,0,0,0.4)",
              display: "block",
            }}
          />
        )}
      </div>
    </div>
  );
}
