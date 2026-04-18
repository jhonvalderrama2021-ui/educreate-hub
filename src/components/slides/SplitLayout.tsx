import { StructuredSlide, SlideTheme } from "@/lib/slide-types";
import { EditableText } from "./EditableText";

interface Props {
  slide: StructuredSlide;
  theme: SlideTheme;
  editable?: boolean;
  onFieldChange?: (path: string, value: any) => void;
}

export function SplitLayout({ slide, theme, editable, onFieldChange }: Props) {
  const imgRight = !slide.image?.placement || slide.image.placement === "right";

  const textBlock = (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "60px" }}>
      <EditableText
        as="h2"
        value={slide.title}
        editable={editable}
        onChange={(v) => onFieldChange?.("title", v)}
        placeholder="Título"
        style={{
          fontFamily: theme.fontHeading,
          fontSize: "36px",
          fontWeight: 700,
          color: theme.text,
          marginBottom: "20px",
          lineHeight: 1.2,
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
          style={{ fontFamily: theme.fontBody, fontSize: "18px", color: "#64748B", marginBottom: "24px", lineHeight: 1.6 }}
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
          style={{ fontFamily: theme.fontBody, fontSize: "16px", color: "#475569", lineHeight: 1.7 }}
        />
      )}
      {slide.listItems && slide.listItems.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
          {slide.listItems.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
              <span className="material-icons" style={{ color: theme.secondary, fontSize: "20px", marginTop: "2px" }}>
                {item.icon || "check_circle"}
              </span>
              <div style={{ flex: 1 }}>
                <EditableText
                  as="strong"
                  value={item.title}
                  editable={editable}
                  onChange={(v) => onFieldChange?.(`listItems.${i}.title`, v)}
                  placeholder="Título"
                  style={{ fontFamily: theme.fontBody, fontSize: "15px", color: theme.text, display: "block" }}
                />
                {(item.description || editable) && (
                  <EditableText
                    as="p"
                    value={item.description || ""}
                    editable={editable}
                    onChange={(v) => onFieldChange?.(`listItems.${i}.description`, v)}
                    placeholder="Descripción"
                    multiline
                    style={{ fontFamily: theme.fontBody, fontSize: "13px", color: "#64748B", marginTop: "2px" }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const imageBlock = (
    <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
      {slide.image?.url ? (
        <img
          src={slide.image.url}
          alt={slide.image.alt}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          crossOrigin="anonymous"
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: `linear-gradient(135deg, ${theme.secondary}30, ${theme.accent}30)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span className="material-icons" style={{ fontSize: "80px", color: `${theme.secondary}60` }}>
            image
          </span>
        </div>
      )}
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
