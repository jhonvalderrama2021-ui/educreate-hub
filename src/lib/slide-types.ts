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

// ============= Color palettes for slide generation =============

export interface SlidePalette {
  id: string;
  name: string;
  description: string;
  theme: SlideTheme;
  preview: string[]; // 3-4 hex colors used in the preview swatch
}

const FONT_HEADING = "'Space Grotesk', sans-serif";
const FONT_BODY = "'Inter', sans-serif";

export const SLIDE_PALETTES: SlidePalette[] = [
  {
    id: "academic",
    name: "Académico",
    description: "Azules profundos y serios para temas educativos formales",
    theme: {
      primary: "#1E3A5F",
      secondary: "#3B82F6",
      accent: "#6366F1",
      background: "#F0F4F8",
      text: "#1E293B",
      fontHeading: FONT_HEADING,
      fontBody: FONT_BODY,
    },
    preview: ["#1E3A5F", "#3B82F6", "#6366F1", "#F0F4F8"],
  },
  {
    id: "scientific",
    name: "Científico",
    description: "Verdes y turquesas para ciencias naturales y tecnología",
    theme: {
      primary: "#0F766E",
      secondary: "#14B8A6",
      accent: "#22C55E",
      background: "#F0FDFA",
      text: "#0F172A",
      fontHeading: FONT_HEADING,
      fontBody: FONT_BODY,
    },
    preview: ["#0F766E", "#14B8A6", "#22C55E", "#F0FDFA"],
  },
  {
    id: "creative",
    name: "Creativo",
    description: "Naranjas, rosas y púrpuras para artes y humanidades",
    theme: {
      primary: "#9333EA",
      secondary: "#EC4899",
      accent: "#F59E0B",
      background: "#FDF4FF",
      text: "#1F1235",
      fontHeading: FONT_HEADING,
      fontBody: FONT_BODY,
    },
    preview: ["#9333EA", "#EC4899", "#F59E0B", "#FDF4FF"],
  },
  {
    id: "corporate",
    name: "Corporativo",
    description: "Grises y azul marino para presentaciones profesionales",
    theme: {
      primary: "#0F172A",
      secondary: "#475569",
      accent: "#0EA5E9",
      background: "#F8FAFC",
      text: "#0F172A",
      fontHeading: FONT_HEADING,
      fontBody: FONT_BODY,
    },
    preview: ["#0F172A", "#475569", "#0EA5E9", "#F8FAFC"],
  },
  {
    id: "warm",
    name: "Cálido",
    description: "Tonos terracota y dorados para historia y literatura",
    theme: {
      primary: "#9A3412",
      secondary: "#EA580C",
      accent: "#D97706",
      background: "#FFF7ED",
      text: "#451A03",
      fontHeading: FONT_HEADING,
      fontBody: FONT_BODY,
    },
    preview: ["#9A3412", "#EA580C", "#D97706", "#FFF7ED"],
  },
  {
    id: "dark",
    name: "Oscuro",
    description: "Fondo oscuro con acentos vibrantes para alto impacto",
    theme: {
      primary: "#0F172A",
      secondary: "#6366F1",
      accent: "#22D3EE",
      background: "#1E293B",
      text: "#F1F5F9",
      fontHeading: FONT_HEADING,
      fontBody: FONT_BODY,
    },
    preview: ["#0F172A", "#6366F1", "#22D3EE", "#1E293B"],
  },
];

export function getPaletteById(id: string): SlidePalette {
  return SLIDE_PALETTES.find((p) => p.id === id) || SLIDE_PALETTES[0];
}

// ============= Editing helpers =============

/**
 * Update a nested field in a slide via a dot-path (e.g. "cards.0.title").
 * Returns a new slide object — does not mutate.
 */
export function updateSlideField(slide: StructuredSlide, path: string, value: any): StructuredSlide {
  const next: any = JSON.parse(JSON.stringify(slide));
  const parts = path.split(".");
  let cursor = next;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (cursor[key] == null) cursor[key] = isNaN(Number(parts[i + 1])) ? {} : [];
    cursor = cursor[key];
  }
  cursor[parts[parts.length - 1]] = value;
  return next;
}
