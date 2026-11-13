/** Vendor-neutral, individually revocable credentials with one-time secret delivery. */
import {
  GAME_WORD_GAMES,
  type GameWordGame,
  type WordSubmissionAgent,
  wordSubmissionAgentInputSchema,
  type wordSubmissionIssuedCredentialSchema,
} from '@game-judge/game-engine/product/wordSupply';
import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import type { z } from 'zod';

import { API_BASE_URL } from '@/config/api';
import { adminQueryOptions } from '@/features/admin/queries/adminQueryOptions';
import { wordSubmissionsApi } from '@/features/admin/services/wordSubmissionsApi';
import { CANCEL_BUTTON, showAlert } from '@/utils/alert';
import { handleError } from '@/utils/errorPipeline';
import { log } from '@/utils/logger';

import { DetailDrawer } from '../components/Overlays';
import {
  AsyncBoundary,
  DataTable,
  DateLabel,
  PageHeading,
  Panel,
  StatusBadge,
} from '../components/Primitives';
import { useSubmissionCommand } from './useSubmissionCommand';
import { WORD_GAME_LABELS, WordSections } from './WordSections';

type IssuedCredential = z.output<typeof wordSubmissionIssuedCredentialSchema>;
type AgentDialog =
  | { kind: 'new' }
  | { kind: 'detail'; id: string }
  | { kind: 'credential'; issued: IssuedCredential };
const logger = log.extend('SubmissionCredential');

/** Raw credentials live only in this mounted screen, never a query, mutation result, or storage. */
export function SubmissionAgentsPage({ game }: { game: GameWordGame }) {
  const query = useQuery(
    adminQueryOptions('word-submissions', { kind: 'agents' }, wordSubmissionsApi.agents),
  );
  const [dialog, setDialog] = useState<AgentDialog | null>(null);
  const now = query.dataUpdatedAt;
  const selected =
    dialog?.kind === 'detail'
      ? query.data?.agents.find((agent) => agent.id === dialog.id)
      : undefined;
  return (
    <>
      <PageHeading
        title="词库"
        description="独立凭证授权投稿，不授予审核或发布权限。"
        query={query}
        controls={<WordSections game={game} section="agents" />}
        action={
          <button
            type="button"
            className="admin-primary"
            onClick={() => setDialog({ kind: 'new' })}
          >
            新建授权
          </button>
        }
      />
      <div className="admin-content admin-submission-content">
        <Panel
          title="已授权的 Agent"
          description="每个助手一把独立钥匙，凭证不包含审核与发布权限。"
          flush
        >
          <AsyncBoundary query={query}>
            {(data) => (
              <>
                <DataTable
                  caption="已授权的 Agent"
                  rows={data.agents}
                  rowKey={(agent) => agent.id}
                  columns={[
                    {
                      key: 'name',
                      label: '名称 / 凭证',
                      render: (agent) => (
                        <>
                          <strong>{agent.name}</strong>
                          <small className="admin-submission-secondary">
                            {agent.credential?.prefix ?? '未签发凭证'}…
                          </small>
                        </>
                      ),
                    },
                    {
                      key: 'games',
                      label: '允许游戏',
                      secondary: true,
                      render: (agent) =>
                        agent.games.map((item) => WORD_GAME_LABELS[item]).join('、'),
                    },
                    {
                      key: 'quota',
                      label: '今日投稿',
                      secondary: true,
                      render: (agent) => `${agent.submittedToday} / ${agent.dailyQuota}`,
                    },
                    {
                      key: 'status',
                      label: '状态',
                      render: (agent) => <AgentStatus agent={agent} now={now} />,
                    },
                    {
                      key: 'expiry',
                      label: '到期',
                      secondary: true,
                      render: (agent) => <DateLabel value={agent.credential?.expiresAt ?? null} />,
                    },
                    {
                      key: 'actions',
                      label: '操作',
                      render: (agent) => (
                        <button
                          type="button"
                          className="admin-text-button"
                          aria-label={`查看 ${agent.name} 授权`}
                          onClick={() => setDialog({ kind: 'detail', id: agent.id })}
                        >
                          详情
                        </button>
                      ),
                    },
                  ]}
                />
                {data.agents.length === 0 && (
                  <p className="admin-submission-empty">
                    还没有授权。先为 Muse 或其他个人 Agent 创建独立凭证。
                  </p>
                )}
                <p className="admin-submission-note">
                  共 {data.agents.length} 个授权。更换凭证不会重置投稿额度。
                </p>
              </>
            )}
          </AsyncBoundary>
        </Panel>
        <ConnectionInstructions />
      </div>
      {dialog?.kind === 'new' && (
        <AgentCreation
          onClose={() => setDialog(null)}
          onIssued={(issued) => setDialog({ kind: 'credential', issued })}
        />
      )}
      {selected !== undefined && (
        <AgentDetails
          agent={selected}
          onClose={() => setDialog(null)}
          onIssued={(issued) => setDialog({ kind: 'credential', issued })}
        />
      )}
      {dialog?.kind === 'credential' && (
        <OneTimeCredential issued={dialog.issued} onClose={() => setDialog(null)} />
      )}
    </>
  );
}

function AgentStatus({ agent, now }: { agent: WordSubmissionAgent; now: number }) {
  const expired = agent.credential !== null && Date.parse(agent.credential.expiresAt) <= now;
  const label =
    agent.status === 'revoked'
      ? '已撤销'
      : agent.status === 'paused'
        ? '已暂停'
        : expired
          ? '已过期'
          : '有效';
  return <StatusBadge tone={label === '有效' ? 'success' : 'neutral'}>{label}</StatusBadge>;
}

function ConnectionInstructions() {
  return (
    <div className="admin-grid">
      <Panel title="凭证允许的操作" className="admin-span-6">
        <ol className="admin-submission-instructions">
          <li>
            读取字段与分类：<code>GET /v1/word-submission-spec</code>
          </li>
          <li>
            提交前预检：<code>POST /v1/word-submissions/validate</code>
          </li>
          <li>
            保存候选：<code>POST /v1/word-submissions</code>，附带唯一 Idempotency-Key。
          </li>
          <li>
            查询自己的结果：<code>GET /v1/word-submissions/:id</code>
          </li>
        </ol>
        <p className="admin-submission-note">
          接口地址：{API_BASE_URL}。使用 Authorization: Bearer YOUR_TOKEN。
        </p>
      </Panel>
      <Panel title="权限与安全" className="admin-span-6">
        <p>
          不允许启动模型审核、发布、删除线上内容或管理其他凭证。完整 Token
          只在创建或更换时显示一次。
        </p>
        <p className="admin-submission-note">
          202 仅表示已收稿。来源链接和 Agent 自评不是审核凭证；瞎掰王由服务端独立检索证据。
        </p>
        <p className="admin-submission-note">
          管理后台共用口令，审计只记录“共享管理员”，不声称识别具体操作者。
        </p>
      </Panel>
    </div>
  );
}

function AgentCreation({
  onClose,
  onIssued,
}: {
  onClose: () => void;
  onIssued: (issued: IssuedCredential) => void;
}) {
  const formId = useId();
  const [games, setGames] = useState<GameWordGame[]>([...GAME_WORD_GAMES]);
  const [days, setDays] = useState<30 | 90 | 365>(30);
  const [validationError, setValidationError] = useState('');
  const create = useSubmissionCommand(
    async (input: z.output<typeof wordSubmissionAgentInputSchema>) => {
      const issued = await wordSubmissionsApi.createAgent(input);
      onIssued(issued);
    },
  );
  return (
    <DetailDrawer
      variant="sheet"
      title="新建 Agent 授权"
      onClose={onClose}
      preventClose={create.isPending}
      footer={
        <>
          <button type="button" disabled={create.isPending} onClick={onClose}>
            取消
          </button>
          <button type="submit" form={formId} className="admin-primary" disabled={create.isPending}>
            {create.isPending ? '正在创建…' : '创建并显示凭证'}
          </button>
        </>
      }
    >
      <form
        id={formId}
        className="admin-submission-form"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const result = wordSubmissionAgentInputSchema.safeParse({
            name: data.get('name'),
            description: data.get('description'),
            games,
            expiresInDays: days,
            dailyQuota: Number(data.get('dailyQuota')),
            pendingQuota: Number(data.get('pendingQuota')),
          });
          if (!result.success) {
            setValidationError(result.error.issues.map((issue) => issue.message).join('；'));
            return;
          }
          setValidationError('');
          create.mutate(result.data);
        }}
      >
        <label>
          名称
          <input name="name" required maxLength={80} autoComplete="off" placeholder="例如 Muse" />
        </label>
        <label>
          用途说明
          <textarea name="description" maxLength={300} rows={2} />
        </label>
        <fieldset>
          <legend>允许投稿的游戏</legend>
          {GAME_WORD_GAMES.map((item) => (
            <label className="admin-submission-check" key={item}>
              <input
                type="checkbox"
                checked={games.includes(item)}
                onChange={(event) =>
                  setGames(
                    event.target.checked
                      ? [...games, item]
                      : games.filter((entry) => entry !== item),
                  )
                }
              />
              {WORD_GAME_LABELS[item]}
            </label>
          ))}
        </fieldset>
        <label>
          每日投稿上限
          <input
            name="dailyQuota"
            type="number"
            min={1}
            max={1000}
            step={1}
            defaultValue={100}
            required
          />
        </label>
        <label>
          未处理候选上限
          <input
            name="pendingQuota"
            type="number"
            min={1}
            max={1000}
            step={1}
            defaultValue={200}
            required
          />
        </label>
        <fieldset>
          <legend>有效期</legend>
          <div className="admin-segmented" role="group" aria-label="凭证有效期">
            {([30, 90, 365] as const).map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={days === value}
                onClick={() => setDays(value)}
              >
                {value} 天
              </button>
            ))}
          </div>
        </fieldset>
        <p className="admin-muted">
          仅保存凭证哈希。完整凭证请交给对应 Agent，不要共享管理员口令。
        </p>
        {(validationError || create.error !== null) && (
          <p role="alert" className="admin-error-box">
            {validationError || create.error?.message}
            。请求失败时请先刷新授权列表核对，不要连续创建。
          </p>
        )}
      </form>
    </DetailDrawer>
  );
}

function AgentDetails({
  agent,
  onClose,
  onIssued,
}: {
  agent: WordSubmissionAgent;
  onClose: () => void;
  onIssued: (issued: IssuedCredential) => void;
}) {
  const update = useSubmissionCommand(async (status: WordSubmissionAgent['status']) => {
    await wordSubmissionsApi.setAgentStatus(agent.id, status);
  });
  const rotate = useSubmissionCommand(async () => {
    const issued = await wordSubmissionsApi.rotate(agent.id, 30);
    onIssued(issued);
  });
  const busy = update.isPending || rotate.isPending;
  function confirmRevoke() {
    showAlert('撤销授权', `永久撤销 ${agent.name} 的请求权限，已有批次和审核记录仍保留。`, [
      CANCEL_BUTTON,
      { text: '撤销', style: 'destructive', onPress: () => update.mutate('revoked') },
    ]);
  }
  return (
    <DetailDrawer
      title={agent.name}
      onClose={onClose}
      preventClose={busy}
      footer={
        <>
          <button type="button" disabled={busy} onClick={onClose}>
            关闭
          </button>
          {agent.status !== 'revoked' && (
            <button type="button" className="admin-error" disabled={busy} onClick={confirmRevoke}>
              撤销授权…
            </button>
          )}
        </>
      }
    >
      <dl className="admin-details">
        <dt>用途</dt>
        <dd>{agent.description || '未填写'}</dd>
        <dt>允许游戏</dt>
        <dd>{agent.games.map((item) => WORD_GAME_LABELS[item]).join('、')}</dd>
        <dt>今日投稿</dt>
        <dd>
          {agent.submittedToday} / {agent.dailyQuota}
        </dd>
        <dt>未处理候选</dt>
        <dd>
          {agent.pending} / {agent.pendingQuota}
        </dd>
        <dt>凭证前缀</dt>
        <dd>{agent.credential?.prefix ?? '未签发'}</dd>
        <dt>到期时间</dt>
        <dd>
          {agent.credential === null
            ? '未签发'
            : new Date(agent.credential.expiresAt).toLocaleString('zh-CN')}
        </dd>
      </dl>
      {agent.status !== 'revoked' && (
        <div className="admin-submission-actions">
          <button
            type="button"
            disabled={busy}
            onClick={() => update.mutate(agent.status === 'paused' ? 'active' : 'paused')}
          >
            {agent.status === 'paused' ? '恢复投稿权限' : '暂停投稿权限'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              showAlert(
                '更换凭证',
                '旧凭证立即失效，新凭证有效期为 30 天。Agent 身份及额度不会重置。',
                [CANCEL_BUTTON, { text: '更换并显示新凭证', onPress: () => rotate.mutate() }],
              )
            }
          >
            更换凭证…
          </button>
        </div>
      )}
      {(update.error !== null || rotate.error !== null) && (
        <p role="alert" className="admin-error-box">
          {update.error?.message ?? rotate.error?.message}
        </p>
      )}
    </DetailDrawer>
  );
}

function OneTimeCredential({ issued, onClose }: { issued: IssuedCredential; onClose: () => void }) {
  const [feedback, setFeedback] = useState('');
  async function copy() {
    try {
      await navigator.clipboard.writeText(issued.token);
      setFeedback('凭证已复制。');
    } catch (cause) {
      handleError(cause, { label: '复制投稿凭证', logger, feedback: false });
      setFeedback('复制失败，请手动选择并保存完整凭证。');
    }
  }
  return (
    <DetailDrawer
      variant="sheet"
      title="请立即保存完整凭证"
      onClose={onClose}
      preventClose
      footer={
        <>
          <button type="button" onClick={() => void copy()}>
            复制凭证
          </button>
          <button type="button" className="admin-primary" onClick={onClose}>
            我已保存，关闭
          </button>
        </>
      }
    >
      <p>{issued.agent.name} 的完整 Token 只显示这一次，关闭后无法找回；丢失时请更换凭证。</p>
      <label className="admin-submission-form">
        完整投稿凭证
        <textarea readOnly rows={3} value={issued.token} />
      </label>
      <p className="admin-submission-note">只交给对应 Agent。不要放进公开仓库、截图或共享聊天。</p>
      <p role="status">{feedback}</p>
    </DetailDrawer>
  );
}
