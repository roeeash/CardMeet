export interface ColorTokens {
  ink: string;
  ink2: string;
  muted: string;
  line: string;
  paper: string;
  paper2: string;
  accent: string;
  accentSoft: string;
  good: string;
  goodSoft: string;
  warn: string;
  warnSoft: string;
  bad: string;
  badSoft: string;
  phoneBg: string;
}

export interface SpacingTokens {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
  xxxl: number;
  huge: number;
  massive: number;
  gigantic: number;
  enormous: number;
  colossal: number;
  titan: number;
}

export interface TypographyTokens {
  fonts: {
    serif: string;
    sans: string;
    mono: string;
  };
  sizes: {
    hero: { fontSize: number; lineHeight: number };
    h1: { fontSize: number; lineHeight: number };
    h2: { fontSize: number; lineHeight: number };
    h3: { fontSize: number; lineHeight: number };
    h4: { fontSize: number; lineHeight: number };
    body: { fontSize: number; lineHeight: number };
    small: { fontSize: number; lineHeight: number };
    caption: { fontSize: number; lineHeight: number };
  };
  weights: {
    regular: string;
    medium: string;
    semibold: string;
    bold: string;
  };
}
