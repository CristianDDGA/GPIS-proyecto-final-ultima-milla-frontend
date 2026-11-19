import {useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {BottomSheetModal} from './BottomSheetModal';
import {TextInputField} from './TextInputField';
import {colors, fontFamilySans, radii, spacing, typography} from './theme';

export interface PickerOption {
  readonly value: string;
  readonly label: string;
}

interface PickerFieldProps {
  readonly label: string;
  readonly value: string;
  readonly options: readonly PickerOption[];
  readonly onValueChange: (value: string) => void;
  readonly placeholder?: string;
  readonly error?: string;
  readonly helperText?: string;
  readonly isRequired?: boolean;
  readonly disabled?: boolean;
  readonly searchableThreshold?: number;
  readonly maxRenderedOptions?: number;
  readonly testID?: string;
}

export function PickerField({
  label,
  value,
  options,
  onValueChange,
  placeholder = 'Selecciona una opción',
  error,
  helperText,
  isRequired = false,
  disabled = false,
  searchableThreshold = 12,
  maxRenderedOptions = 60,
  testID,
}: PickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedLabel = options.find(option => option.value === value)?.label ?? '';
  const showSearch = options.length > searchableThreshold;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched =
      q.length === 0
        ? options
        : options.filter(
            option =>
              option.label.toLowerCase().includes(q) ||
              option.value.toLowerCase().includes(q),
          );
    return matched.slice(0, maxRenderedOptions);
  }, [maxRenderedOptions, options, query]);

  return (
    <View style={styles.wrapper}>
      <Text style={typography.label}>
        {label}
        {isRequired ? <Text style={styles.required}> *</Text> : null}
      </Text>

      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityState={{disabled, expanded: open}}
        disabled={disabled}
        onPress={() => {
          setQuery('');
          setOpen(true);
        }}
        style={[
          styles.trigger,
          error ? styles.triggerError : null,
          disabled && styles.triggerDisabled,
        ]}
        testID={testID}>
        <Text
          numberOfLines={1}
          style={[styles.triggerText, !selectedLabel && styles.placeholder]}>
          {selectedLabel || placeholder}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && helperText ? <Text style={styles.helper}>{helperText}</Text> : null}

      <BottomSheetModal
        onClose={() => setOpen(false)}
        subtitle={
          options.length > maxRenderedOptions
            ? `Mostrando hasta ${maxRenderedOptions} resultados. Usa el buscador para filtrar.`
            : undefined
        }
        title={label}
        visible={open}>
        {showSearch ? (
          <TextInputField
            label="Buscar"
            onChangeText={setQuery}
            placeholder="Filtrar opciones..."
            value={query}
          />
        ) : null}

        {filtered.length === 0 ? (
          <Text style={styles.empty}>No hay opciones que coincidan.</Text>
        ) : (
          <View style={styles.list}>
            {filtered.map(option => {
              const active = option.value === value;
              return (
                <Pressable
                  key={option.value || '__empty__'}
                  accessibilityRole="menuitem"
                  accessibilityState={{selected: active}}
                  onPress={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                  style={({pressed}) => [
                    styles.optionRow,
                    active && styles.optionRowActive,
                    pressed && styles.optionRowPressed,
                  ]}>
                  <Text
                    style={[styles.optionText, active && styles.optionTextActive]}>
                    {option.label}
                  </Text>
                  {active ? <Text style={styles.check}>✓</Text> : null}
                </Pressable>
              );
            })}
          </View>
        )}
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  required: {
    color: colors.redText,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.ashBorder,
    backgroundColor: colors.pureWhite,
  },
  triggerError: {
    borderColor: colors.redText,
  },
  triggerDisabled: {
    backgroundColor: colors.mist,
    opacity: 0.65,
  },
  triggerText: {
    flex: 1,
    fontFamily: fontFamilySans,
    fontSize: 14,
    color: colors.obsidian,
  },
  placeholder: {
    color: colors.mutedInk,
  },
  chevron: {
    fontSize: 13,
    color: colors.obsidian,
  },
  error: {
    fontFamily: fontFamilySans,
    fontSize: 12,
    fontWeight: '500',
    color: colors.redText,
  },
  helper: {
    fontFamily: fontFamilySans,
    fontSize: 12,
    color: colors.slate,
  },
  list: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.ashBorder,
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: 46,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.pureWhite,
    borderBottomWidth: 1,
    borderBottomColor: colors.ashBorder,
  },
  optionRowActive: {
    backgroundColor: colors.blueTintBg,
  },
  optionRowPressed: {
    backgroundColor: colors.mist,
  },
  optionText: {
    flex: 1,
    fontFamily: fontFamilySans,
    fontSize: 14,
    color: colors.obsidian,
  },
  optionTextActive: {
    fontWeight: '600',
    color: colors.webflowBlue,
  },
  check: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.webflowBlue,
  },
  empty: {
    fontFamily: fontFamilySans,
    fontSize: 14,
    color: colors.slate,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});
