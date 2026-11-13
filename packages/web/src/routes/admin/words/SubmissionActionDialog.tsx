/** Human confirmation binds the selected content snapshot and retains one request id for retries. */
import type {
  WordSubmissionAction,
  WordSubmissionItem,
} from '@game-judge/game-engine/product/wordSupply';
import { useId, useState } from 'react';

import { wordSubmissionsApi } from '@/features/admin/services/wordSubmissionsApi';

import { DetailDrawer } from '../components/Overlays';
import { useSubmissionCommand } from './useSubmissionCommand';

const SUBMISSION_ACTION_LABELS = {
  review: '启动独立审核',
  publish: '确认发布',
  dismiss: '拒绝候选',
  approve: '人工批准',
  unpublish: '下架词条',
} as const;
export interface SubmissionConfirmation {
  readonly action: WordSubmissionAction['action'];
  readonly items: readonly WordSubmissionItem[];
}

/** Repeated confirmation never manufactures a fresh command after an uncertain network result. */
export function SubmissionActionDialog({
  batchId,
  confirmation,
  onClose,
  onComplete,
}: {
  batchId: string;
  confirmation: SubmissionConfirmation;
  onClose: () => void;
  onComplete: () => void;
}) {
  const formId = useId();
  const [reason, setReason] = useState('');
  const [request, setRequest] = useState<WordSubmissionAction | null>(null);
  const [validation, setValidation] = useState('');
  const command = useSubmissionCommand(async (input: WordSubmissionAction) => {
    await wordSubmissionsApi.action(batchId, input);
    onComplete();
  });
  const needsReason = ['dismiss', 'approve', 'unpublish'].includes(confirmation.action);
  const title = SUBMISSION_ACTION_LABELS[confirmation.action];
  return (
    <DetailDrawer
      variant="sheet"
      title={title}
      onClose={onClose}
      preventClose={command.isPending}
      footer={
        <>
          <button type="button" disabled={command.isPending} onClick={onClose}>
            取消
          </button>
          <button
            type="submit"
            form={formId}
            className="admin-primary"
            disabled={command.isPending}
          >
            {command.isPending
              ? '正在处理…'
              : request !== null && command.error !== null
                ? '重试同一请求'
                : `${title} (${confirmation.items.length})`}
          </button>
        </>
      }
    >
      <form
        id={formId}
        className="admin-submission-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (needsReason && reason.trim().length === 0) {
            setValidation('请填写具体原因。');
            return;
          }
          const input = request ?? {
            id: crypto.randomUUID(),
            action: confirmation.action,
            reason: reason.trim(),
            items: confirmation.items.map((item) => ({
              id: item.id,
              contentHash: item.contentHash,
              revision: item.revision,
            })),
          };
          setValidation('');
          setRequest(input);
          command.mutate(input);
        }}
      >
        <p>
          {confirmation.action === 'review'
            ? '按分类分组调用现有独立审核器，消耗共享模型额度。审核不会自动发布；预算不足或服务故障可能使部分候选失败，请刷新查看。'
            : confirmation.action === 'publish'
              ? '这些词条将进入游戏可抽词库。只发布当前内容和当前审核版本，操作会留下记录。'
              : confirmation.action === 'approve'
                ? '保留原模型结论，并记录本次人工判断。批准后仍须单独确认发布。'
                : confirmation.action === 'unpublish'
                  ? '停止抽取，不删除词条、稳定编号、来源和账号已见历史。'
                  : '关闭这些候选，不会修改任何线上词语。'}
        </p>
        <ul>
          {confirmation.items.map((item) => (
            <li key={item.id}>{item.title}</li>
          ))}
        </ul>
        {needsReason && (
          <label>
            操作原因
            <textarea
              required
              maxLength={1000}
              rows={3}
              value={reason}
              disabled={request !== null}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
        )}
        {validation && (
          <p role="alert" className="admin-error-box">
            {validation}
          </p>
        )}
        {command.error !== null && (
          <p role="alert" className="admin-error-box">
            操作未确认：{command.error.message}
            。可以重试同一请求；如选择已过期，请关闭并刷新批次后重新选择。
          </p>
        )}
        {request !== null && <p className="admin-submission-note">请求标识：{request.id}</p>}
      </form>
    </DetailDrawer>
  );
}
