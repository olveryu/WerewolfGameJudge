/** Recipient-scoped admin reward dialog; mutations are owned by useAdminRewardGrant. */
import { Ionicons } from '@expo/vector-icons';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BaseCenterModal } from '@/components/BaseCenterModal';
import { Button } from '@/components/Button';
import type { AdminUser } from '@/features/admin/model/adminContracts';
import type { AdminRewardGrant } from '@/features/admin/model/adminRewards';
import { useAdminRewardGrant } from '@/features/admin/queries/useAdminRewardGrant';
import { borderRadius, colors, spacing, typography } from '@/theme';
import { componentSizes } from '@/theme/tokens';

const DRAW_LABELS = { normal: '普通抽', golden: '黄金抽' } as const;

function renderGrant({ item }: { item: AdminRewardGrant }) {
  return (
    <View style={styles.historyRow}>
      <Text style={styles.label}>
        {DRAW_LABELS[item.drawType]} +{item.count}
      </Text>
      <Text style={styles.meta}>
        {item.balanceBefore} → {item.balanceAfter} · {new Date(item.createdAt).toLocaleString()}
      </Text>
      <Text style={styles.text}>{item.reason}</Text>
      <Text selectable style={styles.meta}>
        {item.id}
      </Text>
    </View>
  );
}

/** Render balances, explicit grant confirmation, and the latest audit records. */
export function UserRewardsModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const model = useAdminRewardGrant(user.id);
  const { state, rewards } = model;
  const handleClose = () => {
    if (!model.isSubmitting) onClose();
  };

  return (
    <BaseCenterModal visible onClose={handleClose} contentStyle={styles.modal}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          发放奖励
        </Text>
        <Button variant="icon" accessibilityLabel="关闭奖励窗口" onPress={handleClose}>
          <Ionicons name="close" size={componentSizes.icon.md} color={colors.text} />
        </Button>
      </View>
      <ScrollView style={styles.formScroll} contentContainerStyle={styles.form}>
        <Text style={styles.label}>{user.displayName ?? '匿名用户'}</Text>
        <Text selectable style={styles.meta}>
          用户 ID：{user.id}
        </Text>
        {rewards.isError ? (
          <View style={styles.form}>
            <Text accessibilityRole="alert" style={styles.error}>
              读取余额和记录失败
            </Text>
            <Button
              variant="secondary"
              loading={rewards.isFetching}
              onPress={() => void rewards.refetch()}
            >
              重新读取
            </Button>
          </View>
        ) : rewards.data === undefined ? (
          <Text style={styles.meta}>正在读取余额...</Text>
        ) : (
          <Text style={styles.text}>
            普通抽：{rewards.data.normalDraws} / 黄金抽：{rewards.data.goldenDraws}
          </Text>
        )}
        {state.kind === 'draft' && (
          <>
            <Text style={styles.label}>奖励类型</Text>
            <View accessibilityRole="radiogroup" style={styles.row}>
              {(['golden', 'normal'] as const).map((drawType) => (
                <Pressable
                  key={drawType}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: model.drawType === drawType }}
                  accessibilityLabel={DRAW_LABELS[drawType]}
                  style={styles.choice}
                  onPress={() => model.setDrawType(drawType)}
                >
                  <Ionicons
                    name={model.drawType === drawType ? 'radio-button-on' : 'radio-button-off'}
                    size={componentSizes.icon.md}
                    color={colors.primary}
                  />
                  <Text style={styles.text}>{DRAW_LABELS[drawType]}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>数量</Text>
            <TextInput
              accessibilityLabel="奖励数量"
              keyboardType="number-pad"
              value={model.count}
              onChangeText={model.setCount}
              style={styles.input}
            />
            <Text style={styles.label}>发放备注</Text>
            <TextInput
              accessibilityLabel="发放备注"
              value={model.reason}
              onChangeText={model.setReason}
              maxLength={200}
              multiline
              style={[styles.input, styles.reason]}
            />
            <Button onPress={model.review}>核对发放</Button>
          </>
        )}
        {(state.kind === 'review' || state.kind === 'unresolved') && (
          <View style={styles.form}>
            <Text style={styles.label}>{state.kind === 'review' ? '确认发放' : '待确认发放'}</Text>
            <Text style={styles.text}>
              {DRAW_LABELS[state.input.drawType]} +{state.input.count}
            </Text>
            <Text style={styles.text}>{state.input.reason}</Text>
            <Text selectable style={styles.meta}>
              发放编号：{state.input.id}
            </Text>
            <Button loading={model.isSubmitting} onPress={() => void model.submit()}>
              {state.kind === 'review' ? '确认发放奖励' : '重试本次发放'}
            </Button>
            {state.kind === 'review' && (
              <Button variant="ghost" onPress={model.edit}>
                返回修改
              </Button>
            )}
          </View>
        )}
        {state.kind === 'success' && (
          <View style={styles.form}>
            <Text accessibilityRole="alert" style={styles.label}>
              发放成功：{DRAW_LABELS[state.grant.drawType]} +{state.grant.count}
            </Text>
            <Text style={styles.text}>
              本次发放余额：{state.grant.balanceBefore} → {state.grant.balanceAfter}
            </Text>
            <Button variant="secondary" onPress={model.edit}>
              新建发放
            </Button>
          </View>
        )}
        {model.error !== null && (
          <Text accessibilityRole="alert" style={styles.error}>
            {model.error}
          </Text>
        )}
      </ScrollView>
      <Text style={styles.historyTitle}>最近 20 条发放记录</Text>
      {rewards.data !== undefined && !rewards.isError && (
        <FlatList
          style={styles.history}
          data={rewards.data.grants}
          renderItem={renderGrant}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.meta}>暂无发放记录</Text>}
        />
      )}
    </BaseCenterModal>
  );
}

const styles = StyleSheet.create({
  modal: { width: '94%', maxWidth: 560, maxHeight: '92%', padding: spacing.medium },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.small,
  },
  title: { fontSize: typography.subtitle, fontWeight: typography.weights.bold, color: colors.text },
  formScroll: { flexShrink: 1 },
  form: { gap: spacing.small },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.small },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tight,
    minHeight: componentSizes.button.md,
  },
  label: { fontSize: typography.body, fontWeight: typography.weights.semibold, color: colors.text },
  text: { fontSize: typography.caption, color: colors.text },
  meta: { fontSize: typography.captionSmall, color: colors.textSecondary },
  error: { fontSize: typography.caption, color: colors.error },
  input: {
    minHeight: componentSizes.button.md,
    backgroundColor: colors.background,
    color: colors.text,
    borderRadius: borderRadius.medium,
    padding: spacing.small,
    fontSize: typography.body,
  },
  reason: { minHeight: componentSizes.button.md * 2, textAlignVertical: 'top' },
  historyTitle: {
    fontSize: typography.body,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginVertical: spacing.small,
  },
  history: { maxHeight: 180, flexShrink: 1 },
  historyRow: { paddingVertical: spacing.small, gap: spacing.micro },
});
