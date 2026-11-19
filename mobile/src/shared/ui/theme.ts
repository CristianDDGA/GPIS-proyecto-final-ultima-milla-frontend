import {Platform, type TextStyle} from 'react-native';

/**
 * Sistema visual Webflow Studio (`DESIGN.md`) adaptado nativamente a React Native:
 * - Lienzo blanco puro `#FFFFFF`, superficie `#F0F0F0`, tinta `#080808`, bordes `#D8D8D8`
 * - Acento único interactivo `#146EF5`
 * - Geometría: `4px` en controles/tags/inputs, `8px` en tarjetas y modales
 * - Elevación plana definida por bordes `1px`, sin sombras pesadas en reposo
 */
export const colors = {
  pureWhite: '#FFFFFF',
  mist: '#F0F0F0',
  mistHover: '#E6E6E6',
  obsidian: '#080808',
  slate: '#5A5A5A',
  mutedInk: '#737373',
  ashBorder: '#D8D8D8',
  webflowBlue: '#146EF5',
  indigoInk: '#1366E2',
  skyGlow: '#6CA7FF',
  blueTintBg: '#EEF4FF',
  blueTintBorder: '#B8D3FE',
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
  backdrop: 'rgba(8, 8, 8, 0.42)',
} as const;

export const radii = {
  control: 4,
  tag: 4,
  card: 8,
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
