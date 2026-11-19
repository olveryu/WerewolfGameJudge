/** 一眼成对房间：大厅走共享座位表；开局后是舞台工作区。 */
import './SpotmatchRoomScreen.css';

import {
  SPOTMATCH_REASONS,
  SPOTMATCH_WRONG_LOCK_MS,
  type SpotmatchState,
} from '@game-judge/game-engine/games/spotmatch/public';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { RoomDialog } from '@/features/room/components/RoomDialog';
import { RoomEntryBoundary } from '@/features/room/components/RoomEntryBoundary';
import { RoomGameSettings, RoomGameSummary } from '@/features/room/components/RoomGameSummary';
import { RoomShell } from '@/features/room/components/RoomShell';
import type { RoomStageHudRenderer } from '@/features/room/components/RoomStageHud';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';
import { exitRoomFlow } from '@/features/room/navigation/roomFlowNavigation';
import type { RoomReviewContribution } from '@/features/room/review/types';
import type { SpotmatchRoomSession } from '@/games/spotmatch/model/SpotmatchRoomSession';
import { TESTIDS } from '@/testids';

import { SpotmatchStatsPanel } from '../components/SpotmatchStatsPanel';
import { SPOTMATCH_SYMBOLS } from '../model/symbols';
import { SpotmatchRules } from '../screens/SpotmatchRulesScreen';
import { useSpotmatchCooldown } from './hooks/useSpotmatchCooldown';
import {
  type SpotmatchRoomScreenState,
  useSpotmatchRoomState,
} from './hooks/useSpotmatchRoomState';
import { SpotmatchPlayBoard } from './SpotmatchPlayBoard';
import { SpotmatchResults } from './SpotmatchResults';
import { createSpotmatchRoomSummarySettings } from './spotmatchRoomAdapter';

type SpotmatchRoomScreenProps = GameRoomScreenProps<'spotmatch'> & {
  readonly session: SpotmatchRoomSession;
  /** 模块声明的本局复盘（defineClientGameModule 的 review）；房间只渲染这一份。 */
  readonly review: RoomReviewContribution<SpotmatchState>;
};
interface ConfirmedSpotmatchMistake {
  readonly seat: number | null;
  readonly roundId: string;
  readonly centralInstanceId: string;
  readonly topInstanceId: string;
  readonly symbolId: number;
  readonly until: number;
}

/** 使用平台入场生命周期处理直链、加入与重连。 */
export function SpotmatchRoomScreen(props: SpotmatchRoomScreenProps) {
  const navigate = useNavigate();
  return (
    <RoomEntryBoundary
      room={props.room}
      session={props.session}
      onExit={() => exitRoomFlow(navigate)}
    >
      {(entryController) => <SpotmatchRoomContent {...props} entryController={entryController} />}
    </RoomEntryBoundary>
  );
}

function SpotmatchRoomContent(
  props: SpotmatchRoomScreenProps & { readonly entryController: RoomEntryController },
) {
  const screen = useSpotmatchRoomState(props);
  const [assetsReady, setAssetsReady] = useState(false);
  const [assetError, setAssetError] = useState(false);
  const [information, setInformation] = useState<'guide' | 'configuration' | null>(null);
  useEffect(() => {
    let active = true;
    void Promise.all(
      SPOTMATCH_SYMBOLS.map(async (symbol) => {
        const image = new Image();
        image.src = symbol.url;
        await image.decode();
      }),
    ).then(
      () => {
        if (active) setAssetsReady(true);
      },
      () => {
        if (active) setAssetError(true);
      },
    );
    return () => {
      active = false;
    };
  }, []);
  const config = screen.state.config;
  const isLobby = screen.state.phase.kind === 'lobby';
  const isPlaying = screen.state.phase.kind === 'playing' || screen.isShowingFinalSuccess;
  const openGuide = () => setInformation('guide');
  const openConfiguration = () => setInformation('configuration');
  const settings = createSpotmatchRoomSummarySettings(config);
  return (
    <RoomShell
      model={screen.shellModel}
      showPlayerHand
      stageMenu={
        isPlaying ? { onOpenGuide: openGuide, onOpenConfiguration: openConfiguration } : null
      }
      configurationEntry={isLobby ? null : { onOpen: openConfiguration }}
      manualEntries={[
        { label: '玩法', onOpen: openGuide, testId: TESTIDS.roomGuideButton('spotmatch') },
      ]}
      content={
        isLobby
          ? {
              kind: 'seats',
              contextHeader: null,
              bottomSummary: null,
              afterSeatBoard: null,
              sideInspector: null,
              beforeSeatBoard: (
                <RoomGameSummary
                  title="一眼成对"
                  playerCount={config.numberOfPlayers}
                  settings={settings}
                  guide={null}
                />
              ),
            }
          : isPlaying
            ? {
                kind: 'stage',
                hud: {
                  rosterPlacement: 'primary',
                  chips: [
                    {
                      key: 'remaining',
                      label:
                        screen.effectiveSeat === null
                          ? '观战中'
                          : `剩余 ${screen.state.round?.players.find((player) => player.seat === screen.effectiveSeat)?.remaining ?? 0} 张`,
                      detail: null,
                      tone: 'accent',
                    },
                  ],
                  secondaryChips: [],
                  timer: null,
                  roster: {
                    chipLabel: `名单 ${screen.viewModel.seats.length} 人`,
                    title: '本局玩家',
                    groupTitles: { acting: '出牌', pending: '找相同', done: '已出完' },
                    actingSeat: null,
                    pendingLabel: '找相同',
                    isUrgent: false,
                  },
                },
                element: (hud) => (
                  <SpotmatchStageArea
                    screen={screen}
                    assetsReady={assetsReady}
                    assetError={assetError}
                    hud={hud}
                  />
                ),
              }
            : {
                kind: 'workspace',
                element: (
                  <SpotmatchStageArea
                    screen={screen}
                    assetsReady={assetsReady}
                    assetError={assetError}
                  />
                ),
              }
      }
      leadingExtraActions={null}
      trailingExtraActions={null}
      profileDetailsRenderer={(userId, onGamesPlayedChange) => (
        <SpotmatchStatsPanel userId={userId} onGamesPlayedChange={onGamesPlayedChange} />
      )}
      gameOverlays={
        <>
          {information === 'guide' && (
            <RoomDialog
              title="一眼成对玩法"
              onClose={() => setInformation(null)}
              allowEscape
              footer={null}
            >
              <SpotmatchRules embedded />
            </RoomDialog>
          )}
          {information === 'configuration' && (
            <RoomDialog
              title="本局配置"
              onClose={() => setInformation(null)}
              allowEscape
              footer={null}
            >
              <p>{`一眼成对（${config.numberOfPlayers}人）`}</p>
              <RoomGameSettings settings={settings} />
            </RoomDialog>
          )}
          {screen.reviewOverlay}
        </>
      }
    />
  );
}

export function SpotmatchStageArea({
  screen,
  assetsReady,
  assetError,
  hud,
}: {
  readonly screen: SpotmatchRoomScreenState;
  readonly assetsReady: boolean;
  readonly assetError: boolean;
  readonly hud?: RoomStageHudRenderer;
}) {
  const { viewModel, state } = screen;
  const [confirmedMistake, setConfirmedMistake] = useState<ConfirmedSpotmatchMistake | null>(null);
  const mistakeRef = useRef<ConfirmedSpotmatchMistake | null>(null);
  const localMistake =
    confirmedMistake?.seat === screen.effectiveSeat &&
    confirmedMistake.roundId === state.round?.roundId
      ? confirmedMistake
      : null;
  const lockedUntil = Math.max(viewModel.lockedUntil, localMistake?.until ?? 0);
  const locked = useSpotmatchCooldown(lockedUntil);
  const success = state.round?.success ?? null;
  const paused = useSpotmatchCooldown(success?.until ?? 0);
  const [notice, setNotice] = useState<{ text: string; until: number } | null>(null);
  const showNotice = useSpotmatchCooldown(notice?.until ?? 0);
  const pending = useRef(false);
  if (state.phase.kind === 'ended' && !paused) {
    return (
      <SpotmatchResults state={state} viewModel={viewModel} effectiveSeat={screen.effectiveSeat} />
    );
  }
  const round = state.round;
  const top = viewModel.ownTop;
  const central = paused && success !== null ? success.previousCentral : viewModel.central;
  if (round === null || central === null) return null;
  const disabled =
    !assetsReady ||
    locked ||
    paused ||
    screen.isSubmitting ||
    screen.shellModel.connection.status.kind !== 'live';
  const claim = (symbolId: number) => {
    if (top === null || disabled || pending.current) return;
    if (
      mistakeRef.current?.seat === screen.effectiveSeat &&
      mistakeRef.current.roundId === round.roundId &&
      mistakeRef.current.until > Date.now()
    )
      return;
    pending.current = true;
    void screen
      .submit(
        '出牌',
        {
          type: 'spotmatch.card.claim',
          roundId: round.roundId,
          centralInstanceId: central.instanceId,
          topInstanceId: top.instanceId,
          symbolId,
        },
        {
          controlledSeat: screen.controlledSeat,
          domainRejection: 'state',
          onRejection: (reason) => {
            if (reason === SPOTMATCH_REASONS.wrong) {
              const confirmed = {
                seat: screen.effectiveSeat,
                roundId: round.roundId,
                centralInstanceId: central.instanceId,
                topInstanceId: top.instanceId,
                symbolId,
                until: Date.now() + SPOTMATCH_WRONG_LOCK_MS,
              };
              mistakeRef.current = confirmed;
              setConfirmedMistake(confirmed);
              return true;
            }
            const text =
              reason === SPOTMATCH_REASONS.stale || reason === SPOTMATCH_REASONS.phase
                ? '被抢先了，再找一次'
                : reason === SPOTMATCH_REASONS.paused
                  ? '出牌成功，全桌稍等 3 秒'
                  : reason === SPOTMATCH_REASONS.cooldown
                    ? '误点了，锁定 1 秒后再试'
                    : null;
            if (text === null) return false;
            setNotice({ text, until: Date.now() + 1500 });
            return true;
          },
        },
      )
      .finally(() => {
        pending.current = false;
      });
  };
  const lastPlayer = viewModel.seats.find((seat) => seat.seat === success?.seat);
  const mistake =
    localMistake !== null && localMistake.until >= viewModel.lockedUntil
      ? localMistake
      : round.players.find((player) => player.seat === screen.effectiveSeat)?.lastMistake;
  const wrongSymbol =
    locked &&
    mistake?.centralInstanceId === central.instanceId &&
    mistake.topInstanceId === top?.instanceId
      ? mistake.symbolId
      : null;
  const matchedSymbol = paused ? (success?.symbolId ?? null) : null;
  return (
    <SpotmatchPlayBoard
      hud={hud}
      central={central}
      top={top}
      playedCard={paused ? viewModel.central : null}
      isOwnSuccess={paused && success?.seat === screen.effectiveSeat}
      onSymbol={claim}
      disabled={disabled}
      wrongSymbol={wrongSymbol}
      matchedSymbol={matchedSymbol}
      feedback={{
        kind: paused ? 'success' : locked || assetError ? 'wrong' : showNotice ? 'notice' : 'idle',
        title: assetError
          ? '图案加载失败'
          : !assetsReady
            ? '正在准备图案…'
            : paused
              ? `${lastPlayer?.displayName ?? '玩家'} 出牌成功`
              : locked
                ? '误点了，锁定 1 秒'
                : showNotice && notice !== null
                  ? notice.text
                  : screen.effectiveSeat === null
                    ? '看看谁先找出来'
                    : '找到同一个图案',
        detail: assetError
          ? '请刷新页面后重试'
          : paused
            ? '全桌暂停 · 3 秒后继续'
            : locked
              ? '只锁定你的操作，稍后再试'
              : showNotice
                ? '不计误点，继续找相同'
                : top === null
                  ? '你正在观战'
                  : '桌面和手牌都能点',
        until: paused ? (success?.until ?? 0) : locked ? lockedUntil : 0,
      }}
    />
  );
}
