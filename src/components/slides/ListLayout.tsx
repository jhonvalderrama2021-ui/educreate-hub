import { StructuredSlide, SlideTheme } from "@/lib/slide-types";

interface Props {
  slide: StructuredSlide;
  theme: SlideTheme;
}

export function ListLayout({ slide, theme }: Props) {
  const items = slide.listItems || [];

  return (
    <div
      className="w-full h-full flex flex-col"
      style={{ padding: "60px 70px", gap: "32px", background: theme.background }}
    >
      <h2
        style={{
          fontFamily: theme.fontHeading,
          fontSize: "36px",
          fontWeight: 700,
          color: theme.text,
        }}
      >
        {slide.title}
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px", flex: 1 }}>
        {items.map((item, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "20px",
              background: "white",
              borderRadius: "14px",
              padding: "20px 24px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              border: "1px solid #E2E8F0",
            }}
          >
            <div
              style={{
                background: `${theme.secondary}15`,
                borderRadius: "12px",
                width: "52px",
                height: "52px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span className="material-icons" style={{ color: theme.secondary, fontSize: "26px" }}>
                {item.icon || "star"}
              </span>
            </div>
            <div>
              <h3
                style={{
                  fontFamily: theme.fontHeading,
                  fontSize: "17px",
                  fontWeight: 600,
                  color: theme.text,
                  marginBottom: "4px",
                }}
              >
                {item.title}
              </h3>
              <p style={{ fontFamily: theme.fontBody, fontSize: "14px", color: "#64748B", lineHeight: 1.5 }}>
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
