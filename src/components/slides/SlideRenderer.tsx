import { StructuredSlide, SlideTheme, DEFAULT_THEME } from "@/lib/slide-types";
import { HeroLayout } from "./HeroLayout";
import { GridLayout } from "./GridLayout";
import { SplitLayout } from "./SplitLayout";
import { ProcessLayout } from "./ProcessLayout";
import { ComparisonLayout } from "./ComparisonLayout";
import { StatsLayout } from "./StatsLayout";
import { TimelineLayout } from "./TimelineLayout";
import { ListLayout } from "./ListLayout";
import { ConclusionLayout } from "./ConclusionLayout";
import { QuoteLayout } from "./QuoteLayout";
import { ImageFullLayout } from "./ImageFullLayout";
import { BigNumberLayout } from "./BigNumberLayout";
import { TwoColumnTextLayout } from "./TwoColumnTextLayout";

export interface SlideRendererProps {
  slide: StructuredSlide;
  theme?: SlideTheme;
  editable?: boolean;
  onFieldChange?: (path: string, value: any) => void;
}

const LAYOUT_MAP: Record<string, React.FC<any>> = {
  hero: HeroLayout,
  grid: GridLayout,
  split: SplitLayout,
  process: ProcessLayout,
  comparison: ComparisonLayout,
  stats: StatsLayout,
  timeline: TimelineLayout,
  list: ListLayout,
  conclusion: ConclusionLayout,
  quote: QuoteLayout,
  imageFull: ImageFullLayout,
  bigNumber: BigNumberLayout,
  twoColumnText: TwoColumnTextLayout,
};

export function SlideRenderer({ slide, theme = DEFAULT_THEME, editable, onFieldChange }: SlideRendererProps) {
  const Layout = LAYOUT_MAP[slide.layout] || GridLayout;
  return <Layout slide={slide} theme={theme} editable={editable} onFieldChange={onFieldChange} />;
}
