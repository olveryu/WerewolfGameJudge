/**
 * Admin word-supply dashboard.
 *
 * Segmented per-game view (fibking / undercover / drawguess): supply stats, per-query
 * leaderboard, and manual supply triggers (normal + force + batch x10).
 */
import './AdminTabs.css';

import { GAME_WORD_GAMES } from '@game-judge/game-engine/product/wordSupply';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '@/components/Button';
import type { GameWordGame, GameWordsStats } from '@/features/admin/model/adminContracts';
import { fetchGameWordsStats, triggerGameWordSupply } from '@/features/admin/services/adminApi';
import { CANCEL_BUTTON, showAlert } from '@/utils/alert';
import IconCheckmarkCircleOutline from '~icons/ion/checkmark-circle-outline';
import IconCloudUploadOutline from '~icons/ion/cloud-upload-outline';
import IconInfiniteOutline from '~icons/ion/infinite-outline';
import IconLibraryOutline from '~icons/ion/library-outline';

import { AdminEmptyState } from '../components/AdminEmptyState';
import { MetricCard } from '../components/MetricCard';
import { Pagination } from '../components/Pagination';
import { loadErrorMessage } from './loadErrorMessage';

const GAME_WORD_LABELS: Readonly<Record<GameWordGame, string>> = {
  fibking: '瞎掰王',
  undercover: '谁是卧底',
  drawguess: '你画我猜',
};

/** Rows per page for the fibking query leaderboard list. */
const LEADERBOARD_PAGE_SIZE = 15;

/** Fibking review check names shown in admin; API returns the raw field names. */
const FIBKING_REVIEW_CHECK_LABELS: Readonly<Record<string, string>> = {
  isEstablishedTerm: '真实词项',
  isDefinitionAccurate: '释义准确',
  isMeaningUnfamiliarToMostPlayers: '真义陌生',
  isMeaningDistinctFromLiteralReading: '字面不泄底',
  hasMultiplePlausibleWrongDefinitions: '假释义空间',
  hasRevealValue: '揭晓价值',
};

const SUPPLY_ACTIONS = [
  { force: false, count: 1, label: '补词' },
  { force: false, count: 10, label: '补词×10' },
  { force: true, count: 1, label: '强制补词' },
  { force: true, count: 10, label: '强制补词×10' },
] as const;

function buildConfirmMessage(
  game: GameWordGame,
  data: GameWordsStats,
  force: boolean,
  count: number,
): string {
  const gameLabel = GAME_WORD_LABELS[game];
  // Model supply runs on dedicated free projects; force only breaks the budget cap.
  const forceDetail =
    game === 'fibking'
      ? `突破本月 ${data.monthlySupply?.batchLimit ?? '—'} 次配额及共享模型额度`
      : '突破每日批次上限及共享模型额度';
  if (count > 1) {
    return force
      ? `将为「${gameLabel}」连续强制触发 ${count} 次补词，${forceDetail}，确定吗？`
      : `将为「${gameLabel}」连续触发 ${count} 次补词，确定吗？`;
  }
  return force
    ? `将为「${gameLabel}」强制触发一次补词，${forceDetail}，确定吗？`
    : `为「${gameLabel}」立即触发一次补词，确定吗？`;
}

function buildSupplyHint(game: GameWordGame, data: GameWordsStats): string {
  if (!data.supplyEnabled) return '词库供给未启用';
  if (data.monthlySupply === null) return `「${GAME_WORD_LABELS[game]}」无月配额限制`;
  const remaining = Math.max(0, data.monthlySupply.batchLimit - data.monthlySupply.reserved);
  const tavilyUsage =
    data.tavilyRequestsUsed === null || data.tavilyMonthlyQuota === null
      ? ''
      : ` · Tavily 本月已用 ${data.tavilyRequestsUsed}/${data.tavilyMonthlyQuota}`;
  return `本月剩余 ${remaining} 次（配额 ${data.monthlySupply.batchLimit}）${tavilyUsage}`;
}

function formatReviewRate(data: GameWordsStats): string {
  const accepted = data.reviewDecisions.find((item) => item.decision === 'accepted')?.count ?? 0;
  const rejected = data.reviewDecisions.find((item) => item.decision === 'rejected')?.count ?? 0;
  const total = accepted + rejected;
  return total === 0 ? '—' : `${Math.round((accepted / total) * 100)}%`;
}

interface GameStatsProps {
  readonly game: GameWordGame;
  readonly data: GameWordsStats;
  readonly leaderboardPage: number;
  readonly onLeaderboardPageChange: (page: number) => void;
}

function GameStats({ game, data, leaderboardPage, onLeaderboardPageChange }: GameStatsProps) {
  const totalActive = data.categories.reduce((sum, item) => sum + item.active, 0);
  const categories = [...data.categories].sort(
    (a, b) => a.active - b.active || a.id.localeCompare(b.id),
  );
  const maxActive = Math.max(0, ...categories.map((category) => category.active));
  const middle = Math.floor(categories.length / 2);
  const median =
    categories.length === 0
      ? 0
      : categories.length % 2 === 1
        ? (categories[middle]?.active ?? 0)
        : ((categories[middle - 1]?.active ?? 0) + (categories[middle]?.active ?? 0)) / 2;
  const leaderboardItems = data.queryLeaderboard.map((query) => {
    // Undercover and drawguess leaderboard rows are per-category; localize them too.
    const baseLabel = query.label;
    return {
      label: query.detail ? `${baseLabel}（${query.detail}）` : baseLabel,
      value: query.publishedWords,
      displayValue: `${query.publishedWords}/${query.packs}批`,
    };
  });
  const leaderboardTotalPages = Math.max(
    1,
    Math.ceil(leaderboardItems.length / LEADERBOARD_PAGE_SIZE),
  );
  // Clamp: a reload may shrink the list while the user sits on a later page.
  const safeLeaderboardPage = Math.min(leaderboardPage, leaderboardTotalPages);
  const pagedLeaderboardItems = leaderboardItems.slice(
    (safeLeaderboardPage - 1) * LEADERBOARD_PAGE_SIZE,
    safeLeaderboardPage * LEADERBOARD_PAGE_SIZE,
  );
  const checkStatItems = data.reviewCheckStats.map((stat) => ({
    label: FIBKING_REVIEW_CHECK_LABELS[stat.check] ?? stat.check,
    value: stat.failCount,
  }));

  return (
    <>
      <div className="admin-metrics-row">
        <MetricCard value={String(totalActive)} label="在库词数" icon={<IconLibraryOutline />} />
        {data.monthlySupply ? (
          <MetricCard
            value={`${data.monthlySupply.published}/${data.monthlySupply.wordTarget}`}
            label={`${data.monthlySupply.month} 已发布`}
            icon={<IconCloudUploadOutline />}
          />
        ) : (
          <MetricCard value="—" label="无月配额" icon={<IconInfiniteOutline />} />
        )}
        <MetricCard
          value={formatReviewRate(data)}
          label="审核通过率"
          icon={<IconCheckmarkCircleOutline />}
        />
      </div>
      <section className="admin-plain-list">
        <h2 className="admin-section-title">分类均衡</h2>
        <p className="admin-summary">
          分类 {categories.length} · 最少 {categories[0]?.active ?? 0} · 最多 {maxActive} · 中位数{' '}
          {median}
        </p>
        <p className="admin-summary">
          {game === 'fibking'
            ? '产出按仍在库词的当前主题统计首次发布数；批次按搜索主题统计。'
            : '产出为当前仍在库且最近一次审核通过的词，不代表历史总产出。'}
        </p>
        <div className="admin-category-table-scroll">
          <table className="admin-category-table">
            <caption>按在库数量从少到多排列</caption>
            <thead>
              <tr>
                <th scope="col">分类</th>
                <th scope="col">在库 / 总数</th>
                <th scope="col">待审</th>
                <th scope="col">产出 / 批次</th>
                <th scope="col">上次补词</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id}>
                  <th scope="row">
                    {category.name}
                    {category.coolingDown && <span> · 冷却中</span>}
                    {category.menuEligible === false && <span> · 未达菜单门槛</span>}
                  </th>
                  <td>
                    {category.active} / {category.total}
                    <progress
                      aria-label={`${category.name}在库数量`}
                      value={category.active}
                      max={Math.max(1, maxActive)}
                    />
                  </td>
                  <td>{category.pending}</td>
                  <td>
                    {category.yieldCount} / {category.batches}
                  </td>
                  <td>
                    {category.lastAttempt === null
                      ? '从未'
                      : new Date(category.lastAttempt).toLocaleString('zh-CN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {game === 'fibking' && checkStatItems.length > 0 && (
        <section className="admin-plain-list">
          <h2 className="admin-section-title">审核拒因分布（近 30 天）</h2>
          {checkStatItems.map((item) => (
            <div key={item.label} className="admin-plain-row">
              <span>{item.label} 不通过</span>
              <span className="admin-plain-row-value">{item.value}</span>
            </div>
          ))}
        </section>
      )}
      {game === 'fibking' ? (
        <section className="admin-plain-list">
          <h2 className="admin-section-title">各查询产出榜（全部 {leaderboardItems.length} 条）</h2>
          {pagedLeaderboardItems.map((item) => (
            <div key={item.label} className="admin-plain-row">
              <span>{item.label}</span>
              <span className="admin-plain-row-value">{item.displayValue}</span>
            </div>
          ))}
          <Pagination
            page={safeLeaderboardPage}
            totalPages={leaderboardTotalPages}
            onPageChange={onLeaderboardPageChange}
          />
        </section>
      ) : null}
    </>
  );
}

/** Admin games tab. */
export function GamesTab() {
  const [game, setGame] = useState<GameWordGame>(GAME_WORD_GAMES[0]);
  const [triggering, setTriggering] = useState(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const [triggered, setTriggered] = useState(false);
  // Current page of the fibking query leaderboard; resets when switching games.
  const [leaderboardPage, setLeaderboardPage] = useState(1);

  const statsQuery = useQuery({
    queryKey: ['adminGameWordsStats', game],
    queryFn: () => fetchGameWordsStats(game),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const data = statsQuery.data ?? null;
  const loading = statsQuery.isPending || statsQuery.isRefetching;
  const error =
    triggerError ?? (statsQuery.error === null ? null : loadErrorMessage(statsQuery.error));

  // The alert closes on confirm while the serial triggers run in the background;
  // errors surface through the error state instead of holding the dialog open.
  const runTrigger = async (force: boolean, count: number) => {
    setTriggering(true);
    setTriggerError(null);
    setTriggered(false);
    try {
      // Serial calls: the backend assigns a unique runId per trigger, so no conflicts.
      for (let index = 0; index < count; index += 1) {
        await triggerGameWordSupply(game, force);
      }
      setTriggered(true);
    } catch (cause: unknown) {
      setTriggerError(loadErrorMessage(cause));
    } finally {
      setTriggering(false);
    }
  };

  const confirmTrigger = (stats: GameWordsStats, force: boolean, count: number) => {
    showAlert('确认补词', buildConfirmMessage(game, stats, force, count), [
      CANCEL_BUTTON,
      {
        text: '确定',
        style: force ? 'destructive' : 'default',
        onPress: () => void runTrigger(force, count),
      },
    ]);
  };

  return (
    <div className="admin-tab">
      <div className="admin-segmented" role="group" aria-label="选择游戏">
        {GAME_WORD_GAMES.map((gameType) => (
          <button
            key={gameType}
            type="button"
            className="admin-segment"
            aria-pressed={gameType === game}
            onClick={() => {
              setGame(gameType);
              setTriggerError(null);
              setTriggered(false);
              setLeaderboardPage(1);
            }}
          >
            {GAME_WORD_LABELS[gameType]}
          </button>
        ))}
      </div>
      {loading || error || !data ? (
        <AdminEmptyState loading={loading} error={error} empty={!data && !loading && !error} />
      ) : (
        <>
          <div className="admin-action-grid">
            {SUPPLY_ACTIONS.map((action) => (
              <Button
                key={action.label}
                variant={action.force ? 'danger' : 'primary'}
                disabled={triggering || !data.supplyEnabled}
                onClick={() => confirmTrigger(data, action.force, action.count)}
              >
                {triggering ? '触发中…' : action.label}
              </Button>
            ))}
          </div>
          <p className="admin-hint">{buildSupplyHint(game, data)}</p>
          <p className="admin-hint">
            共享模型额度：近 24 小时 {data.modelBudget.dailyUsed}/{data.modelBudget.dailyLimit} · 近
            30 天 {data.modelBudget.monthlyUsed}/{data.modelBudget.monthlyLimit}
          </p>
          <p className="admin-hint" role="status">
            {triggered ? '已触发，工作流需要几分钟。' : ''}
          </p>
          <Button variant="primary" onClick={() => void statsQuery.refetch()}>
            刷新统计
          </Button>
          <GameStats
            game={game}
            data={data}
            leaderboardPage={leaderboardPage}
            onLeaderboardPageChange={setLeaderboardPage}
          />
        </>
      )}
    </div>
  );
}
