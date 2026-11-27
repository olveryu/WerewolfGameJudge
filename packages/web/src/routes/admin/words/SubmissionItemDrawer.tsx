/** Server review evidence is presented separately from untrusted agent material and human decisions. */
import type { WordSubmissionItem } from '@game-judge/game-engine/product/wordSupply';
import { useQuery } from '@tanstack/react-query';

import type { WordLibraryItem } from '@/features/admin/model/adminContracts';
import { adminQueryOptions } from '@/features/admin/queries/adminQueryOptions';
import { wordSubmissionsApi } from '@/features/admin/services/wordSubmissionsApi';
import { gameDisplayName } from '@/games/catalog';

import { DetailDrawer } from '../components/Overlays';
import { AsyncBoundary, StatusBadge } from '../components/Primitives';
import type { SubmissionConfirmation } from './SubmissionActionDialog';
import { useSubmissionCommand } from './useSubmissionCommand';
import {
  isApprovableSubmission,
  isEndorsableSubmission,
  isSelectableSubmission,
  isUnendorsableSubmission,
  SUBMISSION_STATUS_LABELS,
  SubmissionStatus,
} from './wordLabels';

const ACTION_LABELS: Readonly<Record<string, string>> = {
  ...SUBMISSION_STATUS_LABELS,
  review: '启动独立审核',
  approve: '人工通过',
  endorse: '批准进入审核',
  unendorse: '撤回批准',
  publish: '发布',
  dismiss: '拒绝',
  unpublish: '下架',
};

const MATERIAL_LABELS: Readonly<Record<string, string>> = {
  word: '词语',
  wordA: '词语 A',
  wordB: '词语 B',
  definition: '释义',
  coreMeaning: '核心含义',
  usageNote: '适用语境',
  category: '分类',
  topic: '主题',
  difficulty: '绘画难度',
  potentialIssues: '潜在问题',
  commonTraits: '共同描述',
  differences: '区别描述',
  references: 'Agent 提供的参考链接（未独立验证）',
  url: '链接',
  note: '说明',
  evidence: '独立检索资料',
  evidenceQuote: '审核引用',
  evidenceIndex: '资料编号',
  query: '检索词',
  title: '标题',
  content: '原文',
};
const CHECK_LABELS: Readonly<Record<string, string>> = {
  isEstablishedTerm: '真实词项',
  isDefinitionAccurate: '释义准确',
  isMeaningUnfamiliarToMostPlayers: '真义陌生',
  isMeaningDistinctFromLiteralReading: '字面不泄底',
  hasMultiplePlausibleWrongDefinitions: '假释义空间',
  hasRevealValue: '揭晓价值',
  isConcreteAndDrawable: '画法明确',
  isSimplifiedChinese: '简体中文',
  isLengthValid: '字数合规',
  isCategoryAccurate: '分类准确',
  isAppropriate: '内容适宜',
  isUnambiguous: '无严重歧义',
  isFamiliar: '词语常见',
  hasSimilarFamiliarity: '熟悉度相近',
  hasSharedDescriptions: '有共同描述',
  hasDistinctDescriptions: '有区别描述',
  isNotSynonymOrSubset: '不是同义或包含关系',
  isPlayableBothWays: '双向可玩',
  isFactuallyCertain: '事实明确',
};

function MaterialValue({ value }: { value: unknown }) {
  if (value === null) return <span className="admin-muted">未提供</span>;
  if (Array.isArray(value))
    return value.length === 0 ? (
      <span className="admin-muted">无</span>
    ) : (
      <ul>
        {value.map((entry: unknown, index) => (
          <li key={index}>
            <MaterialValue value={entry} />
          </li>
        ))}
      </ul>
    );
  if (typeof value === 'object')
    return (
      <dl className="admin-submission-material">
        {Object.entries(value).map(([key, entry]: [string, unknown]) => (
          <div key={key}>
            <dt>{MATERIAL_LABELS[key] ?? key}</dt>
            <dd>
              <MaterialValue value={entry} />
            </dd>
          </div>
        ))}
      </dl>
    );
  return (
    <span>
      {typeof value === 'boolean'
        ? value
          ? '是'
          : '否'
        : typeof value === 'string'
          ? value
          : JSON.stringify(value)}
    </span>
  );
}

/** Contextual actions remain in the drawer footer when long source text is expanded. */
export function SubmissionItemDrawer({
  batchId,
  item,
  onClose,
  onAction,
}: {
  batchId: string;
  item: WordLibraryItem;
  onClose: () => void;
  onAction: (confirmation: SubmissionConfirmation) => void;
}) {
  const batchQuery = useQuery(
    adminQueryOptions('word-submissions', { kind: 'batch', batch: batchId }, (signal) =>
      wordSubmissionsApi.batch(batchId, signal),
    ),
  );
  const audit = useQuery(
    adminQueryOptions('word-submissions', { kind: 'audit', batch: batchId }, (signal) =>
      wordSubmissionsApi.audit(batchId, signal),
    ),
  );
  // The stream row is a summary: resolve the full item (material, review
  // verdict, review id) from its batch. Footer actions wait for the batch;
  // the row alone cannot carry them (it has no material or review id).
  const fullItem = batchQuery.data?.items.find((entry) => entry.id === item.id);
  const act = (action: SubmissionConfirmation['action'], target: WordSubmissionItem) =>
    onAction({ action, items: [target] });
  return (
    <DetailDrawer
      title="词条详情"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose}>
            关闭
          </button>
          {fullItem !== undefined && (
            <>
              {isSelectableSubmission(fullItem) && (
                <button
                  type="button"
                  className="admin-error"
                  onClick={() => act('dismiss', fullItem)}
                >
                  拒绝此条…
                </button>
              )}
              {['approved', 'failed'].includes(fullItem.status) && (
                <button
                  type="button"
                  className="admin-primary"
                  onClick={() => act('review', fullItem)}
                >
                  {fullItem.status === 'failed' ? '重试审核…' : '启动审核…'}
                </button>
              )}
              {fullItem.status === 'passed' && (
                <button
                  type="button"
                  className="admin-primary"
                  onClick={() => act('publish', fullItem)}
                >
                  确认发布…
                </button>
              )}
              {isEndorsableSubmission(fullItem) && (
                <button type="button" onClick={() => act('endorse', fullItem)}>
                  批准进入审核…
                </button>
              )}
              {isUnendorsableSubmission(fullItem) && (
                <button type="button" onClick={() => act('unendorse', fullItem)}>
                  撤回批准…
                </button>
              )}
              {isApprovableSubmission(fullItem) && (
                <button type="button" onClick={() => act('approve', fullItem)}>
                  人工通过…
                </button>
              )}
              {['rejected', 'passed'].includes(fullItem.status) && (
                <button type="button" onClick={() => act('review', fullItem)}>
                  重新审核…
                </button>
              )}
              {fullItem.status === 'published' && (
                <button
                  type="button"
                  className="admin-error"
                  onClick={() => act('unpublish', fullItem)}
                >
                  下架…
                </button>
              )}
            </>
          )}
        </>
      }
    >
      <AsyncBoundary query={batchQuery}>
        {(loadedBatch) => {
          const resolved = loadedBatch.items.find((entry) => entry.id === item.id);
          if (resolved === undefined) return <p className="admin-muted">该词条已不在此批次中。</p>;
          return (
            <>
              <p className="admin-muted">
                {gameDisplayName(loadedBatch.game)} / {resolved.category}
              </p>
              <h3 className="admin-submission-word">{resolved.title}</h3>
              <SubmissionStatus status={resolved.status} />
              <section className="admin-submission-detail">
                <h3>投稿材料 · Agent 提供</h3>
                <MaterialValue value={resolved.content} />
              </section>
              <SubmissionReviewDetails item={resolved} />
              <DrawerReviewDispatchNotice
                batchId={batchId}
                item={resolved}
                onRefresh={() => void batchQuery.refetch()}
              />
              <section className="admin-submission-detail">
                <h3>操作记录</h3>
                <AsyncBoundary query={audit}>
                  {(data) => (
                    <ol className="admin-submission-audit">
                      {data.events
                        .filter((entry) => entry.itemId === resolved.id)
                        .map((entry) => (
                          <li key={entry.id}>
                            <strong>
                              {entry.actor === 'shared-admin' ? '共享管理员' : '审核工作流'} ·{' '}
                              {ACTION_LABELS[entry.action] ?? entry.action}
                            </strong>
                            <p>{entry.reason}</p>
                            <small>{new Date(entry.createdAt).toLocaleString('zh-CN')}</small>
                          </li>
                        ))}
                    </ol>
                  )}
                </AsyncBoundary>
                <p className="admin-submission-note">
                  显示最近 10 次操作中的最新 100 条记录。已发布或下架的词保留原编号与来源。
                </p>
              </section>
              <p className="admin-submission-note">
                修订 {resolved.revision} · 内容指纹 {resolved.contentHash}
              </p>
            </>
          );
        }}
      </AsyncBoundary>
    </DetailDrawer>
  );
}

/** A review whose dispatch was never confirmed can be re-confirmed here
 * without starting a second review. Moved from the deleted batch detail. */
function DrawerReviewDispatchNotice({
  batchId,
  item,
  onRefresh,
}: {
  batchId: string;
  item: WordSubmissionItem;
  onRefresh: () => void;
}) {
  const dispatch = useSubmissionCommand(async (ids: string[]) => {
    for (const id of ids) await wordSubmissionsApi.dispatch(batchId, id);
    onRefresh();
  });
  if (item.status !== 'reviewing' || item.reviewId === null) return null;
  const reviewId = item.reviewId;
  return (
    <>
      <div className="admin-notice admin-submission-actions">
        <span>
          审核正在后台运行。请刷新进度；启动请求未确认时，可重新确认同一任务，不会产生第二次审核。
        </span>
        <button
          type="button"
          disabled={dispatch.isPending}
          onClick={() => dispatch.mutate([reviewId])}
        >
          确认审核任务启动
        </button>
      </div>
      {dispatch.error !== null && (
        <p role="alert" className="admin-error-box">
          {dispatch.error.message}
        </p>
      )}
    </>
  );
}

function SubmissionReviewDetails({ item }: { item: WordSubmissionItem }) {
  return (
    <section className="admin-submission-detail">
      <h3>独立审核</h3>
      {item.review === null ? (
        item.failure !== null ? (
          <>
            <p role="alert">
              {item.approvalReason !== null
                ? '独立审核未完成；已记录人工通过。发布仍需单独确认。'
                : '独立审核未完成，不代表词条不合格。可重试审核，或核对材料后人工通过，再单独发布。'}
            </p>
            <p className="admin-submission-note">诊断码：{item.failure}</p>
          </>
        ) : (
          <p>
            {item.status === 'reviewing'
              ? '审核在后台进行，请刷新查看进度。'
              : '尚无模型审核结果。'}
          </p>
        )
      ) : (
        <>
          <p>原模型结论：{item.review.passed ? '通过' : '未通过'}。人工操作不会覆盖此结论。</p>
          <ul className="admin-submission-checks">
            {Object.entries(item.review.checks).map(([key, passed]) => (
              <li key={key}>
                <span>{CHECK_LABELS[key] ?? key}</span>
                <StatusBadge tone={passed ? 'success' : 'danger'}>
                  {passed ? '通过' : '未通过'}
                </StatusBadge>
              </li>
            ))}
          </ul>
          <p>{item.review.reason}</p>
          {Object.keys(item.review.details).length > 0 && (
            <details className="admin-submission-detail">
              <summary>查看独立审核资料与引用</summary>
              <MaterialValue value={item.review.details} />
            </details>
          )}
        </>
      )}
      {item.reviewModel !== null && (
        <p className="admin-submission-note">
          模型：{item.reviewModel} · {item.reviewVersion}
        </p>
      )}
      {item.approvalReason !== null && (
        <p className="admin-notice">
          已人工通过；未修改原模型结论。
          {item.approvalReason.length > 0 && <>人工通过说明：{item.approvalReason}</>}
        </p>
      )}
    </section>
  );
}
