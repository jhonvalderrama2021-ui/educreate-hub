import { StructuredSlide, SlideTheme } from "@/lib/slide-types";

interface Props {
  slide: StructuredSlide;
  theme: SlideTheme;
}

export function ConclusionLayout({ slide, theme }: Props) {
  return (
    <div
      className="w-full h-full flex items-center justify-center text-center"
      style={{
        background: `linear-gradient(135deg, ${theme.primary}E6 0%, ${theme.accent}CC 100%)`,
        padding: "80px",
      }}
    >
      <div style={{ maxWidth: "800px" }}>
        <span className="material-icons" style={{ fontSize: "56px", color: "rgba(255,255,255,0.8)", marginBottom: "24px", display: "block" }}>
          emoji_objects
        </span>
        <h2
          style={{
            fontFamily: theme.fontHeading,
            fontSize: "44px",
            fontWeight: 700,
            color: "white",
            marginBottom: "20px",
            lineHeight: 1.2,
          }}
        >
          {slide.title}
        </h2>
        {slide.subtitle && (
          <p
            style={{
              fontFamily: theme.fontBody,
              fontSize: "20px",
              color: "rgba(255,255,255,0.85)",
              lineHeight: 1.6,
              marginBottom: "32px",
            }}
          >
            {slide.subtitle}
          </p>
        )}
        {slide.content && (
          <p
            style={{
              fontFamily: theme.fontBody,
              fontSize: "16px",
              color: "rgba(255,255,255,0.7)",
              lineHeight: 1.6,
            }}
          >
            {slide.content}
          </p>
        )}
      </div>
    </div>
  );
}
