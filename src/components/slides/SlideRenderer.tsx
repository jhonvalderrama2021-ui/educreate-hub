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

interface Props {
  slide: StructuredSlide;
  theme?: SlideTheme;
}

const LAYOUT_MAP: Record<string, React.FC<{ slide: StructuredSlide; theme: SlideTheme }>> = {
  hero: HeroLayout,
  grid: GridLayout,
  split: SplitLayout,
  process: ProcessLayout,
  comparison: ComparisonLayout,
  stats: StatsLayout,
  timeline: TimelineLayout,
  list: ListLayout,
  conclusion: ConclusionLayout,
};

export function SlideRenderer({ slide, theme = DEFAULT_THEME }: Props) {
  const Layout = LAYOUT_MAP[slide.layout] || GridLayout;
  return <Layout slide={slide} theme={theme} />;
}
