import { StructuredSlide, SlideTheme } from "@/lib/slide-types";
import { EditableText } from "./EditableText";

interface Props {
  slide: StructuredSlide;
  theme: SlideTheme;
  editable?: boolean;
  onFieldChange?: (path: string, value: any) => void;
}

export function HeroLayout({ slide, theme, editable, onFieldChange }: Props) {
  return (
    <div
      className="w-full h-full flex items-center justify-center text-center"
      style={{
        background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
        padding: "80px",
      }}
    >
      <div>
        {slide.cards?.[0]?.icon && (
          <div
            className="mx-auto mb-8 flex items-center justify-center"
            style={{
              background: "rgba(255,255,255,0.15)",
              borderRadius: "24px",
              width: "80px",
              height: "80px",
            }}
          >
            <span className="material-icons" style={{ color: "white", fontSize: "48px" }}>
              {slide.cards[0].icon}
            </span>
          </div>
        )}
        <EditableText
          as="h1"
          value={slide.title}
          editable={editable}
          onChange={(v) => onFieldChange?.("title", v)}
          placeholder="Título"
          style={{
            fontFamily: theme.fontHeading,
            fontSize: "52px",
            fontWeight: 700,
            color: "white",
            marginBottom: "16px",
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
              fontSize: "22px",
              color: "rgba(255,255,255,0.85)",
              maxWidth: "700px",
              margin: "0 auto",
              display: "block",
            }}
          />
        )}
      </div>
    </div>
  );
}
