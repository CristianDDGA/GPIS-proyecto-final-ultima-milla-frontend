import {useEffect, useRef, useState} from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import {colors, fontFamilySans, radii} from './theme';

export interface SegmentOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly testID?: string;
}

interface SegmentedControlProps<T extends string> {
  readonly options: readonly SegmentOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
}

/** Control segmentado deslizante estilo Webflow (`#F0F0F0` pista, indicador `#FFFFFF` con borde). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const [trackWidth, setTrackWidth] = useState(0);
  const selectedIndex = Math.max(
    0,
    options.findIndex(option => option.value === value),
  );
  const translateX = useRef(new Animated.Value(0)).current;

  const itemWidth = options.length > 0 && trackWidth > 0 ? (trackWidth - 6) / options.length : 0;

  useEffect(() => {
    if (itemWidth <= 0) return;
    Animated.spring(translateX, {
      toValue: selectedIndex * itemWidth,
      damping: 22,
      stiffness: 240,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }, [itemWidth, selectedIndex, translateX]);

  const handleLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  return (
    <View onLayout={handleLayout} style={styles.track} accessibilityRole="tablist">
      {itemWidth > 0 ? (
        <Animated.View
          style={[
            styles.thumb,
            {
              width: itemWidth,
              transform: [{translateX}],
            },
          ]}
        />
      ) : null}

      {options.map(option => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{selected: active}}
            onPress={() => onChange(option.value)}
            style={styles.tab}
            testID={option.testID}>
            <Text numberOfLines={1} style={[styles.label, active && styles.labelActive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.mist,
    borderColor: colors.ashBorder,
    borderWidth: 1,
    borderRadius: radii.control,
    padding: 2,
    position: 'relative',
  },
  thumb: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 2,
    backgroundColor: colors.pureWhite,
    borderRadius: radii.control - 1,
    borderWidth: 1,
    borderColor: colors.ashBorder,
  },
  tab: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    zIndex: 1,
  },
  label: {
    fontFamily: fontFamilySans,
    fontSize: 13,
    fontWeight: '500',
    color: colors.slate,
  },
  labelActive: {
    color: colors.obsidian,
    fontWeight: '600',
  },
});
