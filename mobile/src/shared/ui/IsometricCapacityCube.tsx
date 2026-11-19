import {StyleSheet, View} from 'react-native';
import {colors} from './theme';

interface IsometricCapacityCubeProps {
  readonly occupied: number;
  readonly capacity: number;
  readonly status?: string;
}

const ACCENT_BY_STATUS: Record<string, {top: string; left: string; right: string}> = {
  en_curso: {top: colors.neonPulse, left: '#1B8F3B', right: '#0F6B2F'},
  asignada: {top: colors.skyGlow, left: colors.webflowBlue, right: colors.indigoInk},
  completada: {top: '#B5E8C3', left: '#2F855A', right: '#0F6B2F'},
  cancelada: {top: '#E5E7EB', left: '#9CA3AF', right: '#6B7280'},
};

const DEFAULT_ACCENT = {
  top: colors.skyGlow,
  left: colors.webflowBlue,
  right: colors.indigoInk,
};

const EMPTY_FACE = {
  top: colors.pureWhite,
  left: colors.mist,
  right: '#E2E4E8',
};

/**
 * Representación isométrica 2.5D ligera de ocupación de ruta (`occupied / capacity`)
 * adaptada nativamente a React Native sin dependencias de gráficos nativos externos.
 */
export function IsometricCapacityCube({
  occupied,
  capacity,
  status = 'planificada',
}: IsometricCapacityCubeProps) {
  const safeCapacity = Math.max(1, capacity);
  const ratio = Math.min(1, Math.max(0, occupied / safeCapacity));
  const totalBlocks = 4;
  const filledBlocks = Math.round(ratio * totalBlocks);
  const accent = ACCENT_BY_STATUS[status] ?? DEFAULT_ACCENT;

  return (
    <View accessible={false} style={styles.plate}>
      <View style={styles.isoStage}>
        {Array.from({length: totalBlocks}).map((_, idx) => {
          const isFilled = idx < filledBlocks;
          const face = isFilled ? accent : EMPTY_FACE;
          const col = idx % 2;
          const row = Math.floor(idx / 2);
          const x = col * 14 - row * 6;
          const y = row * 9 + col * 3;
          const heightOffset = isFilled ? -4 : 0;

          return (
            <View
              key={idx}
              style={[
                styles.prism,
                {
                  left: 12 + x,
                  top: 8 + y + heightOffset,
                },
              ]}>
              <View style={[styles.topFace, {backgroundColor: face.top}]} />
              <View style={styles.sidePair}>
                <View style={[styles.leftFace, {backgroundColor: face.left}]} />
                <View style={[styles.rightFace, {backgroundColor: face.right}]} />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    width: 52,
    height: 44,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.ashBorder,
    backgroundColor: colors.mist,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  isoStage: {
    width: 48,
    height: 38,
    position: 'relative',
  },
  prism: {
    position: 'absolute',
    width: 12,
    alignItems: 'center',
  },
  topFace: {
    width: 10,
    height: 6,
    borderWidth: 0.75,
    borderColor: colors.obsidian,
    transform: [{skewX: '-28deg'}],
  },
  sidePair: {
    flexDirection: 'row',
  },
  leftFace: {
    width: 5,
    height: 6,
    borderLeftWidth: 0.75,
    borderBottomWidth: 0.75,
    borderColor: colors.obsidian,
    transform: [{skewY: '18deg'}],
  },
  rightFace: {
    width: 5,
    height: 6,
    borderRightWidth: 0.75,
    borderBottomWidth: 0.75,
    borderColor: colors.obsidian,
    transform: [{skewY: '-18deg'}],
  },
});
