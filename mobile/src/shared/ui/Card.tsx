import type {ReactNode} from 'react';
import {StyleSheet, View, type ViewStyle} from 'react-native';
import {colors, radii, spacing} from './theme';

interface CardProps {
  readonly children: ReactNode;
  readonly variant?: 'elevated' | 'muted' | 'outlined';
  readonly style?: ViewStyle;
  readonly testID?: string;
}

/** Contenedor plano de estudio (`8px` radius, `1px` border `#D8D8D8`, cero sombra en reposo). */
export function Card({children, variant = 'elevated', style, testID}: CardProps) {
  return (
    <View
      testID={testID}
      style={[
        styles.base,
        variant === 'muted' ? styles.muted : styles.defaultSurface,
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.ashBorder,
    padding: spacing.lg,
    gap: spacing.md,
  },
  defaultSurface: {
    backgroundColor: colors.pureWhite,
  },
  muted: {
    backgroundColor: colors.mist,
  },
});
