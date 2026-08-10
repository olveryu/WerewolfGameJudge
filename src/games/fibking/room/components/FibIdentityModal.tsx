/** FibKing identity and ended-round result inside the shared centered modal primitive. */

import Ionicons from '@expo/vector-icons/Ionicons';
import type { FibRoundView } from '@game-judge/game-engine/games/fibking/public';
import type React from 'react';
import { memo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BaseCenterModal } from '@/components/BaseCenterModal';
import { Button } from '@/components/Button';
import { formatRoomSeat } from '@/features/room/model/RoomSeatDataSource';
import { TESTIDS } from '@/testids';
import {
  borderRadius,
  colors,
  componentSizes,
  fixed,
  spacing,
  typography,
  withAlpha,
} from '@/theme';

import { getFibRoleName } from '../fibRoomAdapter';
import { formatFibWordPinyin } from '../formatFibWordPinyin';

interface FibIdentityModalProps {
  readonly view: FibRoundView;
  readonly onClose: () => void;
}

function getRoleInstruction(view: FibRoundView): string {
  if (view.phase === 'ended') return '本轮身份与真实释义已经公开。';
  if (view.viewerRole === null) return '观战时可以查看本轮词语和真实释义。';
  switch (view.viewerRole) {
    case 'guesser':
      return '听取其他玩家的描述，找出真实释义。';
    case 'honest':
      return '用自己的话描述真实释义，不要直接念出答案。';
    case 'fibber':
      return '编出可信的释义，让大聪明难以分辨。';
  }
}

const FibIdentityModalComponent: React.FC<FibIdentityModalProps> = ({ view, onClose }) => {
  const isSpectator = view.phase === 'ongoing' && view.viewerRole === null;
  const roleName =
    view.phase === 'ended'
      ? '公开结果'
      : view.viewerRole === null
        ? '观战视角'
        : getFibRoleName(view.viewerRole);
  const eyebrow = view.phase === 'ended' ? '本轮结果' : isSpectator ? '本轮题目' : '你的身份';
  const wordPinyin = formatFibWordPinyin(view.word);
  return (
    <BaseCenterModal
      visible
      onClose={onClose}
      dismissOnOverlayPress
      contentStyle={styles.modal}
      testID={TESTIDS.fibIdentityModal}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headingRow}>
          <View style={styles.roleIcon}>
            <Ionicons name="eye-outline" size={componentSizes.icon.md} color={colors.primary} />
          </View>
          <View style={styles.headingText}>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <Text style={styles.roleName} testID={TESTIDS.fibIdentityRole}>
              {roleName}
            </Text>
          </View>
        </View>

        <Text style={styles.instruction}>{getRoleInstruction(view)}</Text>

        <View style={styles.wordSection}>
          <Text style={styles.sectionLabel}>本轮词语</Text>
          <Text style={styles.word} testID={TESTIDS.fibIdentityWord}>
            {view.word}
          </Text>
          {wordPinyin !== null && (
            <Text style={styles.pinyin} testID={TESTIDS.fibIdentityPinyin}>
              {wordPinyin}
            </Text>
          )}
        </View>

        {view.definition !== null && (
          <View style={styles.definitionSection} testID={TESTIDS.fibIdentityDefinition}>
            <View>
              <Text style={styles.sectionLabel}>核心释义</Text>
              <Text style={styles.definition} testID={TESTIDS.fibIdentityCoreMeaning}>
                {view.definition.coreMeaning}
              </Text>
            </View>
            <View style={styles.usageNoteSection}>
              <Text style={styles.sectionLabel}>使用提示</Text>
              <Text style={styles.definition} testID={TESTIDS.fibIdentityUsageNote}>
                {view.definition.usageNote}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.assignmentSection}>
          <Text style={styles.sectionLabel}>公开身份</Text>
          <Text style={styles.assignment}>{formatRoomSeat(view.guesserSeat)} · 大聪明</Text>
          {view.honestSeat !== null && (
            <>
              <Text style={styles.assignment}>{formatRoomSeat(view.honestSeat)} · 老实人</Text>
              <Text style={styles.assignmentMuted}>其余座位 · 瞎掰王</Text>
            </>
          )}
        </View>

        <Button variant="primary" size="lg" onPress={onClose} style={styles.closeButton}>
          知道了
        </Button>
      </ScrollView>
    </BaseCenterModal>
  );
};

export const FibIdentityModal = memo(FibIdentityModalComponent);

const styles = StyleSheet.create({
  modal: {
    width: 420,
    maxWidth: '92%',
    maxHeight: '86%',
    padding: 0,
    overflow: 'hidden',
  },
  content: {
    padding: spacing.large,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleIcon: {
    width: componentSizes.avatar.lg,
    height: componentSizes.avatar.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: componentSizes.avatar.lg / 2,
    backgroundColor: withAlpha(colors.primary, 0.08),
    marginRight: spacing.medium,
  },
  headingText: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: typography.caption,
    lineHeight: typography.caption * 1.4,
    color: colors.textMuted,
  },
  roleName: {
    marginTop: spacing.micro,
    fontSize: typography.title,
    lineHeight: typography.title * 1.3,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  instruction: {
    marginTop: spacing.medium,
    fontSize: typography.secondary,
    lineHeight: typography.secondary * 1.55,
    color: colors.textSecondary,
  },
  wordSection: {
    marginTop: spacing.large,
    paddingVertical: spacing.medium,
    borderTopWidth: fixed.borderWidth,
    borderBottomWidth: fixed.borderWidth,
    borderColor: colors.borderLight,
  },
  sectionLabel: {
    fontSize: typography.caption,
    lineHeight: typography.caption * 1.4,
    fontWeight: typography.weights.semibold,
    color: colors.textMuted,
  },
  word: {
    marginTop: spacing.tight,
    fontSize: typography.heading,
    lineHeight: typography.heading * 1.3,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  pinyin: {
    marginTop: spacing.micro,
    fontSize: typography.secondary,
    lineHeight: typography.secondary * 1.45,
    color: colors.textSecondary,
  },
  definitionSection: {
    marginTop: spacing.medium,
    padding: spacing.medium,
    borderRadius: borderRadius.small,
    backgroundColor: withAlpha(colors.success, 0.08),
  },
  definition: {
    marginTop: spacing.tight,
    fontSize: typography.body,
    lineHeight: typography.body * 1.6,
    color: colors.text,
  },
  usageNoteSection: {
    marginTop: spacing.medium,
    paddingTop: spacing.medium,
    borderTopWidth: fixed.borderWidth,
    borderTopColor: colors.borderLight,
  },
  assignmentSection: {
    marginTop: spacing.large,
  },
  assignment: {
    marginTop: spacing.small,
    fontSize: typography.secondary,
    lineHeight: typography.secondary * 1.45,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  assignmentMuted: {
    marginTop: spacing.small,
    fontSize: typography.secondary,
    lineHeight: typography.secondary * 1.45,
    color: colors.textSecondary,
  },
  closeButton: {
    marginTop: spacing.large,
  },
});
