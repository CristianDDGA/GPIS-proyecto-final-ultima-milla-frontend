import type {ReactNode} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {colors, fontFamilySans, radii, spacing} from './theme';

interface EmptyStateProps {
  readonly title: string;
  readonly description: string;
  readonly action?: ReactNode;
}

export function EmptyState({title, description, action}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.glyph}>
        <View style={styles.glyphDot} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.ashBorder,
    borderRadius: radii.card,
    backgroundColor: colors.pureWhite,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  glyph: {
    width: 36,
    height: 36,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.ashBorder,
    backgroundColor: colors.mist,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  glyphDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.slate,
  },
  title: {
    fontFamily: fontFamilySans,
    fontSize: 15,
    fontWeight: '600',
    color: colors.obsidian,
    textAlign: 'center',
  },
  description: {
    fontFamily: fontFamilySans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.slate,
    textAlign: 'center',
  },
  action: {
    marginTop: spacing.xs,
  },
});
