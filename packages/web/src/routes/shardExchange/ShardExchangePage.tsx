/**
 * Shard exchange: browse every exchangeable item by category and rarity, and trade shards for a
 * specific item. Owned items are dimmed with 已拥有; an unaffordable item shows the shortfall.
 */
import './ShardExchangePage.css';

import {
  type Rarity,
  REWARD_POOL,
  type RewardType,
  SHARD_COSTS,
} from '@game-judge/game-engine/product/rewards';
import { type RefObject, Suspense, use, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';

import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Spinner } from '@/components/Spinner';
import { RARITY_ORDER, RARITY_VISUAL } from '@/config/rarityVisual';
import { useUserStatsQuery } from '@/features/account/queries/useUserStatsQuery';
import {
  useExchangeShardMutation,
  usePendingGachaOperation,
} from '@/features/gacha/queries/gachaMutations';
import { useGachaStatusQuery } from '@/features/gacha/queries/useGachaQuery';
import {
  type CosmeticTab,
  CosmeticTabBar,
  cosmeticTabId,
  type RarityFilter,
  RarityFilterBar,
} from '@/features/product/components/CosmeticTabs';
import { ResidentSceneLayer } from '@/features/product/components/ResidentPreview';
import { loadClientProductUi } from '@/features/product/loadClientProductUi';
import type { ClientProductUi } from '@/features/product/model/ClientProductUi';
import { colors } from '@/theme/colors';
import { withAlpha } from '@/theme/colorUtils';
import { showAlert } from '@/utils/alert';
import { getUserFacingMessage, isExpectedError } from '@/utils/errorUtils';
import { gachaLog } from '@/utils/logger';
import IconCheckmarkCircle from '~icons/ion/checkmark-circle';
import IconDiamondOutline from '~icons/ion/diamond-outline';

import { getRewardDisplayName, RewardPreview } from '../gacha/components/RewardPreview';

const TAB_ID_PREFIX = 'shard-exchange';
const PANEL_ID = 'shard-exchange-panel';
const PREVIEW_SIZE = 56;
/** The previous client dimmed an owned cell to 0.5 and its preview to 0.4 within it. */
const OWNED_PREVIEW_OPACITY = 0.2;

const REWARD_TYPE_OF_TAB: Readonly<Record<CosmeticTab, RewardType>> = {
  avatar: 'avatar',
  frame: 'frame',
  flair: 'seatFlair',
  nameStyle: 'nameStyle',
  effect: 'roleRevealEffect',
  seatAnimation: 'seatAnimation',
};

interface ExchangeItem {
  type: RewardType;
  id: string;
  rarity: Rarity;
  cost: number;
  isOwned: boolean;
}

/** The tab's items: unowned first, then by rarity (mythic first). */
function buildExchangeItems(
  tab: CosmeticTab,
  rarityFilter: RarityFilter,
  unlockedItems: ReadonlySet<string>,
): ExchangeItem[] {
  const rewardType = REWARD_TYPE_OF_TAB[tab];
  return REWARD_POOL.filter(
    (item) => item.type === rewardType && (rarityFilter === 'all' || item.rarity === rarityFilter),
  )
    .map((item) => ({
      type: item.type,
      id: item.id,
      rarity: item.rarity,
      cost: SHARD_COSTS[item.rarity],
      isOwned: unlockedItems.has(item.id),
    }))
    .sort((a, b) => {
      if (a.isOwned !== b.isOwned) return a.isOwned ? 1 : -1;
      return RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity);
    });
}

function logExchangeFailure(label: string, error: Error): void {
  if (isExpectedError(error)) gachaLog.warn(`${label} rejected`, { error });
  else gachaLog.error(`${label} failed`, { error });
}

interface ExchangeCellProps {
  item: ExchangeItem;
  shards: number;
  isExchanging: boolean;
  productUi: ClientProductUi;
  sceneHostRef: RefObject<HTMLDivElement | null>;
  scrollRootRef: RefObject<HTMLElement | null>;
  onExchange: (item: ExchangeItem, displayName: string) => void;
}

function ExchangeCell({
  item,
  shards,
  isExchanging,
  productUi,
  sceneHostRef,
  scrollRootRef,
  onExchange,
}: ExchangeCellProps) {
  const visual = RARITY_VISUAL[item.rarity];
  const displayName = getRewardDisplayName(productUi, item.type, item.id);
  const canAfford = shards >= item.cost;
  return (
    <li
      className="shard-cell"
      data-owned={item.isOwned}
      style={{ borderColor: item.isOwned ? colors.border : withAlpha(visual.color, 0.4) }}
    >
      <span
        className="shard-cell-dot"
        style={{ backgroundColor: visual.color }}
        role="img"
        aria-label={visual.label}
      />
      <RewardPreview
        rewardType={item.type}
        rewardId={item.id}
        size={PREVIEW_SIZE}
        productUi={productUi}
        sceneHostRef={sceneHostRef}
        scrollRootRef={scrollRootRef}
        opacity={item.isOwned ? OWNED_PREVIEW_OPACITY : 1}
      />
      <span className="shard-cell-name">{displayName}</span>
      {item.isOwned ? (
        <span className="shard-cell-owned">
          <IconCheckmarkCircle aria-hidden />
          已拥有
        </span>
      ) : (
        <button
          type="button"
          className="shard-cell-exchange"
          aria-label={`用 ${item.cost} 碎片兑换「${displayName}」`}
          disabled={!canAfford || isExchanging}
          onClick={() => onExchange(item, displayName)}
        >
          ✦ {item.cost}
        </button>
      )}
      {!item.isOwned && !canAfford && (
        <span className="shard-cell-deficit">差 {item.cost - shards}</span>
      )}
    </li>
  );
}

interface ExchangeGridProps {
  shards: number;
  unlockedItems: readonly string[];
  isExchanging: boolean;
  onExchange: (item: ExchangeItem, displayName: string) => void;
}

/** Tabs, rarity chips and the item grid; suspends until the product UI modules load. */
function ExchangeGrid({ shards, unlockedItems, isExchanging, onExchange }: ExchangeGridProps) {
  const productUi = use(loadClientProductUi());
  const [activeTab, setActiveTab] = useState<CosmeticTab>('avatar');
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>('all');
  const sceneHostRef = useRef<HTMLDivElement>(null);
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const items = buildExchangeItems(activeTab, rarityFilter, new Set(unlockedItems));

  return (
    <div className="shard-exchange-body">
      <ResidentSceneLayer hostRef={sceneHostRef} />
      <div ref={scrollRootRef} className="shard-exchange-scroll">
        <CosmeticTabBar
          activeTab={activeTab}
          onChange={setActiveTab}
          idPrefix={TAB_ID_PREFIX}
          panelId={PANEL_ID}
        />
        <RarityFilterBar value={rarityFilter} onChange={setRarityFilter} />
        <ul
          id={PANEL_ID}
          role="tabpanel"
          aria-labelledby={cosmeticTabId(TAB_ID_PREFIX, activeTab)}
          className="shard-exchange-grid"
        >
          {items.map((item) => (
            <ExchangeCell
              key={`${item.type}-${item.id}`}
              item={item}
              shards={shards}
              isExchanging={isExchanging}
              productUi={productUi}
              sceneHostRef={sceneHostRef}
              scrollRootRef={scrollRootRef}
              onExchange={onExchange}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="shard-exchange-status">
      <Spinner label="正在加载兑换列表" />
    </div>
  );
}

/** Shard exchange page. */
export function ShardExchangePage() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const gachaPath = roomCode === undefined ? '/gacha' : `/gacha/${roomCode}`;
  const gachaStatus = useGachaStatusQuery();
  const userStats = useUserStatsQuery();
  const { mutate: exchange, isPending: isExchanging } = useExchangeShardMutation();
  const { pendingOperation, confirmRecovery } = usePendingGachaOperation();

  const shards = gachaStatus.data?.shards ?? 0;

  const handleExchange = (item: ExchangeItem, displayName: string) => {
    showAlert('确认兑换', `消耗 ✦ ${item.cost} 碎片兑换「${displayName}」？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '兑换',
        onPress: () => {
          exchange(item.id, {
            onSuccess: () => {
              toast.success('兑换成功', { description: `获得「${displayName}」` });
            },
            onError: (error) => {
              logExchangeFailure('Exchange', error);
              toast.error(getUserFacingMessage(error, '兑换失败，请稍后重试'));
            },
          });
        },
      },
    ]);
  };

  const recoverPendingOperation = () => {
    if (pendingOperation === null || isExchanging) return;
    if (!confirmRecovery()) return;
    const { request } = pendingOperation;
    if (request.operation === 'draw') {
      void navigate(gachaPath);
      return;
    }
    exchange(request.rewardId, {
      onSuccess: () => toast.success('兑换成功'),
      onError: (error) => {
        logExchangeFailure('Exchange recovery', error);
        toast.error(getUserFacingMessage(error, '兑换失败，请稍后重试'));
      },
    });
  };

  const queryFailed =
    (gachaStatus.data === undefined && gachaStatus.isError) ||
    (userStats.data === undefined && userStats.isError);
  const isLoading = gachaStatus.isLoading || userStats.isLoading;

  return (
    <div className="shard-exchange-page">
      <ScreenHeader title="碎片兑换" parentPath={gachaPath}>
        <span
          className="shard-exchange-balance"
          role="img"
          aria-label={`碎片 ${shards.toLocaleString()}`}
        >
          <IconDiamondOutline aria-hidden />
          <span aria-hidden>{shards.toLocaleString()}</span>
        </span>
      </ScreenHeader>

      {pendingOperation !== null && (
        <div className="shard-exchange-recovery">
          <Button onClick={recoverPendingOperation}>恢复待确认操作</Button>
        </div>
      )}

      {queryFailed ? (
        <div className="shard-exchange-status">
          <p role="alert">加载失败</p>
          <Button
            loading={gachaStatus.isFetching || userStats.isFetching}
            onClick={() => {
              void gachaStatus.refetch();
              void userStats.refetch();
            }}
          >
            重试
          </Button>
        </div>
      ) : isLoading ? (
        <LoadingState />
      ) : (
        <Suspense fallback={<LoadingState />}>
          <ExchangeGrid
            shards={shards}
            unlockedItems={userStats.data?.unlockedItems ?? []}
            isExchanging={isExchanging}
            onExchange={handleExchange}
          />
        </Suspense>
      )}
    </div>
  );
}
