import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SlideData {
  title?: string;
  subtitle?: string;
  content?: string;
  points?: string[];
  leftContent?: string;
  rightContent?: string;
  layout?: "title" | "content" | "two_columns" | "image_text";
  bgColor?: string;
  imageQuery?: string;
  imageUrl?: string;
}

interface Props {
  slides: SlideData[];
  title?: string;
}

export function SlideViewer({ slides, title }: Props) {
  const [currentSlide, setCurrentSlide] = useState(0);

  if (!slides || slides.length === 0) {
    return <p className="text-muted-foreground text-center py-8">No se generaron diapositivas.</p>;
  }

  const slide = slides[currentSlide];
  const bgHex = slide.bgColor || "1a1a2e";
  const isLight = isLightBg(bgHex);
  const textClass = isLight ? "text-gray-900" : "text-white";
  const subtextClass = isLight ? "text-gray-600" : "text-white/80";

  return (
    <div className="space-y-4">
      {/* Slide */}
      <div
        className="relative w-full rounded-xl overflow-hidden shadow-2xl border border-border"
        style={{ aspectRatio: "16/9", backgroundColor: `#${bgHex}` }}
      >
        <div className="absolute inset-0 p-8 md:p-12 flex flex-col">
          {slide.layout === "title" ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <h2 className={`text-2xl md:text-4xl lg:text-5xl font-bold mb-4 leading-tight ${textClass}`}>
                {slide.title}
              </h2>
              {slide.subtitle && (
                <p className={`text-base md:text-xl ${subtextClass} max-w-2xl`}>
                  {slide.subtitle}
                </p>
              )}
            </div>
          ) : slide.layout === "two_columns" ? (
            <>
              <h2 className={`text-xl md:text-3xl font-bold mb-6 ${textClass}`}>{slide.title}</h2>
              <div className="flex-1 grid grid-cols-2 gap-6">
                <div className={`text-sm md:text-base ${subtextClass} whitespace-pre-line leading-relaxed`}>
                  {slide.leftContent}
                </div>
                <div className={`text-sm md:text-base ${subtextClass} whitespace-pre-line leading-relaxed`}>
                  {slide.rightContent}
                </div>
              </div>
            </>
          ) : (
            <>
              <h2 className={`text-xl md:text-3xl font-bold mb-6 ${textClass}`}>{slide.title}</h2>
              <div className="flex-1 flex flex-col gap-3 overflow-auto">
                {slide.points?.map((point, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span
                      className="mt-1 h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: isLight ? "#6366f1" : "#818cf8" }}
                    />
                    <p className={`text-sm md:text-base ${subtextClass} leading-relaxed`}>{point}</p>
                  </div>
                ))}
                {slide.content && (
                  <p className={`text-sm md:text-base ${subtextClass} leading-relaxed mt-2`}>{slide.content}</p>
                )}
              </div>
            </>
          )}

          {/* Image placeholder */}
          {slide.imageQuery && (
            <div className="absolute bottom-4 right-4 text-xs opacity-40 flex items-center gap-1">
              <span>🖼</span>
              <span className={subtextClass}>{slide.imageQuery}</span>
            </div>
          )}
        </div>

        {/* Slide number */}
        <div className={`absolute bottom-3 left-4 text-xs ${subtextClass} opacity-50`}>
          {currentSlide + 1} / {slides.length}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
          disabled={currentSlide === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
        </Button>

        <div className="flex gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className={`h-2 rounded-full transition-all ${
                i === currentSlide ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
            />
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))}
          disabled={currentSlide === slides.length - 1}
        >
          Siguiente <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {/* Thumbnail strip */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {slides.map((s, i) => (
          <button
            key={i}
            onClick={() => setCurrentSlide(i)}
            className={`shrink-0 w-32 rounded-lg overflow-hidden border-2 transition-all ${
              i === currentSlide ? "border-primary shadow-lg" : "border-border hover:border-primary/40"
            }`}
            style={{ aspectRatio: "16/9", backgroundColor: `#${s.bgColor || "1a1a2e"}` }}
          >
            <div className="p-2 h-full flex flex-col justify-center">
              <p className={`text-[7px] font-bold leading-tight truncate ${
                isLightBg(s.bgColor || "1a1a2e") ? "text-gray-900" : "text-white"
              }`}>
                {s.title || `Diapositiva ${i + 1}`}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function isLightBg(hex: string): boolean {
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}
