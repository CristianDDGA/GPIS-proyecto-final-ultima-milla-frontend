import {ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle} from 'react-native';
import {colors, fontFamilySans, radii, spacing} from './theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly disabled?: boolean;
  readonly isLoading?: boolean;
  readonly fullWidth?: boolean;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
  readonly style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  isLoading = false,
  fullWidth = false,
  accessibilityLabel,
  testID,
  style,
}: ButtonProps) {
  const blocked = disabled || isLoading;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{disabled: blocked, busy: isLoading}}
      disabled={blocked}
      onPress={onPress}
      testID={testID}
      style={({pressed}) => [
        styles.base,
        sizeStyles[size],
        variantStyles[variant],
        fullWidth && styles.fullWidth,
        pressed && !blocked && pressedStyles[variant],
        blocked && styles.disabled,
        style,
      ]}>
      {isLoading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'danger' ? colors.pureWhite : colors.webflowBlue}
          size="small"
        />
      ) : null}
      <Text
        numberOfLines={1}
        style={[
          styles.text,
          textSizeStyles[size],
          textVariantStyles[variant],
          blocked && textDisabledStyles[variant],
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.55,
  },
  text: {
    fontFamily: fontFamilySans,
    fontWeight: '500',
    includeFontPadding: false,
  },
});

const sizeStyles = StyleSheet.create({
  sm: {minHeight: 38, paddingHorizontal: 12, paddingVertical: 8},
  md: {minHeight: 44, paddingHorizontal: 16, paddingVertical: 10},
  lg: {minHeight: 48, paddingHorizontal: 18, paddingVertical: 12},
});

const textSizeStyles = StyleSheet.create({
  sm: {fontSize: 13},
  md: {fontSize: 14},
  lg: {fontSize: 15},
});

const variantStyles = StyleSheet.create({
  primary: {backgroundColor: colors.webflowBlue, borderColor: colors.webflowBlue},
  secondary: {backgroundColor: colors.pureWhite, borderColor: colors.ashBorder},
  outline: {backgroundColor: colors.pureWhite, borderColor: colors.webflowBlue},
  ghost: {backgroundColor: 'transparent', borderColor: 'transparent'},
  danger: {backgroundColor: colors.redText, borderColor: colors.redText},
});

const pressedStyles = StyleSheet.create({
  primary: {backgroundColor: colors.indigoInk, borderColor: colors.indigoInk},
  secondary: {backgroundColor: colors.mist},
  outline: {backgroundColor: colors.blueTintBg},
  ghost: {backgroundColor: colors.mist},
  danger: {opacity: 0.88},
});

const textVariantStyles = StyleSheet.create({
  primary: {color: colors.pureWhite},
  secondary: {color: colors.obsidian},
  outline: {color: colors.webflowBlue},
  ghost: {color: colors.slate},
  danger: {color: colors.pureWhite},
});

const textDisabledStyles = StyleSheet.create({
  primary: {color: colors.pureWhite},
  secondary: {color: colors.slate},
  outline: {color: colors.slate},
  ghost: {color: colors.slate},
  danger: {color: colors.pureWhite},
});
