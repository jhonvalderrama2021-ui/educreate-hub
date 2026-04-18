import { StructuredSlide, SlideTheme } from "@/lib/slide-types";
import { EditableText } from "./EditableText";

interface Props {
  slide: StructuredSlide;
  theme: SlideTheme;
  editable?: boolean;
  onFieldChange?: (path: string, value: any) => void;
}

export function BigNumberLayout({ slide, theme, editable, onFieldChange }: Props) {
  return (
    <div
      className="w-full h-full grid"
      style={{
        gridTemplateColumns: "1fr 1fr",
        background: theme.background,
      }}
    >
      {/* Left: gigantic number */}
      <div
        className="flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
          padding: "60px",
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
            fontSize: "200px",
            fontWeight: 800,
            color: "white",
            lineHeight: 1,
            textShadow: "0 4px 24px rgba(0,0,0,0.2)",
          }}
        />
      </div>
      {/* Right: explanation */}
      <div
        className="flex flex-col justify-center"
        style={{ padding: "60px 70px" }}
      >
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
            color: theme.text,
            lineHeight: 1.2,
            marginBottom: "12px",
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
              color: theme.secondary,
              fontWeight: 600,
              marginBottom: "24px",
              display: "block",
            }}
          />
        )}
        <EditableText
          as="p"
          value={slide.content || ""}
          editable={editable}
          onChange={(v) => onFieldChange?.("content", v)}
          placeholder="Explicación detallada"
          multiline
          style={{
            fontFamily: theme.fontBody,
            fontSize: "18px",
            color: "#475569",
            lineHeight: 1.6,
            display: "block",
          }}
        />
      </div>
    </div>
  );
}
