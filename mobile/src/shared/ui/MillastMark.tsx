import {StyleSheet, View} from 'react-native';
import {colors, radii} from './theme';

interface MillastMarkProps {
  readonly size?: number;
}

/** Emblema geométrico plano `#146EF5` de Millast replicado nativamente para React Native. */
export function MillastMark({size = 28}: MillastMarkProps) {
  const unit = size / 28;
  return (
    <View
      accessible={false}
      style={[
        styles.box,
        {
          width: size,
          height: size,
          borderRadius: Math.max(4, Math.round(6 * unit)),
        },
      ]}>
      <View
        style={[
          styles.routeSegmentLeft,
          {
            width: 8 * unit,
            height: 2.2 * unit,
            left: 5 * unit,
            top: 14 * unit,
          },
        ]}
      />
      <View
        style={[
          styles.routeSegmentRight,
          {
            width: 9 * unit,
            height: 2.2 * unit,
            left: 12 * unit,
            top: 13 * unit,
          },
        ]}
      />
      <View
        style={[
          styles.node,
          {
            width: 4.5 * unit,
            height: 4.5 * unit,
            borderRadius: 2.5 * unit,
            left: 5 * unit,
            top: 16 * unit,
          },
        ]}
      />
      <View
        style={[
          styles.node,
          {
            width: 4.5 * unit,
            height: 4.5 * unit,
            borderRadius: 2.5 * unit,
            right: 5 * unit,
            top: 7.5 * unit,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.webflowBlue,
    overflow: 'hidden',
    position: 'relative',
  },
  routeSegmentLeft: {
    backgroundColor: colors.pureWhite,
    borderRadius: radii.control,
    position: 'absolute',
    transform: [{rotate: '-28deg'}],
  },
  routeSegmentRight: {
    backgroundColor: colors.pureWhite,
    borderRadius: radii.control,
    position: 'absolute',
    transform: [{rotate: '-35deg'}],
  },
  node: {
    backgroundColor: colors.pureWhite,
    position: 'absolute',
  },
});
