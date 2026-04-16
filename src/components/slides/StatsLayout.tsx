import { StructuredSlide, SlideTheme } from "@/lib/slide-types";

interface Props {
  slide: StructuredSlide;
  theme: SlideTheme;
}

const STAT_COLORS = ["#3B82F6", "#6366F1", "#22C55E", "#F59E0B"];

export function StatsLayout({ slide, theme }: Props) {
  const stats = slide.stats || [];
  const cols = stats.length <= 3 ? stats.length : Math.min(4, stats.length);

  return (
    <div
      className="w-full h-full flex flex-col"
      style={{ padding: "60px 70px", gap: "40px", background: theme.background }}
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
      {slide.subtitle && (
        <p style={{ fontFamily: theme.fontBody, fontSize: "18px", color: "#64748B", textAlign: "center", marginTop: "-24px" }}>
          {slide.subtitle}
        </p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: "24px",
          flex: 1,
          alignItems: "center",
        }}
      >
        {stats.map((stat, i) => {
          const color = stat.color || STAT_COLORS[i % STAT_COLORS.length];
          return (
            <div
              key={i}
              style={{
                textAlign: "center",
                background: "white",
                borderRadius: "16px",
                padding: "40px 24px",
                boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
              }}
            >
              <div
                style={{
                  fontFamily: theme.fontHeading,
                  fontSize: "56px",
                  fontWeight: 700,
                  color,
                }}
              >
                {stat.value}
              </div>
              <p style={{ fontFamily: theme.fontBody, fontSize: "16px", color: "#64748B", marginTop: "8px" }}>
                {stat.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
