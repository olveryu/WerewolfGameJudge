/**
 * FibConfigScreen — 瞎掰王 人数设置。
 *
 * Create mode (no existingRoomCode): pick player count → createRoom → FibRoom.
 * Edit mode (existingRoomCode): host changes player count in Lobby → updateConfig.
 */
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type React from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ScreenHeader';
import { useAuthContext } from '@/contexts/AuthContext';
import { useFibFacade } from '@/contexts/FibFacadeContext';
import type { RootStackParamList } from '@/navigation/types';
import { borderRadius, colors, spacing, typography } from '@/theme';
import { showAlert } from '@/utils/alert';

const MIN = 4;
const MAX = 8;

type Props = NativeStackScreenProps<RootStackParamList, 'FibConfig'>;

const FibConfigScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const facade = useFibFacade();
  const { user } = useAuthContext();
  const existingRoomCode = route.params?.existingRoomCode;
  const [count, setCount] = useState<number>(
    existingRoomCode ? (facade.getState()?.numberOfPlayers ?? 5) : 5,
  );
  const [busy, setBusy] = useState(false);

  const onConfirm = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      if (existingRoomCode) {
        const result = await facade.updateConfig(count);
        if (!result.success) {
          showAlert('修改失败', result.reason ?? '请稍后重试');
          return;
        }
        navigation.goBack();
      } else {
        if (!user?.id) {
          showAlert('请先登录');
          return;
        }
        const roomCode = await facade.createRoom({ numberOfPlayers: count }, user.id);
        navigation.replace('FibRoom', { roomCode, isHost: true });
      }
    } catch {
      showAlert('创建失败', '请稍后重试');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={existingRoomCode ? '修改人数' : '瞎掰王 · 设置'}
        onBack={() => navigation.goBack()}
        topInset={insets.top}
      />
      <View style={styles.body}>
        <Text style={styles.label}>玩家人数</Text>
        <View style={styles.stepper}>
          <Pressable
            style={[styles.stepBtn, count <= MIN && styles.stepBtnDisabled]}
            onPress={() => setCount((c) => Math.max(MIN, c - 1))}
            testID="fib-count-dec"
          >
            <Text style={styles.stepBtnText}>−</Text>
          </Pressable>
          <Text style={styles.count} testID="fib-count">
            {count}
          </Text>
          <Pressable
            style={[styles.stepBtn, count >= MAX && styles.stepBtnDisabled]}
            onPress={() => setCount((c) => Math.min(MAX, c + 1))}
            testID="fib-count-inc"
          >
            <Text style={styles.stepBtnText}>＋</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>4–8 人,推荐 5–6 人。每轮 1 大聪明 + 1 老实人 + 其余瞎掰王。</Text>
      </View>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.medium }]}>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => void onConfirm()}
          testID="fib-config-confirm"
        >
          <Text style={styles.primaryBtnText}>{existingRoomCode ? '保存' : '创建房间'}</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, padding: spacing.screenH, alignItems: 'center', gap: spacing.large },
  label: {
    marginTop: spacing.xlarge,
    fontSize: typography.subtitle,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.large },
  stepBtn: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: { opacity: 0.4 },
  stepBtnText: { fontSize: typography.heading, color: colors.primary },
  count: {
    minWidth: 64,
    textAlign: 'center',
    fontSize: typography.display,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  hint: {
    fontSize: typography.secondary,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.medium,
  },
  footer: { padding: spacing.screenH },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.large,
    paddingVertical: spacing.medium,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: typography.subtitle,
    fontWeight: typography.weights.semibold,
    color: colors.textInverse,
  },
});

export default FibConfigScreen;
