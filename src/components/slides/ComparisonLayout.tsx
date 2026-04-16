import { StructuredSlide, SlideTheme } from "@/lib/slide-types";

interface Props {
  slide: StructuredSlide;
  theme: SlideTheme;
}

export function ComparisonLayout({ slide, theme }: Props) {
  const columns = slide.columns || [];

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
          textAlign: "center",
        }}
      >
        {slide.title}
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns.length || 2}, 1fr)`,
          gap: "24px",
          flex: 1,
        }}
      >
        {columns.map((col, i) => {
          const color = col.color || (i === 0 ? theme.secondary : theme.accent);
          return (
            <div
              key={i}
              style={{
                background: "white",
                borderRadius: "16px",
                padding: "32px",
                borderLeft: `5px solid ${color}`,
                boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
              }}
            >
              <h3
                style={{
                  fontFamily: theme.fontHeading,
                  fontSize: "22px",
                  fontWeight: 700,
                  color,
                  marginBottom: "20px",
                }}
              >
                {col.title}
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {col.points.map((point, j) => (
                  <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                    <span className="material-icons" style={{ color: "#22C55E", fontSize: "20px" }}>
                      check_circle
                    </span>
                    <p style={{ fontFamily: theme.fontBody, fontSize: "14px", color: "#475569", lineHeight: 1.5 }}>
                      {point}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
