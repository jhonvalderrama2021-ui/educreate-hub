import { StructuredSlide, SlideTheme } from "@/lib/slide-types";
import { EditableText } from "./EditableText";

interface Props {
  slide: StructuredSlide;
  theme: SlideTheme;
  editable?: boolean;
  onFieldChange?: (path: string, value: any) => void;
}

export function QuoteLayout({ slide, theme, editable, onFieldChange }: Props) {
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center text-center"
      style={{
        background: `linear-gradient(160deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
        padding: "80px 120px",
      }}
    >
      <span
        className="material-icons"
        style={{ color: "rgba(255,255,255,0.35)", fontSize: "96px", lineHeight: 1 }}
      >
        format_quote
      </span>
      <EditableText
        as="p"
        value={slide.content || ""}
        editable={editable}
        onChange={(v) => onFieldChange?.("content", v)}
        placeholder="Cita destacada"
        multiline
        style={{
          fontFamily: theme.fontHeading,
          fontSize: "44px",
          fontWeight: 600,
          color: "white",
          lineHeight: 1.3,
          marginTop: "16px",
          marginBottom: "32px",
          maxWidth: "1000px",
          display: "block",
        }}
      />
      <div
        style={{
          width: "60px",
          height: "3px",
          background: "rgba(255,255,255,0.6)",
          marginBottom: "20px",
        }}
      />
      <EditableText
        as="p"
        value={slide.subtitle || ""}
        editable={editable}
        onChange={(v) => onFieldChange?.("subtitle", v)}
        placeholder="Autor o contexto"
        style={{
          fontFamily: theme.fontBody,
          fontSize: "20px",
          color: "rgba(255,255,255,0.85)",
          fontStyle: "italic",
          display: "block",
        }}
      />
    </div>
  );
}
