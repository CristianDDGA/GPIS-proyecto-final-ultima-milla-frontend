import {Platform, type TextStyle} from 'react-native';

/**
 * Sistema visual Millast Waterline (`DESIGN.md`) adaptado nativamente a React Native:
 * - Lienzo blanco `#FFFFFF`, superficie táctil `#F3F7FC`, tinta `#0B132B`, bordes `#CBD5E1`
 * - Acento único interactivo `#1668F3`
 * - Geometría: `12dp` controles/inputs, `16dp` tarjetas y sheets, `999dp` tags/pills
 * - Elevación limpia definida por bordes `1px`, objetivos táctiles >= 48dp
 */
export const colors = {
  pureWhite: '#FFFFFF',
  mist: '#F3F7FC',
  mistHover: '#E5EEF8',
  obsidian: '#0B132B',
  slate: '#475569',
  mutedInk: '#64748B',
  ashBorder: '#CBD5E1',
  webflowBlue: '#1668F3',
  indigoInk: '#1254CC',
  skyGlow: '#6CA7FF',
  blueTintBg: '#EEF5FF',
  blueTintBorder: '#BFD7FE',
  greenBg: '#EEFBF1',
  greenText: '#0F6B2F',
  greenBorder: '#B5E8C3',
  neonPulse: '#60ED76',
  pendingBg: '#FFF6ED',
  pendingText: '#8A4B08',
  pendingBorder: '#FFD6AE',
  amberLight: '#FFA666',
  redBg: '#FEF2F2',
  redText: '#B42318',
  redBorder: '#F5B8B4',
  backdrop: 'rgba(11, 19, 43, 0.42)',
} as const;

export const radii = {
  control: 12,
  tag: 999,
  card: 16,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const fontFamilySans = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
});

export const tabularNumbersStyle: TextStyle = {
  fontVariant: ['tabular-nums'],
};

export const typography = {
  display: {
    fontFamily: fontFamilySans,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '600',
    letterSpacing: -0.7,
    color: colors.obsidian,
  } as TextStyle,
  pageTitle: {
    fontFamily: fontFamilySans,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    letterSpacing: -0.45,
    color: colors.obsidian,
  } as TextStyle,
  cardTitle: {
    fontFamily: fontFamilySans,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: colors.obsidian,
  } as TextStyle,
  body: {
    fontFamily: fontFamilySans,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    color: colors.obsidian,
  } as TextStyle,
  bodyMuted: {
    fontFamily: fontFamilySans,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    color: colors.slate,
  } as TextStyle,
  label: {
    fontFamily: fontFamilySans,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: colors.obsidian,
  } as TextStyle,
  caption: {
    fontFamily: fontFamilySans,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors.slate,
  } as TextStyle,
} as const;
