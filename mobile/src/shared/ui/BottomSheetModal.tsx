import {useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {
  AccessibilityInfo,
  Animated,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, fontFamilySans, radii, spacing} from './theme';

interface BottomSheetModalProps {
  readonly visible: boolean;
  readonly title: string;
  readonly subtitle?: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}

export function BottomSheetModal({
  visible,
  title,
  subtitle,
  onClose,
  children,
}: BottomSheetModalProps) {
  const insets = useSafeAreaInsets();
  const [reduceMotion, setReduceMotion] = useState(false);
  const dragY = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

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

  useEffect(() => {
    if (visible) {
      dragY.setValue(0);
    }
  }, [dragY, visible]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) => {
          if (gesture.dy >= 0) {
            dragY.setValue(gesture.dy);
          } else {
            // Amortiguación elástica en el límite superior (Emil Kowalski)
            dragY.setValue(-Math.sqrt(Math.abs(gesture.dy)) * 2.5);
          }
        },
        onPanResponderRelease: (_, gesture) => {
          const velocityDismiss = gesture.vy > 0.11 && gesture.dy > 24;
          const distanceDismiss = gesture.dy > 96;
          if (velocityDismiss || distanceDismiss) {
            Animated.timing(dragY, {
              toValue: 320,
              duration: reduceMotion ? 100 : 180,
              useNativeDriver: true,
            }).start(() => {
              dragY.setValue(0);
              onCloseRef.current();
            });
          } else {
            Animated.spring(dragY, {
              toValue: 0,
              damping: 26,
              stiffness: 280,
              useNativeDriver: true,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(dragY, {
            toValue: 0,
            damping: 26,
            stiffness: 280,
            useNativeDriver: true,
          }).start();
        },
      }),
    [dragY, reduceMotion],
  );

  return (
    <Modal
      animationType={reduceMotion ? 'fade' : 'slide'}
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}>
        <Pressable accessibilityLabel="Cerrar modal" onPress={onClose} style={styles.backdrop} />
        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, spacing.lg),
              transform: [{translateY: dragY}],
            },
          ]}>
          <View {...panResponder.panHandlers}>
            <View style={styles.handleArea}>
              <View style={styles.handle} />
            </View>
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.title}>{title}</Text>
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              </View>
              <Pressable
                accessibilityLabel="Cerrar"
                accessibilityRole="button"
                hitSlop={6}
                onPress={onClose}
                style={styles.closeBtn}>
                <Text style={styles.closeLabel}>✕</Text>
              </Pressable>
            </View>
          </View>
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.backdrop,
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.pureWhite,
    borderTopLeftRadius: radii.card + 8,
    borderTopRightRadius: radii.card + 8,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.ashBorder,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  handleArea: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.ashBorder,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.ashBorder,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: fontFamilySans,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: colors.obsidian,
  },
  subtitle: {
    fontFamily: fontFamilySans,
    fontSize: 13,
    color: colors.slate,
  },
  closeBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.ashBorder,
    backgroundColor: colors.mist,
  },
  closeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.obsidian,
  },
  body: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
});
