import type {ReactNode} from 'react';
import {StyleSheet, View} from 'react-native';
import {KineticText} from './KineticText';
import {colors, spacing, typography} from './theme';

interface KineticHeaderProps {
  readonly title: string;
  readonly rightAction?: ReactNode;
}

export function KineticHeader({title, rightAction}: KineticHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.titleWrap}>
        <KineticText text={title} style={typography.pageTitle} />
      </View>
      {rightAction ? <View style={styles.action}>{rightAction}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.ashBorder,
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
  },
  action: {
    flexShrink: 0,
  },
});
