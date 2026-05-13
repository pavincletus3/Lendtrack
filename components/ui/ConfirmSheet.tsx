import { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from 'react-i18next';
import { Type, Spacing, Radius } from '@/constants/Typography';
import { PrimaryButton } from './PrimaryButton';

interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  tone?: 'primary' | 'danger';
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  icon = 'help-circle-outline',
  tone = 'primary',
  onConfirm,
  onClose,
}: ConfirmSheetProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const accent = tone === 'danger' ? colors.danger : colors.primary;
  const accentTint = tone === 'danger' ? colors.dangerTint : colors.primaryTint;

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={busy ? undefined : onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={[styles.iconCircle, { backgroundColor: accentTint }]}>
            <Ionicons name={icon} size={28} color={accent} />
          </View>
          <Text style={[Type.titleLg, { color: colors.text, textAlign: 'center', marginTop: Spacing.lg }]}>
            {title}
          </Text>
          {message ? (
            <Text style={[Type.body, { color: colors.textMuted, textAlign: 'center', marginTop: Spacing.sm }]}>
              {message}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                label={cancelLabel ?? t('common.cancel')}
                variant="ghost"
                onPress={onClose}
                disabled={busy}
                fullWidth
              />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                label={confirmLabel ?? t('common.confirm')}
                variant={tone === 'danger' ? 'danger' : 'primary'}
                onPress={handleConfirm}
                loading={busy}
                fullWidth
              />
            </View>
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
    paddingHorizontal: Spacing.xl,
    alignItems: 'stretch',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.lg,
  },
  iconCircle: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
});
