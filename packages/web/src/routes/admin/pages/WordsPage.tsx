/** Inventory-first word operations with explicit confirmation and no post-trigger refetch. */
import '../words/wordSubmissions.css';

import { GAME_WORD_GAMES, isGameWordGame } from '@game-judge/game-engine/product/wordSupply';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router';

import type { GameWordGame, GameWordsStats } from '@/features/admin/model/adminContracts';
import { adminQueryOptions } from '@/features/admin/queries/adminQueryOptions';
import { fetchGameWordsStats, triggerGameWordSupply } from '@/features/admin/services/adminApi';
import { CANCEL_BUTTON, showAlert } from '@/utils/alert';
import { handleError } from '@/utils/errorPipeline';
import { log } from '@/utils/logger';

import { AutomaticSupplyControl } from '../components/AutomaticSupplyControl';
import { BarList, formatNumber, HeatGrid, Meter } from '../components/Charts';
import {
  AsyncBoundary,
  CursorPager,
  DataTable,
  DateLabel,
  PageHeading,
  Panel,
  StatTile,
  StatusBadge,
} from '../components/Primitives';
import { type SupplyAction, SupplyControls } from '../components/SupplyControls';
import { SubmissionAgentsPage } from '../words/SubmissionAgents';
import { SubmissionsPage } from '../words/SubmissionsPage';
import { WordSections } from '../words/WordSections';

const LABELS = { fibking: '瞎掰王', undercover: '谁是卧底', drawguess: '你画我猜' } as const;
const CHECK_LABELS: Readonly<Record<string, string>> = {
  isEstablishedTerm: '真实词项',
  isDefinitionAccurate: '释义准确',
  isMeaningUnfamiliarToMostPlayers: '真义陌生',
  isMeaningDistinctFromLiteralReading: '字面不泄底',
  hasMultiplePlausibleWrongDefinitions: '假释义空间',
  hasRevealValue: '揭晓价值',
};
const wordLog = log.extend('AdminWords');

/** Unknown game links fail explicitly rather than quietly selecting another inventory. */
export function WordsPage() {
  const { game } = useParams();
  const [parameters] = useSearchParams();
  if (!isGameWordGame(game))
    return (
      <div className="admin-content">
        <h1>未知词库</h1>
        <Link to="/admin/words/fibking" replace>
          返回词库管理
        </Link>
      </div>
    );
  const section = parameters.get('section') ?? 'inventory';
  if (section === 'agents') return <SubmissionAgentsPage game={game} />;
  if (section === 'submissions') return <SubmissionsPage game={game} />;
  if (section !== 'inventory')
    return (
      <div className="admin-content">
        <h1>未知词库页面</h1>
        <Link to={`/admin/words/${game}`}>返回库存与供给</Link>
      </div>
    );
  return <WordInventory key={game} game={game} />;
}

function WordInventory({ game }: { game: GameWordGame }) {
  const [parameters, setParameters] = useSearchParams();
  const [triggering, setTriggering] = useState(false);
  const [notice, setNotice] = useState('');
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const busy = useRef(false);
  const query = useQuery(
    adminQueryOptions('words', game, (signal) => fetchGameWordsStats(game, signal)),
  );
  async function trigger(action: SupplyAction) {
    if (busy.current) return;
    busy.current = true;
    setTriggering(true);
    setNotice('');
    setTriggerError(null);
    let completed = 0;
    try {
      for (; completed < action.count; completed += 1)
        await triggerGameWordSupply(game, action.force);
      setNotice(`已触发 ${completed} 次，工作流需要几分钟，稍后手动刷新。`);
    } catch (cause: unknown) {
      handleError(cause, { label: '触发补词', logger: wordLog, feedback: false });
      setTriggerError(
        `已确认触发 ${completed} 次，其后一次结果未确认，请核对后再操作。${cause instanceof Error ? cause.message : '请求失败'}`,
      );
    } finally {
      busy.current = false;
      setTriggering(false);
    }
  }
  function confirm(action: SupplyAction) {
    const limit =
      game === 'fibking'
        ? `突破本月 ${query.data?.monthlySupply?.batchLimit ?? '—'} 次配额及共享模型额度`
        : '突破每日批次上限及共享模型额度';
    showAlert(
      '确认补词',
      `将为「${LABELS[game]}」${action.force ? '强制' : ''}触发 ${action.count} 次补词${action.force ? `，${limit}` : ''}，确定吗？`,
      [
        CANCEL_BUTTON,
        {
          text: '确定',
          style: action.force ? 'destructive' : 'default',
          onPress: () => void trigger(action),
        },
      ],
    );
  }
  const view = parameters.get('view') ?? 'low';
  return (
    <>
      <PageHeading
        title="词库"
        description="先看库存与分类均衡，再决定是否补词。"
        query={query}
        controls={<WordSections game={game} section="inventory" />}
        action={
          <SupplyControls
            disabled={triggering || !query.data?.supplyEnabled}
            triggering={triggering}
            gameLabel={LABELS[game]}
            remainingBudget={
              query.data === undefined
                ? 0
                : Math.max(
                    0,
                    Math.min(
                      query.data.modelBudget.dailyLimit - query.data.modelBudget.dailyUsed,
                      query.data.modelBudget.monthlyLimit - query.data.modelBudget.monthlyUsed,
                    ),
                  )
            }
            onSelect={confirm}
          />
        }
      />
      <div className="admin-content">
        <div className="admin-toolbar">
          <nav className="admin-segmented admin-word-tabs" aria-label="选择词库">
            {GAME_WORD_GAMES.map((item) => (
              <Link
                key={item}
                to={`/admin/words/${item}`}
                replace
                aria-current={item === game ? 'page' : undefined}
              >
                {LABELS[item]}
              </Link>
            ))}
          </nav>
        </div>
        {notice && (
          <p role="status" className="admin-notice">
            {notice}
          </p>
        )}
        {triggerError !== null && (
          <p role="alert" className="admin-error-box">
            {triggerError}
          </p>
        )}
        <div className="admin-grid">
          <Panel className="admin-span-9">
            <AsyncBoundary query={query}>{(data) => <WordSummary data={data} />}</AsyncBoundary>
          </Panel>
          <Panel title="供给设置与额度" className="admin-span-3">
            <AutomaticSupplyControl game={game} />
            {query.data !== undefined && <SupplyQuota data={query.data} />}
          </Panel>
          {query.data !== undefined && (
            <WordReport
              data={query.data}
              view={view}
              onViewChange={(value) => {
                const next = new URLSearchParams(parameters);
                next.set('view', value);
                setParameters(next, { replace: true });
              }}
            />
          )}
        </div>
      </div>
    </>
  );
}

function WordSummary({ data }: { data: GameWordsStats }) {
  const active = data.categories.reduce((sum, item) => sum + item.active, 0);
  const accepted = data.reviewDecisions.find((item) => item.decision === 'accepted')?.count ?? 0;
  const reviews = data.reviewDecisions.reduce((sum, item) => sum + item.count, 0);
  return (
    <div className="admin-stats-grid">
      <StatTile label="在库词数" value={formatNumber(active)} />
      <StatTile
        label="本月已发布"
        value={
          data.monthlySupply === null ? '无月目标' : formatNumber(data.monthlySupply.published)
        }
        hint={
          data.monthlySupply === null
            ? undefined
            : `目标 ${formatNumber(data.monthlySupply.wordTarget)}`
        }
      />
      <StatTile
        label="审核通过率"
        value={reviews === 0 ? '—' : `${Math.round((accepted / reviews) * 100)}%`}
        hint="近 30 天"
      />
    </div>
  );
}

function SupplyQuota({ data }: { data: GameWordsStats }) {
  return (
    <>
      {data.monthlySupply !== null && (
        <Meter
          label="本月批次"
          value={data.monthlySupply.reserved}
          limit={data.monthlySupply.batchLimit}
        />
      )}
      <Meter
        label="模型 · 近 24 小时"
        value={data.modelBudget.dailyUsed}
        limit={data.modelBudget.dailyLimit}
      />
      <Meter
        label="模型 · 近 30 天"
        value={data.modelBudget.monthlyUsed}
        limit={data.modelBudget.monthlyLimit}
      />
      {data.tavilyRequestsUsed !== null && data.tavilyMonthlyQuota !== null && (
        <Meter
          label="Tavily · 本月"
          value={data.tavilyRequestsUsed}
          limit={data.tavilyMonthlyQuota}
        />
      )}
    </>
  );
}

function WordReport({
  data,
  view,
  onViewChange,
}: {
  data: GameWordsStats;
  view: string;
  onViewChange: (value: string) => void;
}) {
  const { hash } = useLocation();
  useEffect(() => {
    if (hash.startsWith('#category-') && view === 'all') {
      document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'center' });
    }
  }, [hash, view]);
  const [leaderboardPage, setLeaderboardPage] = useState(1);
  const categories = [...data.categories].sort(
    (a, b) => a.active - b.active || a.id.localeCompare(b.id),
  );
  const maximum = Math.max(0, ...categories.map((item) => item.active));
  const middle = Math.floor(categories.length / 2);
  const median =
    categories.length % 2 === 1
      ? (categories[middle]?.active ?? 0)
      : ((categories[middle - 1]?.active ?? 0) + (categories[middle]?.active ?? 0)) / 2;
  const pageCount = Math.max(1, Math.ceil(data.queryLeaderboard.length / 15));
  const page = Math.min(leaderboardPage, pageCount);
  return (
    <>
      <Panel
        title="分类库存"
        className="admin-span-12"
        description={`分类 ${categories.length} · 最少 ${categories[0]?.active ?? 0} · 中位数 ${median} · 最多 ${maximum}`}
      >
        <HeatGrid items={categories} />
      </Panel>
      <Panel
        title="分类明细"
        flush
        description={
          data.game === 'fibking'
            ? '产出按仍在库词的当前主题统计首次发布数；批次按搜索主题统计。'
            : '产出为当前仍在库且最近一次审核通过的词，不代表历史总产出。'
        }
        className="admin-span-12"
        action={
          <div className="admin-segmented" role="group" aria-label="分类范围">
            <button type="button" aria-pressed={view !== 'all'} onClick={() => onViewChange('low')}>
              低库存
            </button>
            <button type="button" aria-pressed={view === 'all'} onClick={() => onViewChange('all')}>
              全部
            </button>
          </div>
        }
      >
        <p className="admin-muted">
          低库存：不高于当前中位数。点击热力格会显示全部分类并定位明细。
        </p>
        <CategoryTable
          categories={
            view === 'all' ? categories : categories.filter((item) => item.active <= median)
          }
          maximum={maximum}
          highlightedRow={hash.slice(1)}
        />
      </Panel>
      {data.game === 'fibking' && (
        <>
          <Panel title="审核拒因" description="近 30 天 · 当前审核版本" className="admin-span-6">
            <BarList
              items={data.reviewCheckStats.map((row) => ({
                label: CHECK_LABELS[row.check] ?? row.check,
                value: row.failCount,
              }))}
            />
          </Panel>
          <Panel
            title="各查询产出"
            description={`${data.queryLeaderboard.length} 条查询`}
            className="admin-span-6"
            footer={
              <CursorPager
                page={page}
                hasNext={page < pageCount}
                onPrevious={() => setLeaderboardPage(page - 1)}
                onNext={() => setLeaderboardPage(page + 1)}
              />
            }
          >
            <BarList
              items={data.queryLeaderboard.slice((page - 1) * 15, page * 15).map((row) => ({
                label: row.detail ? `${row.label} · ${row.detail}` : row.label,
                value: row.publishedWords,
                detail: `${row.publishedWords} 词 / ${row.packs} 批`,
              }))}
            />
          </Panel>
        </>
      )}
    </>
  );
}

function CategoryTable({
  categories,
  maximum,
  highlightedRow,
}: {
  categories: GameWordsStats['categories'];
  maximum: number;
  highlightedRow: string;
}) {
  return (
    <DataTable
      caption="分类明细"
      rows={categories}
      rowKey={(item) => item.id}
      rowId={(item) => `category-${item.id}`}
      highlightedRow={highlightedRow}
      columns={[
        { key: 'name', label: '分类', render: (item) => item.name },
        {
          key: 'state',
          label: '状态',
          render: (item) => (
            <StatusBadge
              tone={
                item.active === 0
                  ? 'danger'
                  : item.coolingDown || item.menuEligible === false
                    ? 'warning'
                    : 'success'
              }
            >
              {item.active === 0
                ? '缺货'
                : item.coolingDown
                  ? '冷却中'
                  : item.menuEligible === false
                    ? '未达菜单门槛'
                    : '正常'}
            </StatusBadge>
          ),
        },
        {
          key: 'stock',
          label: '在库 / 总数',
          numeric: true,
          render: (item) => (
            <span className="admin-stock-value">
              {item.active} / {item.total}
              <progress
                aria-label={`${item.name}在库`}
                value={item.active}
                max={Math.max(1, maximum)}
              />
            </span>
          ),
        },
        {
          key: 'pending',
          label: '待审',
          numeric: true,
          secondary: true,
          render: (item) => item.pending,
        },
        {
          key: 'yield',
          label: '产出 / 批次',
          numeric: true,
          secondary: true,
          render: (item) => `${item.yieldCount} / ${item.batches}`,
        },
        {
          key: 'last',
          label: '上次补词',
          secondary: true,
          render: (item) => <DateLabel value={item.lastAttempt} />,
        },
      ]}
    />
  );
}
