/** Recipient-scoped admin reward dialog; mutations are owned by useAdminRewardGrant. */
import './AdminTabs.css';

import { useId } from 'react';

import { Button } from '@/components/Button';
import { CenterDialog } from '@/components/CenterDialog';
import { IconButton } from '@/components/IconButton';
import type { AdminUser } from '@/features/admin/model/adminContracts';
import { useAdminRewardGrant } from '@/features/admin/queries/useAdminRewardGrant';
import IconClose from '~icons/ion/close';

const DRAW_LABELS = { normal: '普通抽', golden: '黄金抽' } as const;
const DRAW_TYPE_ORDER = ['golden', 'normal'] as const;

/** Renders balances, explicit grant confirmation, and the latest audit records. */
export function UserRewardsModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const model = useAdminRewardGrant(user.id);
  const { state, rewards } = model;
  const radioName = useId();

  const handleClose = () => {
    if (!model.isSubmitting) onClose();
  };

  return (
    <CenterDialog open onClose={handleClose} title="发放奖励">
      <div className="admin-rewards">
        <div className="admin-rewards-header">
          <div className="admin-rewards-user">
            <span className="admin-card-name">{user.displayName ?? '匿名用户'}</span>
            <span className="admin-card-meta">用户 ID：{user.id}</span>
          </div>
          <IconButton label="关闭奖励窗口" icon={<IconClose aria-hidden />} onClick={handleClose} />
        </div>

        <div className="admin-rewards-section">
          {rewards.isError ? (
            <>
              <p role="alert" className="admin-rewards-error">
                读取余额和记录失败
              </p>
              <Button
                variant="secondary"
                loading={rewards.isFetching}
                onClick={() => void rewards.refetch()}
              >
                重新读取
              </Button>
            </>
          ) : rewards.data === undefined ? (
            <p className="admin-card-meta">正在读取余额...</p>
          ) : (
            <p className="admin-rewards-balance">
              普通抽：{rewards.data.normalDraws} / 黄金抽：{rewards.data.goldenDraws}
            </p>
          )}
        </div>

        {state.kind === 'draft' && (
          <div className="admin-rewards-section">
            <span className="admin-rewards-label" id={`${radioName}-label`}>
              奖励类型
            </span>
            <div
              role="radiogroup"
              aria-labelledby={`${radioName}-label`}
              className="admin-reward-radios"
            >
              {DRAW_TYPE_ORDER.map((drawType) => (
                <label key={drawType} className="admin-reward-radio">
                  <input
                    type="radio"
                    name={radioName}
                    value={drawType}
                    checked={model.drawType === drawType}
                    onChange={() => model.setDrawType(drawType)}
                  />
                  {DRAW_LABELS[drawType]}
                </label>
              ))}
            </div>
            <label className="admin-rewards-label" htmlFor={`${radioName}-count`}>
              数量
            </label>
            <input
              id={`${radioName}-count`}
              className="admin-reward-field"
              aria-label="奖励数量"
              inputMode="numeric"
              value={model.count}
              onChange={(event) => model.setCount(event.target.value)}
            />
            <label className="admin-rewards-label" htmlFor={`${radioName}-reason`}>
              发放备注
            </label>
            <textarea
              id={`${radioName}-reason`}
              className="admin-reward-field"
              aria-label="发放备注"
              maxLength={200}
              value={model.reason}
              onChange={(event) => model.setReason(event.target.value)}
            />
            <Button onClick={model.review}>核对发放</Button>
          </div>
        )}

        {(state.kind === 'review' || state.kind === 'unresolved') && (
          <div className="admin-rewards-section">
            <span className="admin-rewards-label">
              {state.kind === 'review' ? '确认发放' : '待确认发放'}
            </span>
            <p className="admin-rewards-balance">
              {DRAW_LABELS[state.input.drawType]} +{state.input.count}
            </p>
            <p className="admin-card-detail">{state.input.reason}</p>
            <p className="admin-card-meta">发放编号：{state.input.id}</p>
            <Button loading={model.isSubmitting} onClick={() => void model.submit()}>
              {state.kind === 'review' ? '确认发放奖励' : '重试本次发放'}
            </Button>
            {state.kind === 'review' && (
              <Button variant="ghost" onClick={model.edit}>
                返回修改
              </Button>
            )}
          </div>
        )}

        {state.kind === 'success' && (
          <div className="admin-rewards-section">
            <p role="alert" className="admin-rewards-success">
              发放成功：{DRAW_LABELS[state.grant.drawType]} +{state.grant.count}
            </p>
            <p className="admin-card-detail">
              本次发放余额：{state.grant.balanceBefore} → {state.grant.balanceAfter}
            </p>
            <Button variant="secondary" onClick={model.edit}>
              新建发放
            </Button>
          </div>
        )}

        {model.error !== null && (
          <p role="alert" className="admin-rewards-error">
            {model.error}
          </p>
        )}

        <h3 className="admin-tab-section-title">最近 20 条发放记录</h3>
        {rewards.data !== undefined &&
          !rewards.isError &&
          (rewards.data.grants.length === 0 ? (
            <p className="admin-card-meta">暂无发放记录</p>
          ) : (
            <ul className="admin-reward-history">
              {rewards.data.grants.map((grant) => (
                <li key={grant.id} className="admin-reward-history-row">
                  <span className="admin-rewards-label">
                    {DRAW_LABELS[grant.drawType]} +{grant.count}
                  </span>
                  <span className="admin-card-meta">
                    {grant.balanceBefore} → {grant.balanceAfter} ·{' '}
                    {new Date(grant.createdAt).toLocaleString()}
                  </span>
                  <span className="admin-card-detail">{grant.reason}</span>
                  <span className="admin-card-meta">{grant.id}</span>
                </li>
              ))}
            </ul>
          ))}
      </div>
    </CenterDialog>
  );
}
