// Structured slide data types — replaces free-form HTML approach

export interface SlideImage {
  query: string;
  alt: string;
  url?: string;           // resolved by backend (Unsplash)
  placement?: "left" | "right" | "background" | "top" | "bottom";
}

export interface SlideCard {
  icon?: string;           // Material Icon name
  title: string;
  description: string;
  color?: string;          // accent hex
}

export interface SlideStep {
  number: number;
  title: string;
  description: string;
  color?: string;
}

export interface SlideStat {
  value: string;
  label: string;
  color?: string;
}

export interface SlideListItem {
  icon?: string;
  title: string;
  description: string;
}

export interface SlideTimelineEvent {
  date: string;
  title: string;
  description: string;
}

export interface SlideColumn {
  title: string;
  color?: string;
  points: string[];
}

export type SlideLayout =
  | "hero"
  | "split"
  | "grid"
  | "process"
  | "comparison"
  | "stats"
  | "timeline"
  | "list"
  | "conclusion";

export interface SlideTheme {
  primary: string;     // hex
  secondary: string;   // hex
  accent: string;      // hex
  background: string;  // hex
  text: string;        // hex
  fontHeading: string;
  fontBody: string;
}

export interface StructuredSlide {
  layout: SlideLayout;
  title: string;
  subtitle?: string;
  content?: string;
  cards?: SlideCard[];
  steps?: SlideStep[];
  stats?: SlideStat[];
  listItems?: SlideListItem[];
  timelineEvents?: SlideTimelineEvent[];
  columns?: SlideColumn[];
  image?: SlideImage;
  slideNumber?: number;
}

export interface StructuredPresentation {
  title: string;
  subject: string;
  theme: SlideTheme;
  slides: StructuredSlide[];
}

export const DEFAULT_THEME: SlideTheme = {
  primary: "#1E3A5F",
  secondary: "#3B82F6",
  accent: "#6366F1",
  background: "#F0F4F8",
  text: "#1E293B",
  fontHeading: "'Space Grotesk', sans-serif",
  fontBody: "'Inter', sans-serif",
};
