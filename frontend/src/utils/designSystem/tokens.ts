export const colors = {
  // Ink scale - neutrals
  ink: '#14141a',
  ink2: '#3a3a45',
  muted: '#767685',
  line: '#e6e6ec',
  
  // Paper scale - backgrounds
  paper: '#f7f6f2',
  paper2: '#fbfaf6',
  
  // Accent
  accent: '#2c4cff',
  accentSoft: '#e8edff',
  
  // Status colors
  good: '#15803d',
  goodSoft: '#d6f0de',
  warn: '#92400e',
  warnSoft: '#fef0c7',
  bad: '#991b1b',
  badSoft: '#fde2e2',
  
  // Phone background
  phoneBg: '#ffffff',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  massive: 48,
  gigantic: 56,
  enormous: 72,
  colossal: 80,
  titan: 120,
} as const;

export const typography = {
  // Fonts
  fonts: {
    serif: 'Fraunces',
    sans: 'Inter',
    mono: 'JetBrains Mono',
  },
  
  // Sizes
  sizes: {
    hero: { fontSize: 56, lineHeight: 60 },
    h1: { fontSize: 48, lineHeight: 52 },
    h2: { fontSize: 32, lineHeight: 36 },
    h3: { fontSize: 24, lineHeight: 28 },
    h4: { fontSize: 20, lineHeight: 24 },
    body: { fontSize: 15, lineHeight: 24 },
    small: { fontSize: 13, lineHeight: 20 },
    caption: { fontSize: 11, lineHeight: 16 },
  },
  
  // Weights
  weights: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

export const borderRadius = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  xxl: 14,
  huge: 16,
  massive: 24,
  gigantic: 36,
  full: 100,
} as const;
