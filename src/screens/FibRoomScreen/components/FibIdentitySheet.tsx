/**
 * FibIdentitySheet — 「查看身份」 card (pure client read, no request).
 *
 * Content comes entirely from the already-broadcast FibState. Three states by role:
 * honest (word + real definition), fibber (word only), guesser (word only).
 */
import type { FibRole } from '@werewolf/game-engine/fibking/types';
import type React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Modal } from '@/components/AppModal';
import { borderRadius, colors, spacing, typography } from '@/theme';

interface FibIdentitySheetProps {
  visible: boolean;
  role: FibRole | undefined;
  word: string | undefined;
  definition: string | undefined;
  onClose: () => void;
}

interface Spec {
  emoji: string;
  title: string;
  accent: string;
  hint: string;
}

const SPEC: Record<FibRole, Spec> = {
  honest: {
    emoji: '😇',
    title: '老实人',
    accent: colors.success,
    hint: '讲真话,但可以装成在瞎掰 😏',
  },
  fibber: {
    emoji: '🤥',
    title: '瞎掰王',
    accent: colors.warning,
    hint: '编得越具体、越敢举例越唬人 🔥',
  },
  guesser: {
    emoji: '🔍',
    title: '大聪明',
    accent: colors.primary,
    hint: '看着词听大家解释,最后口头指认你认为的老实人。',
  },
};

export const FibIdentitySheet: React.FC<FibIdentitySheetProps> = ({
  visible,
  role,
  word,
  definition,
  onClose,
}) => {
  if (!role) return null;
  const spec = SPEC[role];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} testID="fib-identity-overlay">
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={[styles.title, { color: spec.accent }]}>
            {spec.emoji} {spec.title}
          </Text>
          <View style={styles.divider} />

          <Text style={styles.fieldLabel}>词</Text>
          <Text style={styles.word}>{word ?? ''}</Text>
          {role === 'honest' ? (
            <>
              <Text style={styles.fieldLabel}>真实释义</Text>
              <Text style={styles.definition}>{definition ?? ''}</Text>
            </>
          ) : (
            <Text style={styles.placeholder}>
              {role === 'guesser'
                ? '( 没有释义 —— 听大家解释后指认老实人 )'
                : '( 没有释义 —— 临场编一个 )'}
            </Text>
          )}

          <View style={styles.divider} />
          <Text style={styles.hint}>{spec.hint}</Text>
          <Pressable style={styles.closeBtn} onPress={onClose} testID="fib-identity-close">
            <Text style={styles.closeBtnText}>收起</Text>
          </Pressable>
          {role !== 'guesser' ? <Text style={styles.privacy}>看完即收,别让旁人看到</Text> : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.large,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.large,
    padding: spacing.large,
    gap: spacing.small,
    alignItems: 'center',
  },
  title: { fontSize: typography.title, fontWeight: typography.weights.bold },
  divider: { height: 1, backgroundColor: colors.borderLight, alignSelf: 'stretch' },
  fieldLabel: { fontSize: typography.caption, color: colors.textMuted },
  word: {
    fontSize: typography.hero,
    fontWeight: typography.weights.bold,
    color: colors.text,
    letterSpacing: 4,
  },
  definition: {
    fontSize: typography.body,
    color: colors.text,
    textAlign: 'center',
    lineHeight: typography.lineHeights.body,
  },
  placeholder: { fontSize: typography.body, color: colors.textMuted },
  hint: { fontSize: typography.secondary, color: colors.textSecondary, textAlign: 'center' },
  closeBtn: {
    marginTop: spacing.small,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.large,
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.xlarge,
  },
  closeBtnText: {
    fontSize: typography.body,
    fontWeight: typography.weights.semibold,
    color: colors.textInverse,
  },
  privacy: { fontSize: typography.captionSmall, color: colors.textMuted },
});
