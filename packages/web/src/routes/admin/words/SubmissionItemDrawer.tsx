/** Server review evidence is presented separately from untrusted agent material and human decisions. */
import type {
  WordSubmissionBatch,
  WordSubmissionItem,
} from '@game-judge/game-engine/product/wordSupply';
import { useQuery } from '@tanstack/react-query';

import { adminQueryOptions } from '@/features/admin/queries/adminQueryOptions';
import { wordSubmissionsApi } from '@/features/admin/services/wordSubmissionsApi';

import { DetailDrawer } from '../components/Overlays';
import { AsyncBoundary, StatusBadge } from '../components/Primitives';
import type { SubmissionConfirmation } from './SubmissionActionDialog';
import {
  isSelectableSubmission,
  SUBMISSION_STATUS_LABELS,
  SubmissionStatus,
  WORD_GAME_LABELS,
} from './WordSections';

const ACTION_LABELS: Readonly<Record<string, string>> = {
  ...SUBMISSION_STATUS_LABELS,
  review: '启动独立审核',
  approve: '人工批准',
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
  batch,
  item,
  canReview,
  onClose,
  onAction,
}: {
  batch: WordSubmissionBatch;
  item: WordSubmissionItem;
  canReview: boolean;
  onClose: () => void;
  onAction: (confirmation: SubmissionConfirmation) => void;
}) {
  const audit = useQuery(
    adminQueryOptions('word-submissions', { kind: 'audit', batch: batch.id }, (signal) =>
      wordSubmissionsApi.audit(batch.id, signal),
    ),
  );
  const act = (action: SubmissionConfirmation['action']) => onAction({ action, items: [item] });
  return (
    <DetailDrawer
      title="词条详情"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose}>
            关闭
          </button>
          {isSelectableSubmission(item) && (
            <button type="button" className="admin-error" onClick={() => act('dismiss')}>
              拒绝此条…
            </button>
          )}
          {['pending', 'failed'].includes(item.status) && (
            <button
              type="button"
              className="admin-primary"
              disabled={!canReview}
              onClick={() => act('review')}
            >
              {item.status === 'failed' ? '重试审核…' : '启动审核…'}
            </button>
          )}
          {item.status === 'passed' && (
            <button type="button" className="admin-primary" onClick={() => act('publish')}>
              确认发布…
            </button>
          )}
          {item.status === 'rejected' && (
            <button
              type="button"
              disabled={item.review?.canOverride !== true}
              onClick={() => act('approve')}
            >
              人工批准…
            </button>
          )}
          {['rejected', 'passed'].includes(item.status) && (
            <button type="button" disabled={!canReview} onClick={() => act('review')}>
              重新审核…
            </button>
          )}
          {item.status === 'published' && (
            <button type="button" className="admin-error" onClick={() => act('unpublish')}>
              下架…
            </button>
          )}
        </>
      }
    >
      <p className="admin-muted">
        {WORD_GAME_LABELS[batch.game]} / {item.category}
      </p>
      <h3 className="admin-submission-word">{item.title}</h3>
      <SubmissionStatus status={item.status} />
      <section className="admin-submission-detail">
        <h3>投稿材料 · Agent 提供</h3>
        <MaterialValue value={item.content} />
      </section>
      <SubmissionReviewDetails item={item} />
      <section className="admin-submission-detail">
        <h3>操作记录</h3>
        <AsyncBoundary query={audit}>
          {(data) => (
            <ol className="admin-submission-audit">
              {data.events
                .filter((entry) => entry.itemId === item.id)
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
        修订 {item.revision} · 内容指纹 {item.contentHash}
      </p>
    </DetailDrawer>
  );
}

function SubmissionReviewDetails({ item }: { item: WordSubmissionItem }) {
  return (
    <section className="admin-submission-detail">
      <h3>独立审核</h3>
      {item.review === null ? (
        item.failure !== null ? (
          <>
            <p role="alert">审核未完成，不能发布。请检查服务配置、额度及下方诊断码，再手动重试。</p>
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
          {!item.review.canOverride && (
            <p className="admin-error">缺少独立证据，不能人工放行；可补充核对后重新审核。</p>
          )}
        </>
      )}
      {item.reviewModel !== null && (
        <p className="admin-submission-note">
          模型：{item.reviewModel} · {item.reviewVersion}
        </p>
      )}
      {item.approvalReason !== null && (
        <p className="admin-notice">人工批准原因：{item.approvalReason}</p>
      )}
    </section>
  );
}
