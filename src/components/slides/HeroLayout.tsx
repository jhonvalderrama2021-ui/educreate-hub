import { StructuredSlide, SlideTheme } from "@/lib/slide-types";

interface Props {
  slide: StructuredSlide;
  theme: SlideTheme;
}

export function HeroLayout({ slide, theme }: Props) {
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
        <h1
          style={{
            fontFamily: theme.fontHeading,
            fontSize: "52px",
            fontWeight: 700,
            color: "white",
            marginBottom: "16px",
            lineHeight: 1.2,
          }}
        >
          {slide.title}
        </h1>
        {slide.subtitle && (
          <p
            style={{
              fontFamily: theme.fontBody,
              fontSize: "22px",
              color: "rgba(255,255,255,0.85)",
              maxWidth: "700px",
              margin: "0 auto",
            }}
          >
            {slide.subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
