import {useEffect, useMemo, useRef} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
  type TextStyle,
} from 'react-native';

interface KineticTextProps {
  readonly text: string;
  readonly style?: TextStyle;
  readonly wordDelayMs?: number;
}

/**
 * Tipografía Cinética palabra por palabra respetando `prefers-reduced-motion` del sistema.
 */
export function KineticText({text, style, wordDelayMs = 36}: KineticTextProps) {
  const words = useMemo(() => text.trim().split(/\s+/).filter(Boolean), [text]);
  const anims = useRef<Animated.Value[]>([]).current;

  while (anims.length < words.length) {
    anims.push(new Animated.Value(0));
  }
  if (anims.length > words.length) {
    anims.length = words.length;
  }

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(reduced => {
        if (!active) return;
        if (reduced) {
          anims.forEach(val => val.setValue(1));
          return;
        }
        anims.forEach(val => val.setValue(0));
        Animated.stagger(
          wordDelayMs,
          anims.map(val =>
            Animated.timing(val, {
              toValue: 1,
              duration: 210,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ),
        ).start();
      })
      .catch(() => {
        anims.forEach(val => val.setValue(1));
      });

    return () => {
      active = false;
    };
  }, [anims, text, wordDelayMs]);

  return (
    <View style={styles.row} accessibilityLabel={text} accessibilityRole="header">
      {words.map((word, index) => {
        const anim = anims[index];
        const opacity = anim
          ? anim.interpolate({inputRange: [0, 1], outputRange: [0.25, 1]})
          : 1;
        const translateY = anim
          ? anim.interpolate({inputRange: [0, 1], outputRange: [6, 0]})
          : 0;

        return (
          <Animated.Text
            key={`${word}-${index}`}
            style={[style, styles.word, {opacity, transform: [{translateY}]}]}>
            {index < words.length - 1 ? `${word} ` : word}
          </Animated.Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
  },
  word: {
    includeFontPadding: false,
  },
});
