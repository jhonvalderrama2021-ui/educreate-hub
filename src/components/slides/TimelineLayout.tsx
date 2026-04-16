import { StructuredSlide, SlideTheme } from "@/lib/slide-types";

interface Props {
  slide: StructuredSlide;
  theme: SlideTheme;
}

export function TimelineLayout({ slide, theme }: Props) {
  const events = slide.timelineEvents || [];

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
          position: "relative",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          paddingLeft: "60px",
        }}
      >
        {/* Vertical line */}
        <div
          style={{
            position: "absolute",
            left: "30px",
            top: "10%",
            bottom: "10%",
            width: "3px",
            background: `linear-gradient(${theme.secondary}, ${theme.accent})`,
            borderRadius: "2px",
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {events.map((event, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "20px", position: "relative" }}>
              {/* Dot */}
              <div
                style={{
                  position: "absolute",
                  left: "-42px",
                  top: "8px",
                  width: "16px",
                  height: "16px",
                  borderRadius: "50%",
                  background: i % 2 === 0 ? theme.secondary : theme.accent,
                  border: "3px solid white",
                  boxShadow: "0 0 0 2px " + (i % 2 === 0 ? theme.secondary : theme.accent),
                }}
              />
              <div
                style={{
                  background: "white",
                  borderRadius: "14px",
                  padding: "20px 24px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  border: "1px solid #E2E8F0",
                  flex: 1,
                }}
              >
                <span
                  style={{
                    fontFamily: theme.fontBody,
                    fontSize: "12px",
                    fontWeight: 600,
                    color: theme.secondary,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {event.date}
                </span>
                <h3
                  style={{
                    fontFamily: theme.fontHeading,
                    fontSize: "17px",
                    fontWeight: 600,
                    color: theme.text,
                    marginTop: "4px",
                    marginBottom: "4px",
                  }}
                >
                  {event.title}
                </h3>
                <p style={{ fontFamily: theme.fontBody, fontSize: "13px", color: "#64748B", lineHeight: 1.5 }}>
                  {event.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
