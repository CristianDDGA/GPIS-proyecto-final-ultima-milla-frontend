import {StyleSheet, View} from 'react-native';
import {colors, radii} from './theme';

export type NavTabId =
  | 'zones'
  | 'orders'
  | 'routes'
  | 'dispatch'
  | 'deliveries'
  | 'users'
  | 'application'
  | 'more';

interface NavIconProps {
  readonly tab: NavTabId;
  readonly active: boolean;
}

/** Icono geométrico minimalista construido sin librerías de fuentes externas. */
export function NavIcon({tab, active}: NavIconProps) {
  const stroke = active ? colors.webflowBlue : colors.slate;

  switch (tab) {
    case 'zones':
      return (
        <View style={styles.frame}>
          <View style={[styles.circle, {borderColor: stroke}]}>
            <View style={[styles.dot, {backgroundColor: stroke}]} />
          </View>
        </View>
      );
    case 'orders':
      return (
        <View style={styles.frame}>
          <View style={[styles.boxOutline, {borderColor: stroke}]}>
            <View style={[styles.bar, {backgroundColor: stroke}]} />
          </View>
        </View>
      );
    case 'routes':
      return (
        <View style={styles.frame}>
          <View style={styles.routeDots}>
            <View style={[styles.smallNode, {borderColor: stroke}]} />
            <View style={[styles.connector, {backgroundColor: stroke}]} />
            <View style={[styles.smallNode, {backgroundColor: stroke, borderColor: stroke}]} />
          </View>
        </View>
      );
    case 'dispatch':
      return (
        <View style={styles.frame}>
          <View style={styles.barsGroup}>
            <View style={[styles.shortBar, {backgroundColor: stroke}]} />
            <View style={[styles.longBar, {backgroundColor: stroke}]} />
          </View>
        </View>
      );
    case 'deliveries':
      return (
        <View style={styles.frame}>
          <View style={[styles.boxOutline, {borderColor: stroke}]}>
            <View style={[styles.checkBar, {borderColor: stroke}]} />
          </View>
        </View>
      );
    case 'application':
    case 'users':
      return (
        <View style={styles.frame}>
          <View style={styles.person}>
            <View style={[styles.head, {borderColor: stroke}]} />
            <View style={[styles.shoulders, {borderColor: stroke}]} />
          </View>
        </View>
      );
    case 'more':
      return (
        <View style={styles.frame}>
          <View style={styles.moreGrid}>
            <View style={[styles.moreCell, {backgroundColor: stroke}]} />
            <View style={[styles.moreCell, {backgroundColor: stroke}]} />
            <View style={[styles.moreCell, {backgroundColor: stroke}]} />
            <View style={[styles.moreCell, {backgroundColor: stroke}]} />
          </View>
        </View>
      );
  }
}

const styles = StyleSheet.create({
  frame: {
    width: 20,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  boxOutline: {
    width: 15,
    height: 14,
    borderRadius: radii.tag - 1,
    borderWidth: 1.8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    width: 7,
    height: 2,
    borderRadius: 1,
  },
  routeDots: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  smallNode: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1.8,
  },
  connector: {
    width: 6,
    height: 2,
  },
  barsGroup: {
    gap: 3,
    alignItems: 'flex-start',
  },
  shortBar: {
    width: 10,
    height: 2.2,
    borderRadius: 1,
  },
  longBar: {
    width: 15,
    height: 2.2,
    borderRadius: 1,
  },
  checkBar: {
    width: 7,
    height: 4,
    borderLeftWidth: 1.8,
    borderBottomWidth: 1.8,
    transform: [{rotate: '-45deg'}, {translateY: -1}],
  },
  person: {
    alignItems: 'center',
    gap: 2,
  },
  head: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1.7,
  },
  shoulders: {
    width: 12,
    height: 5,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    borderWidth: 1.7,
    borderBottomWidth: 0,
  },
  moreGrid: {
    width: 12,
    height: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreCell: {
    width: 4.5,
    height: 4.5,
    borderRadius: 1,
  },
});
