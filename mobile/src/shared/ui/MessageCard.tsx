import type {ReactNode} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {colors, fontFamilySans, radii, spacing} from './theme';

interface MessageCardProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly tone?: 'neutral' | 'error';
}

export function MessageCard({title, children, tone = 'neutral'}: MessageCardProps) {
  return (
    <View style={[styles.card, tone === 'error' ? styles.error : styles.neutral]}>
      <Text style={[styles.title, tone === 'error' && styles.titleError]}>{title}</Text>
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.card,
    borderWidth: 1,
    gap: 4,
    padding: spacing.lg,
  },
  neutral: {
    backgroundColor: colors.blueTintBg,
    borderColor: colors.blueTintBorder,
  },
  error: {
    backgroundColor: colors.redBg,
    borderColor: colors.redBorder,
  },
  title: {
    fontFamily: fontFamilySans,
    fontSize: 15,
    fontWeight: '600',
    color: colors.obsidian,
  },
  titleError: {
    color: colors.redText,
  },
  body: {
    fontFamily: fontFamilySans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.obsidian,
  },
});
