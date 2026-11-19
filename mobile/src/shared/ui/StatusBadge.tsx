import {StyleSheet, Text, View} from 'react-native';
import {colors, fontFamilySans, radii, tabularNumbersStyle} from './theme';

export type BadgeTone = 'neutral' | 'blue' | 'green' | 'amber' | 'red';

interface StatusBadgeProps {
  readonly label: string;
  readonly tone?: BadgeTone;
}

const TONE_MAP = {
  neutral: {bg: colors.mist, border: colors.ashBorder, text: colors.slate},
  blue: {bg: colors.blueTintBg, border: colors.blueTintBorder, text: colors.webflowBlue},
  green: {bg: colors.greenBg, border: colors.greenBorder, text: colors.greenText},
  amber: {bg: colors.pendingBg, border: colors.pendingBorder, text: colors.pendingText},
  red: {bg: colors.redBg, border: colors.redBorder, text: colors.redText},
} as const;

export function StatusBadge({label, tone = 'neutral'}: StatusBadgeProps) {
  const palette = TONE_MAP[tone];
  return (
    <View style={[styles.badge, {backgroundColor: palette.bg, borderColor: palette.border}]}>
      <Text numberOfLines={1} style={[styles.text, tabularNumbersStyle, {color: palette.text}]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radii.tag,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: {
    fontFamily: fontFamilySans,
    fontSize: 12,
    fontWeight: '500',
    includeFontPadding: false,
  },
});
