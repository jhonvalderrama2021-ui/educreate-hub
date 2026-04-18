import { StructuredSlide, SlideTheme } from "@/lib/slide-types";
import { EditableText } from "./EditableText";

interface Props {
  slide: StructuredSlide;
  theme: SlideTheme;
  editable?: boolean;
  onFieldChange?: (path: string, value: any) => void;
}

export function ConclusionLayout({ slide, theme, editable, onFieldChange }: Props) {
  return (
    <div
      className="w-full h-full flex items-center justify-center text-center"
      style={{
        background: `linear-gradient(135deg, ${theme.primary}E6 0%, ${theme.accent}CC 100%)`,
        padding: "80px",
      }}
    >
      <div style={{ maxWidth: "800px" }}>
        <span className="material-icons" style={{ fontSize: "56px", color: "rgba(255,255,255,0.8)", marginBottom: "24px", display: "block" }}>
          emoji_objects
        </span>
        <EditableText
          as="h2"
          value={slide.title}
          editable={editable}
          onChange={(v) => onFieldChange?.("title", v)}
          placeholder="Título"
          style={{
            fontFamily: theme.fontHeading,
            fontSize: "44px",
            fontWeight: 700,
            color: "white",
            marginBottom: "20px",
            lineHeight: 1.2,
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
              fontSize: "20px",
              color: "rgba(255,255,255,0.85)",
              lineHeight: 1.6,
              marginBottom: "32px",
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
              color: "rgba(255,255,255,0.7)",
              lineHeight: 1.6,
              display: "block",
            }}
          />
        )}
      </div>
    </div>
  );
}
