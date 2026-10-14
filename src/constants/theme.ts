import { Platform } from 'react-native';

/** Kriraghor tokens (kriraghor-docs/00-platform/09): green = every action, amber = prize money only. */
export const Colors = {
  light: {
    text: '#16201B',
    textSecondary: '#55625B',
    background: '#F4F3EF',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#ECEBE6',
    line: '#D5D8D2',
    brand: '#0B7A4B',
    brandText: '#075533',
    onBrand: '#FFFFFF',
    prize: '#F2A33A',
    danger: '#B42318',
  },
  dark: {
    text: '#E8ECE9',
    textSecondary: '#A2AFA7',
    background: '#0E1411',
    backgroundElement: '#151D18',
    backgroundSelected: '#1C2620',
    line: '#2A3530',
    brand: '#19995F',
    brandText: '#8FD8B2',
    onBrand: '#FFFFFF',
    prize: '#F2A33A',
    danger: '#F97066',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', mono: 'ui-monospace' },
  default: { sans: 'normal', mono: 'monospace' },
});

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
