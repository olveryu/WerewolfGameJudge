/** Admin grant orchestration with persisted request identity and explicit uncertain outcomes. */
import * as Sentry from '@sentry/react-native';
import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import {
  type AdminRewardGrant,
  type AdminRewardInput,
  adminRewardInputSchema,
} from '@/features/admin/model/adminRewards';
import {
  AdminApiError,
  fetchUserRewards,
  grantUserReward,
} from '@/features/admin/services/adminApi';
import {
  clearAdminRewardOperation,
  readAdminRewardOperation,
  writeAdminRewardOperation,
} from '@/features/admin/services/adminRewardOperationStore';
import { showAlert } from '@/utils/alert';
import { log } from '@/utils/logger';

const adminLog = log.extend('AdminRewards');
type GrantState =
  | { kind: 'draft' }
  | { kind: 'review'; input: AdminRewardInput }
  | { kind: 'unresolved'; input: AdminRewardInput }
  | { kind: 'success'; grant: AdminRewardGrant };

/** Own one recipient's form, persisted retry, and authoritative reward query. */
export function useAdminRewardGrant(userId: string) {
  const [state, setState] = useState<GrantState>(() => {
    const input = readAdminRewardOperation(userId);
    return input === null ? { kind: 'draft' } : { kind: 'unresolved', input };
  });
  const [drawType, setDrawType] = useState<AdminRewardInput['drawType']>('golden');
  const [count, setCount] = useState('100');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const rewards = useQuery({
    queryKey: ['adminUserRewards', userId],
    queryFn: ({ signal }) => fetchUserRewards(userId, signal),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  function review() {
    const parsed = adminRewardInputSchema.safeParse({
      id: crypto.randomUUID(),
      drawType,
      count: Number(count),
      reason,
    });
    if (!/^\d+$/.test(count) || !parsed.success) {
      setError('数量须为 1 至 10000 的整数，备注须填写且不超过 200 字');
      return;
    }
    setError(null);
    setState({ kind: 'review', input: parsed.data });
  }

  async function submit() {
    if (isSubmittingRef.current || (state.kind !== 'review' && state.kind !== 'unresolved')) return;
    const input = state.input;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setError(null);
    try {
      writeAdminRewardOperation(userId, input);
      setState({ kind: 'unresolved', input });
      const grant = await grantUserReward(userId, input);
      clearAdminRewardOperation(userId);
      setState({ kind: 'success', grant });
      void rewards.refetch();
    } catch (cause) {
      if (cause instanceof AdminApiError && [400, 401, 403, 404, 409].includes(cause.status)) {
        if (cause.status !== 401 && cause.status !== 403) {
          clearAdminRewardOperation(userId);
          setState({ kind: 'draft' });
        }
        const message =
          cause.status === 401 || cause.status === 403
            ? '管理员验证失败，请重新登录'
            : cause.status === 404
              ? '用户不存在'
              : cause.status === 409
                ? '发放编号冲突，请核对发放记录'
                : '发放参数无效，请检查数量和备注';
        adminLog.warn('Grant rejected', cause);
        setError(message);
        showAlert('发放失败', message);
      } else {
        adminLog.error('Grant outcome unconfirmed', cause);
        Sentry.captureException(cause);
        setError('尚未确认到账结果，请重试本次发放');
        showAlert('发放结果待确认', '请重试本次发放，不要新建相同奖励');
      }
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  function edit() {
    if (state.kind === 'unresolved' || isSubmittingRef.current) return;
    setError(null);
    setState({ kind: 'draft' });
  }

  return {
    state,
    drawType,
    setDrawType,
    count,
    setCount,
    reason,
    setReason,
    error,
    isSubmitting,
    rewards,
    review,
    submit,
    edit,
  };
}
