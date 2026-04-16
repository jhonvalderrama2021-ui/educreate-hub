import { StructuredSlide, SlideTheme } from "@/lib/slide-types";

interface Props {
  slide: StructuredSlide;
  theme: SlideTheme;
}

export function SplitLayout({ slide, theme }: Props) {
  const imgRight = !slide.image?.placement || slide.image.placement === "right";

  const textBlock = (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "60px" }}>
      <h2
        style={{
          fontFamily: theme.fontHeading,
          fontSize: "36px",
          fontWeight: 700,
          color: theme.text,
          marginBottom: "20px",
          lineHeight: 1.2,
        }}
      >
        {slide.title}
      </h2>
      {slide.subtitle && (
        <p style={{ fontFamily: theme.fontBody, fontSize: "18px", color: "#64748B", marginBottom: "24px", lineHeight: 1.6 }}>
          {slide.subtitle}
        </p>
      )}
      {slide.content && (
        <p style={{ fontFamily: theme.fontBody, fontSize: "16px", color: "#475569", lineHeight: 1.7 }}>
          {slide.content}
        </p>
      )}
      {slide.listItems && slide.listItems.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {slide.listItems.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
              <span className="material-icons" style={{ color: theme.secondary, fontSize: "20px", marginTop: "2px" }}>
                {item.icon || "check_circle"}
              </span>
              <div>
                <strong style={{ fontFamily: theme.fontBody, fontSize: "15px", color: theme.text }}>{item.title}</strong>
                {item.description && (
                  <p style={{ fontFamily: theme.fontBody, fontSize: "13px", color: "#64748B", marginTop: "2px" }}>
                    {item.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const imageBlock = (
    <div
      style={{
        flex: 1,
        position: "relative",
        overflow: "hidden",
      }}
    >
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
