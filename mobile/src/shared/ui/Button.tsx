import {useEffect, useRef, useState} from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  type ViewStyle,
} from 'react-native';
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
  const scale = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => {
        if (active) setReduceMotion(enabled);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const animatePress = (toValue: number) => {
    if (blocked || reduceMotion) {
      scale.setValue(1);
      return;
    }
    Animated.spring(scale, {
      toValue,
      damping: 22,
      stiffness: 340,
      mass: 0.6,
      useNativeDriver: true,
    }).start();
  };

  const rippleColor =
    variant === 'primary' || variant === 'danger'
      ? 'rgba(255, 255, 255, 0.22)'
      : 'rgba(22, 104, 243, 0.14)';

  return (
    <Animated.View style={[fullWidth && styles.fullWidth, {transform: [{scale}]}]}>
      <Pressable
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityRole="button"
        accessibilityState={{disabled: blocked, busy: isLoading}}
        android_ripple={blocked ? undefined : {color: rippleColor, borderless: false}}
        disabled={blocked}
        hitSlop={size === 'sm' ? 4 : 0}
        onPress={onPress}
        onPressIn={() => animatePress(0.97)}
        onPressOut={() => animatePress(1)}
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
    </Animated.View>
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
    overflow: 'hidden',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.55,
  },
  text: {
    fontFamily: fontFamilySans,
    fontWeight: '600',
    includeFontPadding: false,
  },
});

const sizeStyles = StyleSheet.create({
  sm: {minHeight: 40, paddingHorizontal: 14, paddingVertical: 8},
  md: {minHeight: 48, paddingHorizontal: 16, paddingVertical: 12},
  lg: {minHeight: 50, paddingHorizontal: 18, paddingVertical: 13},
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
