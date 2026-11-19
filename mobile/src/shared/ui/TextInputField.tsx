import {useState} from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';
import {colors, fontFamilySans, radii, spacing, typography} from './theme';

interface TextInputFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly placeholder?: string;
  readonly error?: string;
  readonly helperText?: string;
  readonly isRequired?: boolean;
  readonly editable?: boolean;
  readonly isPassword?: boolean;
  readonly keyboardType?: KeyboardTypeOptions;
  readonly autoCapitalize?: TextInputProps['autoCapitalize'];
  readonly autoCorrect?: boolean;
  readonly maxLength?: number;
  readonly multiline?: boolean;
  readonly testID?: string;
  readonly accessibilityLabel?: string;
}

export function TextInputField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  helperText,
  isRequired = false,
  editable = true,
  isPassword = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  autoCorrect = true,
  maxLength,
  multiline = false,
  testID,
  accessibilityLabel,
}: TextInputFieldProps) {
  const [focused, setFocused] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Text style={typography.label}>
        {label}
        {isRequired ? <Text style={styles.required}> *</Text> : null}
      </Text>

      <View
        style={[
          styles.inputBox,
          focused && styles.inputBoxFocused,
          error ? styles.inputBoxError : null,
          !editable && styles.inputBoxDisabled,
        ]}>
        <TextInput
          accessibilityLabel={accessibilityLabel ?? label}
          autoCapitalize={isPassword ? 'none' : autoCapitalize}
          autoCorrect={isPassword ? false : autoCorrect}
          editable={editable}
          keyboardType={keyboardType}
          maxLength={maxLength}
          multiline={multiline}
          onBlur={() => setFocused(false)}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedInk}
          secureTextEntry={isPassword && !passwordVisible}
          style={[styles.input, multiline && styles.multiline]}
          testID={testID}
          value={value}
        />

        {isPassword ? (
          <Pressable
            accessibilityLabel={passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            accessibilityRole="button"
            onPress={() => setPasswordVisible(prev => !prev)}
            style={styles.toggleBtn}>
            <Text style={styles.toggleText}>{passwordVisible ? 'Ocultar' : 'Mostrar'}</Text>
          </Pressable>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
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
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    backgroundColor: colors.pureWhite,
    borderColor: colors.ashBorder,
    borderWidth: 1,
    borderRadius: radii.control,
    paddingHorizontal: spacing.md,
  },
  inputBoxFocused: {
    borderColor: colors.webflowBlue,
  },
  inputBoxError: {
    borderColor: colors.redText,
  },
  inputBoxDisabled: {
    backgroundColor: colors.mist,
    opacity: 0.78,
  },
  input: {
    flex: 1,
    fontFamily: fontFamilySans,
    fontSize: 14,
    color: colors.obsidian,
    paddingVertical: 10,
  },
  multiline: {
    minHeight: 76,
    textAlignVertical: 'top',
  },
  toggleBtn: {
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.tag,
    borderWidth: 1,
    borderColor: colors.ashBorder,
    backgroundColor: colors.mist,
  },
  toggleText: {
    fontFamily: fontFamilySans,
    fontSize: 12,
    fontWeight: '500',
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
});
