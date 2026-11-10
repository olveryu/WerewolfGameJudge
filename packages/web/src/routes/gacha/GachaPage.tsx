/**
 * Gacha: the capsule machine on top (a lazy PixiJS chunk), the ticket tabs, counts, pity and draw
 * button below. A single draw reveals one card; a multi-draw shows the grouped results.
 */
import './GachaPage.css';

import { PITY_THRESHOLD } from '@game-judge/game-engine/product/rewards';
import { useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, use, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';

import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Spinner } from '@/components/Spinner';
import { useAuthContext } from '@/contexts/AuthContext';
import { userStatsOptions } from '@/features/account/queries/accountQueryOptions';
import { GUEST_GROWTH_NOTICE } from '@/features/auth/guestPolicy';
import { requestLogin } from '@/features/auth/loginRequests';
import type { CapsuleMachineHandle } from '@/features/gacha/machine/CapsuleMachine';
import { PHASE } from '@/features/gacha/machine/gachaConstants';
import { useDrawMutation, usePendingGachaOperation } from '@/features/gacha/queries/gachaMutations';
import { useGachaStatusQuery } from '@/features/gacha/queries/useGachaQuery';
import type { DrawResultItem } from '@/features/gacha/services/gachaApi';
import { useAppVisibility } from '@/features/product/hooks/useAppVisibility';
import { loadClientProductUi } from '@/features/product/loadClientProductUi';
import { usePrefersReducedMotion } from '@/scene/usePrefersReducedMotion';
import { getUserFacingMessage, isExpectedError } from '@/utils/errorUtils';
import { gachaLog } from '@/utils/logger';
import IconChevronForward from '~icons/ion/chevron-forward';
import IconDiamondOutline from '~icons/ion/diamond-outline';
import IconGridOutline from '~icons/ion/grid-outline';
import IconShirtOutline from '~icons/ion/shirt-outline';

import { DrawButton } from './components/DrawButton';
import { PityProgressBar } from './components/PityProgressBar';
import { RateDisclosureModal } from './components/RateDisclosureModal';
import { SingleResultReveal } from './components/SingleResultReveal';
import { TenResultOverlay } from './components/TenResultOverlay';
import { type TicketTab, TicketTabBar, ticketTabId } from './components/TicketTabBar';
import { GACHA_PALETTE_VARS } from './gachaPalette';
import { useDrawPresentation } from './useDrawPresentation';

// The machine is a PixiJS consumer, so it loads through the seat-scene chunk (see `loadCapsuleMachine`).
const CapsuleMachine = lazy(() =>
  import('@/features/room/components/RoomSeatScene').then((module) => module.loadCapsuleMachine()),
);

const TICKET_PANEL_ID = 'gacha-ticket-panel';
const MAX_MULTI_DRAW = 10;

function withRoomCode(path: string, roomCode: string | undefined): string {
  return roomCode === undefined ? path : `${path}/${roomCode}`;
}

function requestDrawLogin(isGuest: boolean): void {
  void requestLogin(
    isGuest
      ? { title: '绑定邮箱', subtitle: GUEST_GROWTH_NOTICE }
      : { title: '登录', subtitle: '登录后即可抽奖' },
  );
}

interface GachaResultsProps {
  results: readonly DrawResultItem[];
  drawType: TicketTab;
  reducedMotion: boolean;
  onDismiss: () => void;
  onGoEquip: () => void;
}

/** The result dialog for the finished draw; suspends until the product UI modules load. */
function GachaResults({
  results,
  drawType,
  reducedMotion,
  onDismiss,
  onGoEquip,
}: GachaResultsProps) {
  const productUi = use(loadClientProductUi());
  const [single] = results;
  if (results.length === 1 && single) {
    return (
      <SingleResultReveal
        item={single}
        productUi={productUi}
        onDismiss={onDismiss}
        onGoEquip={onGoEquip}
        reducedMotion={reducedMotion}
      />
    );
  }
  return (
    <TenResultOverlay
      results={results}
      drawType={drawType}
      productUi={productUi}
      onClose={onDismiss}
      onGoEquip={onGoEquip}
    />
  );
}

/** Gacha page; a different account starts a fresh session (draw state, tabs). */
export function GachaPage() {
  const { user } = useAuthContext();
  return <GachaSession key={user?.id ?? 'anonymous'} />;
}

function GachaSession() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const reducedMotion = usePrefersReducedMotion();
  const isAmbientAnimationActive = useAppVisibility();
  const { user } = useAuthContext();
  const isAnon = !user || user.isAnonymous;
  const isGuest = user?.isAnonymous ?? false;
  const {
    data: status,
    isPending,
    isError,
    isFetching,
    fetchStatus,
    refetch,
  } = useGachaStatusQuery();
  const { mutate: draw, isPending: isDrawPending } = useDrawMutation();
  const { pendingOperation, confirmRecovery } = usePendingGachaOperation();

  const machineRef = useRef<CapsuleMachineHandle>(null);
  const [currentDrawType, setCurrentDrawType] = useState<TicketTab>('normal');
  const { presentation, begin, accept, showResults, dismiss, fail } = useDrawPresentation(
    !reducedMotion && isAmbientAnimationActive,
    () => machineRef.current?.cancelAnimation(),
  );
  const [activeTab, setActiveTab] = useState<TicketTab>('normal');
  const [showRates, setShowRates] = useState(false);

  const appearancePath = withRoomCode('/appearance', roomCode);
  const shardExchangePath = withRoomCode('/shard-exchange', roomCode);
  const isAnimating = presentation.phase === 'animating' || presentation.phase === 'requesting';
  const busy = isAnimating || isDrawPending;

  const prefetchStatsAndGo = (path: string) => {
    if (!isAnon) void queryClient.prefetchQuery(userStatsOptions(user.id));
    void navigate(path);
  };

  const handlePhaseChange = (phase: number) => {
    if (phase === PHASE.DONE) showResults();
  };

  const handleDraw = (drawType: TicketTab, count: number) => {
    if (isAnon) {
      requestDrawLogin(isGuest);
      return;
    }
    if (busy) return;
    setCurrentDrawType(drawType);
    begin();
    if (!reducedMotion) machineRef.current?.startAnimation(count);
    draw(
      { drawType, count },
      {
        onSuccess: (data) => {
          accept(data.results);
          if (!reducedMotion) machineRef.current?.setResults(data.results.map((r) => r.rarity));
        },
        onError: (error) => {
          fail();
          // Expected rejections are warn-only; the MutationCache reports unexpected failures.
          if (isExpectedError(error)) gachaLog.warn('Draw rejected', { drawType, count, error });
          else gachaLog.error('Draw failed', { drawType, count, error });
          toast.error(getUserFacingMessage(error, '抽奖失败，请稍后重试'));
        },
      },
    );
  };

  const headerActions = (
    <>
      <IconButton
        label="装扮"
        icon={<IconShirtOutline aria-hidden />}
        onClick={() => prefetchStatsAndGo(appearancePath)}
      />
      <IconButton
        label="收藏"
        icon={<IconGridOutline aria-hidden />}
        onClick={() => prefetchStatsAndGo(withRoomCode('/unlocks', roomCode))}
      />
    </>
  );
  const header = (
    <ScreenHeader title="扭蛋抽奖" parentPath={withRoomCode('/settings', roomCode)}>
      {headerActions}
    </ScreenHeader>
  );

  if (isAnon || status === undefined) {
    return (
      <div className="gacha-page" style={GACHA_PALETTE_VARS} data-testid="gacha-screen">
        {header}
        <div className="gacha-status">
          {isAnon ? (
            <>
              {isGuest && <p className="gacha-status-message">{GUEST_GROWTH_NOTICE}</p>}
              <Button onClick={() => requestDrawLogin(isGuest)}>
                {isGuest ? '绑定邮箱开启成长' : '登录后抽奖'}
              </Button>
            </>
          ) : isPending && fetchStatus !== 'paused' ? (
            <Spinner label="正在读取资产" />
          ) : (
            <>
              <p className="gacha-status-message" role="alert">
                资产读取失败，请重试
              </p>
              <Button loading={isFetching} onClick={() => void refetch()}>
                重新读取
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  const { normalDraws, goldenDraws, normalPity, goldenPity, shards } = status;
  const isGoldenTab = activeTab === 'golden';
  const activeDraws = isGoldenTab ? goldenDraws : normalDraws;
  const activePity = isGoldenTab ? goldenPity : normalPity;
  const multiCount = Math.min(MAX_MULTI_DRAW, activeDraws || MAX_MULTI_DRAW);
  const showingResults = presentation.phase === 'results' && presentation.results.length > 0;
  const goEquip = () => {
    dismiss();
    prefetchStatsAndGo(appearancePath);
  };

  return (
    <div className="gacha-page" style={GACHA_PALETTE_VARS} data-testid="gacha-screen">
      {header}
      {isError && (
        <div className="gacha-status-banner">
          <p className="gacha-status-message" role="alert">
            刷新失败，当前显示上次读取的资产
          </p>
          <Button variant="ghost" size="sm" loading={isFetching} onClick={() => void refetch()}>
            重新读取
          </Button>
        </div>
      )}
      <div className="gacha-machine-area">
        <Suspense fallback={<Spinner label="正在加载扭蛋机" />}>
          <CapsuleMachine
            ref={machineRef}
            drawType={currentDrawType}
            onPhaseChange={handlePhaseChange}
            released={showingResults}
          />
        </Suspense>
      </div>

      <div className="gacha-panel">
        {(presentation.phase === 'animating' || presentation.phase === 'dismissed') && (
          <Button onClick={showResults}>查看抽奖结果</Button>
        )}
        {pendingOperation !== null && (
          <Button
            onClick={() => {
              if (!confirmRecovery()) return;
              const { request } = pendingOperation;
              if (request.operation === 'draw') handleDraw(request.drawType, request.count);
              else void navigate(shardExchangePath);
            }}
          >
            恢复待确认操作
          </Button>
        )}
        <TicketTabBar
          activeTab={activeTab}
          normalCount={normalDraws}
          goldenCount={goldenDraws}
          onSwitch={(tab) => {
            if (!busy) setActiveTab(tab);
          }}
          panelId={TICKET_PANEL_ID}
          reducedMotion={reducedMotion}
        />

        <div
          className="gacha-card"
          id={TICKET_PANEL_ID}
          role="tabpanel"
          aria-labelledby={ticketTabId(activeTab)}
        >
          <div className="gacha-stats-row">
            <p className="gacha-count" data-golden={isGoldenTab} data-zero={activeDraws === 0}>
              <span className="gacha-count-value">{activeDraws}</span>
              <span className="gacha-count-unit">张</span>
            </p>
            <div className="gacha-pity">
              <span className="gacha-pity-label">距离保底</span>
              <PityProgressBar
                pity={activePity}
                threshold={PITY_THRESHOLD}
                golden={isGoldenTab}
                reducedMotion={reducedMotion}
                isAnimationActive={isAmbientAnimationActive}
              />
            </div>
          </div>

          <Link className="gacha-shard-row" to={shardExchangePath} aria-label="碎片兑换">
            <span className="gacha-shard-info">
              <IconDiamondOutline aria-hidden className="gacha-shard-icon" />
              <span className="gacha-shard-count">{shards.toLocaleString()}</span>
              <span className="gacha-shard-label">碎片</span>
            </span>
            <span className="gacha-shard-hint">
              兑换
              <IconChevronForward aria-hidden />
            </span>
          </Link>

          <DrawButton
            label={`抽 ×${multiCount}`}
            disabled={activeDraws < 1 || busy}
            onPress={() => handleDraw(activeTab, multiCount)}
            golden={isGoldenTab}
            multiPullCount={activeDraws}
            reducedMotion={reducedMotion}
            isAnimationActive={isAmbientAnimationActive}
          />

          <div className="gacha-meta">
            <span className="gacha-meta-hint">每局+1~5普通 · 每日+1~5普通 · 升级+1~5黄金</span>
            <button type="button" className="gacha-rate-link" onClick={() => setShowRates(true)}>
              概率公示
            </button>
          </div>
        </div>
      </div>

      {showingResults && (
        <Suspense fallback={null}>
          <GachaResults
            results={presentation.results}
            drawType={currentDrawType}
            reducedMotion={reducedMotion}
            onDismiss={dismiss}
            onGoEquip={goEquip}
          />
        </Suspense>
      )}

      <RateDisclosureModal open={showRates} onClose={() => setShowRates(false)} />
    </div>
  );
}
