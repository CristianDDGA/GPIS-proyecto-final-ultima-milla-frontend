import {StyleSheet, Text, View} from 'react-native';
import {formatShortCode} from '../utils/format';
import {colors, fontFamilySans, radii, tabularNumbersStyle} from './theme';

interface ShortIdChipProps {
  readonly id: string;
  readonly prefix: 'PED' | 'RUT' | 'ZON' | 'REP' | 'USR' | 'SOL';
}

export function ShortIdChip({id, prefix}: ShortIdChipProps) {
  return (
    <View style={styles.chip} accessibilityLabel={`${prefix} ${formatShortCode(id)}`}>
      <Text style={[styles.prefix, tabularNumbersStyle]}>{`#${prefix}-`}</Text>
      <Text style={[styles.code, tabularNumbersStyle]}>{formatShortCode(id)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.mist,
    borderColor: colors.ashBorder,
    borderWidth: 1,
    borderRadius: radii.tag,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  prefix: {
    fontFamily: fontFamilySans,
    fontSize: 12,
    fontWeight: '500',
    color: colors.webflowBlue,
  },
  code: {
    fontFamily: fontFamilySans,
    fontSize: 12,
    fontWeight: '600',
    color: colors.obsidian,
  },
});
