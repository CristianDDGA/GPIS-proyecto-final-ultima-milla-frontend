import type {ReactNode} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {colors, fontFamilySans, radii, spacing} from './theme';

export type AlertType = 'info' | 'success' | 'warning' | 'error';

interface AlertBannerProps {
  readonly type: AlertType;
  readonly title: string;
  readonly children: ReactNode;
  readonly onClose?: () => void;
}

const ALERT_STYLES = {
  info: {bg: colors.mist, border: colors.ashBorder, title: colors.obsidian},
  success: {bg: colors.greenBg, border: colors.greenBorder, title: colors.greenText},
  warning: {bg: colors.pendingBg, border: colors.pendingBorder, title: colors.pendingText},
  error: {bg: colors.redBg, border: colors.redBorder, title: colors.redText},
} as const;

export function AlertBanner({type, title, children, onClose}: AlertBannerProps) {
  const palette = ALERT_STYLES[type];

  return (
    <View
      accessibilityRole="alert"
      style={[styles.container, {backgroundColor: palette.bg, borderColor: palette.border}]}>
      <View style={styles.content}>
        <Text style={[styles.title, {color: palette.title}]}>{title}</Text>
        <Text style={styles.body}>{children}</Text>
      </View>
      {onClose ? (
        <Pressable
          accessibilityLabel="Cerrar aviso"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onClose}
          style={styles.closeBtn}>
          <Text style={[styles.closeText, {color: palette.title}]}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: radii.card,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: fontFamilySans,
    fontSize: 13,
    fontWeight: '600',
  },
  body: {
    fontFamily: fontFamilySans,
    fontSize: 13,
    lineHeight: 18,
    color: colors.obsidian,
  },
  closeBtn: {
    padding: 4,
  },
  closeText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
