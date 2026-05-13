import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Type, Spacing, Radius } from '@/constants/Typography';

export interface PickerOption<T extends string | number> {
  value: T;
  label: string;
  sublabel?: string;
}

interface PickerSheetProps<T extends string | number> {
  visible: boolean;
  title: string;
  value: T;
  options: PickerOption<T>[];
  onSelect: (value: T) => void;
  onClose: () => void;
}

export function PickerSheet<T extends string | number>({
  visible,
  title,
  value,
  options,
  onSelect,
  onClose,
}: PickerSheetProps<T>) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text style={[Type.titleLg, { color: colors.text, paddingHorizontal: Spacing.xl }]}>
            {title}
          </Text>

          <View style={{ marginTop: Spacing.md, paddingHorizontal: Spacing.md }}>
            {options.map((opt) => {
              const selected = opt.value === value;
              return (
                <TouchableOpacity
                  key={String(opt.value)}
                  onPress={() => { onSelect(opt.value); onClose(); }}
                  activeOpacity={0.7}
                  style={[
                    styles.option,
                    { backgroundColor: selected ? colors.primaryTint : 'transparent' },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[Type.bodyBold, { color: selected ? colors.primary : colors.text }]}>
                      {opt.label}
                    </Text>
                    {opt.sublabel ? (
                      <Text style={[Type.caption, { color: colors.textMuted, marginTop: 2 }]}>
                        {opt.sublabel}
                      </Text>
                    ) : null}
                  </View>
                  {selected ? (
                    <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  backdropTouch: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxl,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    gap: Spacing.md,
  },
});
