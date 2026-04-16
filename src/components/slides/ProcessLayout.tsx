import { StructuredSlide, SlideTheme } from "@/lib/slide-types";

interface Props {
  slide: StructuredSlide;
  theme: SlideTheme;
}

const STEP_COLORS = ["#3B82F6", "#6366F1", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6"];

export function ProcessLayout({ slide, theme }: Props) {
  const steps = slide.steps || [];

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

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          flex: 1,
        }}
      >
        {steps.map((step, i) => {
          const color = step.color || STEP_COLORS[i % STEP_COLORS.length];
          return (
            <div key={i} style={{ display: "contents" }}>
              <div
                style={{
                  background: "white",
                  borderRadius: "16px",
                  padding: "24px 20px",
                  textAlign: "center",
                  flex: 1,
                  boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                  borderTop: `4px solid ${color}`,
                  maxWidth: "220px",
                }}
              >
                <div
                  style={{
                    background: color,
                    color: "white",
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 12px",
                    fontWeight: 700,
                    fontSize: "18px",
                    fontFamily: theme.fontHeading,
                  }}
                >
                  {step.number}
                </div>
                <h3
                  style={{
                    fontFamily: theme.fontHeading,
                    fontSize: "16px",
                    fontWeight: 600,
                    color: theme.text,
                    marginBottom: "6px",
                  }}
                >
                  {step.title}
                </h3>
                <p style={{ fontFamily: theme.fontBody, fontSize: "13px", color: "#64748B" }}>
                  {step.description}
                </p>
              </div>
              {i < steps.length - 1 && (
                <span className="material-icons" style={{ color: "#CBD5E1", fontSize: "28px" }}>
                  arrow_forward
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
