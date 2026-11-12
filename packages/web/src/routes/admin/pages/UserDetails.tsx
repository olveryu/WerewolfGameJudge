/** Recipient-scoped details and idempotent reward operations. */
import { useId } from 'react';

import type { AdminUser } from '@/features/admin/model/adminContracts';
import { useAdminRewardGrant } from '@/features/admin/queries/useAdminRewardGrant';
import { handleError } from '@/utils/errorPipeline';
import { log } from '@/utils/logger';
import IconCopyOutline from '~icons/ion/copy-outline';

import { DetailDrawer } from '../components/Overlays';
import { AsyncBoundary, DateLabel, StatTile, StatusBadge } from '../components/Primitives';

const LABELS = { normal: '普通抽', golden: '黄金抽' } as const;
const adminLog = log.extend('AdminDetails');

/** Keep uncertain grant identities intact across closing, logout and later retries. */
export function UserDetails({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const model = useAdminRewardGrant(user.id);
  const { state, rewards } = model;
  async function copyId() {
    try {
      await navigator.clipboard.writeText(user.id);
    } catch (cause: unknown) {
      handleError(cause, { label: '复制用户 ID', logger: adminLog });
    }
  }
  return (
    <DetailDrawer
      title={user.displayName ?? '匿名用户'}
      onClose={onClose}
      preventClose={model.isSubmitting}
    >
      <StatusBadge>{user.isAnonymous ? '匿名用户' : '已注册'}</StatusBadge>
      <div className="admin-stats-grid">
        <StatTile label="等级" value={user.level} />
        <StatTile label="XP" value={user.xp} />
        <StatTile label="局数" value={user.gamesPlayed} />
      </div>
      <dl className="admin-details">
        <dt>用户 ID</dt>
        <dd className="admin-copy-value">
          <code>{user.id}</code>
          <button
            type="button"
            className="admin-icon-button admin-copy-button"
            aria-label="复制用户 ID"
            onClick={() => void copyId()}
          >
            <IconCopyOutline aria-hidden />
          </button>
        </dd>
        <dt>邮箱</dt>
        <dd>{user.email ?? '未绑定'}</dd>
        <dt>地区 · 节点</dt>
        <dd>
          {user.lastCountry ?? '未知'} · {user.lastColo ?? '未知'}
        </dd>
        <dt>注册</dt>
        <dd>
          <DateLabel value={user.createdAt} />
        </dd>
        <dt>最近活跃</dt>
        <dd>
          <DateLabel value={user.updatedAt} />
        </dd>
      </dl>
      <div className="admin-section-divider" />
      <h3>发放奖励</h3>
      <AsyncBoundary query={rewards}>
        {(data) => (
          <div className="admin-stats-grid admin-balance-grid">
            <StatTile label="普通抽" value={data.normalDraws} />
            <StatTile label="黄金抽" value={data.goldenDraws} />
          </div>
        )}
      </AsyncBoundary>
      <RewardForm model={model} />
      <div className="admin-section-divider" />
      <h3>最近 20 条发放记录</h3>
      {rewards.data !== undefined && (
        <ul className="admin-reward-history">
          {rewards.data.grants.length === 0 && <li className="admin-muted">暂无发放记录</li>}
          {rewards.data.grants.map((grant) => (
            <li key={grant.id}>
              <div>
                <StatusBadge tone="success">
                  {LABELS[grant.drawType]} +{grant.count}
                </StatusBadge>
                <DateLabel value={grant.createdAt} />
              </div>
              <p>{grant.reason}</p>
              <small>
                {grant.balanceBefore} → {grant.balanceAfter} · <code>{grant.id}</code>
              </small>
            </li>
          ))}
        </ul>
      )}
      {state.kind === 'unresolved' && (
        <p className="admin-muted">请重试同一笔发放，避免重复奖励。</p>
      )}
    </DetailDrawer>
  );
}

function RewardForm({ model }: { model: ReturnType<typeof useAdminRewardGrant> }) {
  const id = useId();
  const { state } = model;
  return (
    <div className="admin-reward-form">
      {state.kind === 'draft' && (
        <>
          <div className="admin-segmented admin-reward-types" role="group" aria-label="奖励类型">
            {(['golden', 'normal'] as const).map((type) => (
              <button
                type="button"
                key={type}
                aria-pressed={model.drawType === type}
                onClick={() => model.setDrawType(type)}
              >
                {LABELS[type]}
              </button>
            ))}
          </div>
          <label htmlFor={`${id}-count`}>奖励数量</label>
          <input
            id={`${id}-count`}
            inputMode="numeric"
            value={model.count}
            onChange={(event) => model.setCount(event.target.value)}
          />
          <label htmlFor={`${id}-reason`}>发放备注</label>
          <textarea
            id={`${id}-reason`}
            maxLength={200}
            value={model.reason}
            onChange={(event) => model.setReason(event.target.value)}
          />
          <button type="button" className="admin-primary" onClick={model.review}>
            核对发放
          </button>
        </>
      )}
      {(state.kind === 'review' || state.kind === 'unresolved') && (
        <>
          <h4>{state.kind === 'review' ? '确认发放' : '待确认发放'}</h4>
          <p>
            {LABELS[state.input.drawType]} +{state.input.count}
          </p>
          <p>{state.input.reason}</p>
          <small className="admin-mono">发放编号：{state.input.id}</small>
          <button
            type="button"
            className="admin-primary"
            disabled={model.isSubmitting}
            onClick={() => void model.submit()}
          >
            {model.isSubmitting
              ? '正在发放…'
              : state.kind === 'review'
                ? '确认发放奖励'
                : '重试本次发放'}
          </button>
          {state.kind === 'review' && (
            <button type="button" onClick={model.edit}>
              返回修改
            </button>
          )}
        </>
      )}
      {state.kind === 'success' && (
        <>
          <p role="status">
            发放成功：{LABELS[state.grant.drawType]} +{state.grant.count}
          </p>
          <p>
            {state.grant.balanceBefore} → {state.grant.balanceAfter}
          </p>
          <button type="button" onClick={model.edit}>
            新建发放
          </button>
        </>
      )}
      {model.error !== null && (
        <p role="alert" className="admin-error">
          {model.error}
        </p>
      )}
    </div>
  );
}
