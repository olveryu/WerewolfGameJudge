/**
 * Admin word-supply dashboard.
 *
 * Segmented per-game view (fibking / undercover / drawguess): supply stats, per-query
 * leaderboard, and manual supply triggers (normal + force + batch x10).
 */
import './AdminTabs.css';

import { UNDERCOVER_CATEGORY_NAMES } from '@game-judge/game-engine/games/undercover/public';
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
import { BarChart } from '../components/BarChart';
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

/** Fibking word categories shown in admin; API returns the raw enum values. */
const FIBKING_CATEGORY_NAMES: Readonly<Record<string, string>> = {
  literary: '书面词',
  internet: '网络词',
  compound: '复合词',
  niche: '生僻概念',
};

/** Fibking review check names shown in admin; API returns the raw field names. */
const FIBKING_REVIEW_CHECK_LABELS: Readonly<Record<string, string>> = {
  isEstablishedTerm: '真实词项',
  isDefinitionAccurate: '释义准确',
  isMeaningUnfamiliarToMostPlayers: '真义陌生',
  isMeaningDistinctFromLiteralReading: '字面不泄底',
  hasMultiplePlausibleWrongDefinitions: '假释义空间',
  hasRevealValue: '揭晓价值',
};

/** DrawGuess word categories shown in admin; API returns the raw enum values. */
const DRAWGUESS_CATEGORY_NAMES: Readonly<Record<string, string>> = {
  animals: '动物',
  food: '食物',
  dailyObjects: '日用品',
  plants: '植物',
  vehicles: '交通工具',
  places: '场所',
  sports: '运动',
  people: '人物',
  idioms: '成语',
  internetMemes: '网络梗',
  instruments: '乐器',
  occupations: '职业',
  space: '太空天文',
  festivals: '节日习俗',
  electronics: '电器数码',
  characters: '动漫角色',
  nature: '自然现象',
  landmarks: '建筑地标',
  stationery: '文具校园',
  oceanLife: '海洋生物',
};

const GAME_WORD_CATEGORY_NAMES: Readonly<Record<GameWordGame, Readonly<Record<string, string>>>> = {
  fibking: FIBKING_CATEGORY_NAMES,
  undercover: UNDERCOVER_CATEGORY_NAMES,
  drawguess: DRAWGUESS_CATEGORY_NAMES,
};

const SUPPLY_ACTIONS = [
  { force: false, count: 1, label: '补词' },
  { force: false, count: 10, label: '补词×10' },
  { force: true, count: 1, label: '强制补词' },
  { force: true, count: 10, label: '强制补词×10' },
] as const;

function localizeCategory(game: GameWordGame, category: string): string {
  return GAME_WORD_CATEGORY_NAMES[game][category] ?? category;
}

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
      ? `突破本月 ${data.monthlySupply?.batchLimit ?? '—'} 次配额`
      : '突破每日批次上限';
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
  const totalActive = data.wordsByCategory.reduce((sum, item) => sum + item.active, 0);
  const leaderboardItems = data.queryLeaderboard.map((query) => {
    // Undercover and drawguess leaderboard rows are per-category; localize them too.
    const baseLabel = game === 'fibking' ? query.label : localizeCategory(game, query.label);
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
      <BarChart
        title="各分类在库词数"
        items={data.wordsByCategory.map((item) => ({
          label: localizeCategory(game, item.category),
          value: item.active,
        }))}
      />
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
      ) : (
        <BarChart title="各分类产出" items={leaderboardItems} labelWidth={120} />
      )}
    </>
  );
}

/** Admin games tab. */
export function GamesTab() {
  const [game, setGame] = useState<GameWordGame>(GAME_WORD_GAMES[0]);
  const [triggering, setTriggering] = useState(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);
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
    try {
      // Serial calls: the backend assigns a unique runId per trigger, so no conflicts.
      for (let index = 0; index < count; index += 1) {
        await triggerGameWordSupply(game, force);
      }
      await statsQuery.refetch();
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
          <GameStats
            game={game}
            data={data}
            leaderboardPage={leaderboardPage}
            onLeaderboardPageChange={setLeaderboardPage}
          />
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
        </>
      )}
    </div>
  );
}
