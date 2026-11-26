import './dicePreview.css';
import '@/features/room/config/GameConfigPage.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MemoryRouter } from 'react-router';

import { AlertHostSlot } from '@/components/AlertHostSlot';
import { makeBuiltinAvatarUrl } from '@/components/avatar/avatarSources';
import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import { AuthProvider, useAuthContext } from '@/contexts/AuthContext';
import { ServiceProvider } from '@/contexts/ServiceContext';
import {
  ResidentAvatarTile,
  ResidentSceneLayer,
} from '@/features/product/components/ResidentPreview';
import { RoomDialog } from '@/features/room/components/RoomDialog';
import { RoomGameSummary } from '@/features/room/components/RoomGameSummary';
import { RoomShell } from '@/features/room/components/RoomShell';
import { createRoomShellModel } from '@/features/room/model/createRoomShellModel';
import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
import { playDiceRattle } from '@/games/toolbox/room/toolboxDiceSound';
import { HomePage } from '@/routes/home/HomePage';
import { resolveResidentDecorations } from '@/scene/residentDecorations';
import { usePrefersReducedMotion } from '@/scene/usePrefersReducedMotion';
import { showErrorAlert } from '@/utils/alertPresets';
import { audioLog } from '@/utils/logger';

import {
  createIdentityDeck,
  emptyIdentityConfiguration,
  exampleIdentityConfiguration,
  type IdentityCard,
  type IdentityConfiguration,
  IdentityDrawDialog,
  IdentitySetupDialog,
  type SavedIdentityConfiguration,
  ToolOptions,
} from './identityPreview';
import { createPreviewServices } from './offlineServices';
import type { PreviewGame, PreviewPage, PreviewPopulation } from './previewGames';

const dicePips = [[4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
type PreviewDie = { readonly id: number; readonly value: number; readonly held: boolean };
const denied = { isAllowed: false, reason: '此操作尚未接入预览' } as const;
const previewResidents = resolveResidentDecorations({
  avatarFrame: 'wolfFang',
  seatFlair: 'nightSanctum',
});
const capabilities: RoomCapabilities = {
  canTakeSeat: denied,
  canMoveSeat: denied,
  canLeaveSeat: denied,
  canKickSeat: denied,
  canClearSeats: denied,
  canFillBots: denied,
  canConfigureGame: denied,
  canViewProfiles: denied,
  canTakeOverBots: denied,
  canShareRoom: denied,
  shouldConfirmExit: false,
};

function unsupported() {
  showErrorAlert('离线预览', '此操作尚未接入预览。');
}

type ToolSelection = { readonly dice: boolean; readonly identity: boolean };

function DiceConfiguration({
  selection,
  onChange,
  onCreate,
}: {
  readonly selection: ToolSelection;
  readonly onChange: (selection: ToolSelection) => void;
  readonly onCreate: () => void;
}) {
  return (
    <div className="game-config-page">
      <ScreenHeader title="道具箱设置（暂名）" onBack={unsupported} />
      <main className="game-config-body">
        <ToolOptions
          dice={selection.dice}
          identity={selection.identity}
          onDiceChange={(dice) => onChange({ ...selection, dice })}
          onIdentityChange={(identity) => onChange({ ...selection, identity })}
        />
        <p>离线预览：创建房间仅进入模拟房间，刷新或切换预览页面会重置。</p>
      </main>
      <footer className="game-config-footer">
        <Button
          size="lg"
          className="game-config-submit"
          disabled={!selection.dice && !selection.identity}
          onClick={onCreate}
        >
          创建房间
        </Button>
      </footer>
    </div>
  );
}

function DiceCup({
  dice,
  diceCount,
  heldCount,
  cupState,
  soundEnabled,
  soundError,
  onDiceCountChange,
  onSoundChange,
  onToggleCup,
  onToggleDie,
}: {
  readonly dice: readonly PreviewDie[] | null;
  readonly diceCount: number;
  readonly heldCount: number;
  readonly cupState: 'empty' | 'shaking' | 'closed' | 'open';
  readonly soundEnabled: boolean;
  readonly soundError: boolean;
  readonly onDiceCountChange: (count: number) => void;
  readonly onSoundChange: (enabled: boolean) => void;
  readonly onToggleCup: () => void;
  readonly onToggleDie: (id: number) => void;
}) {
  return (
    <div className="dice-preview-cup">
      <div className="dice-preview-heading">
        <label className="dice-preview-sound" htmlFor="dice-preview-sound">
          <input
            id="dice-preview-sound"
            type="checkbox"
            checked={soundEnabled}
            onChange={(event) => onSoundChange(event.currentTarget.checked)}
          />
          音效
        </label>
      </div>
      <div className="dice-preview-table" data-cup-state={cupState}>
        <div className="dice-preview-table-caption" aria-hidden="true">
          DICE CUP
        </div>
        <button
          type="button"
          className="dice-preview-cup-button"
          disabled={cupState === 'empty' || cupState === 'shaking'}
          onClick={onToggleCup}
          aria-label={cupState === 'open' ? '盖上骰盅' : '掀开骰盅'}
        >
          <span className="dice-preview-cup-illustration" aria-hidden="true">
            <span className="dice-preview-cup-top" />
            <span className="dice-preview-cup-body" />
            <span className="dice-preview-cup-band" />
            <span className="dice-preview-cup-rim" />
          </span>
        </button>
        {cupState === 'open' && dice !== null && (
          <ol className="dice-preview-faces" role="list" aria-label="我的骰子">
            {dice.map((die, index) => (
              <li key={die.id}>
                <button
                  type="button"
                  className="dice-preview-die"
                  aria-label={`第${index + 1}颗骰子 ${die.value}点`}
                  aria-pressed={die.held}
                  onClick={() => onToggleDie(die.id)}
                >
                  <span className="dice-preview-pips" aria-hidden="true">
                    {Array.from({ length: 9 }, (_, pip) => (
                      <span key={pip} data-visible={dicePips[die.value - 1]?.includes(pip)} />
                    ))}
                  </span>
                  {die.held && (
                    <span className="dice-preview-held" aria-hidden="true">
                      固定
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
      <p className="dice-preview-status" role="status">
        {cupState === 'empty'
          ? '还没有摇骰'
          : cupState === 'shaking'
            ? '正在摇骰…'
            : cupState === 'closed'
              ? '骰盅已摇好，点击骰盅查看'
              : '只有你能看到骰子'}
      </p>
      {soundError && <p role="status">音效不可用，仍可继续摇骰。</p>}
      {cupState === 'open' && <p className="dice-preview-hint">点击骰子固定点数，再摇时保留</p>}
      <div className="dice-preview-count">
        <div>
          <strong>骰子数量</strong>
          <span>下次摇骰生效{heldCount > 0 ? ` · 已固定 ${heldCount} 颗` : ''}</span>
        </div>
        <div className="dice-preview-stepper" role="group" aria-label="骰子数量">
          <button
            type="button"
            aria-label="减少骰子数量"
            disabled={cupState === 'shaking' || diceCount <= Math.max(1, heldCount)}
            onClick={() => onDiceCountChange(diceCount - 1)}
          >
            −
          </button>
          <output aria-live="polite">{diceCount} 颗</output>
          <button
            type="button"
            aria-label="增加骰子数量"
            disabled={cupState === 'shaking' || diceCount >= 20}
            onClick={() => onDiceCountChange(diceCount + 1)}
          >
            +
          </button>
        </div>
      </div>
      {heldCount > 0 && diceCount === heldCount && (
        <p className="dice-preview-hint">取消固定后可继续减少数量</p>
      )}
    </div>
  );
}

function usePreviewTools(initialPhase: string, selection: ToolSelection) {
  const [playing, setPlaying] = useState(initialPhase !== 'lobby');
  const [diceCount, setDiceCount] = useState(5);
  const [dice, setDice] = useState<readonly PreviewDie[] | null>(
    initialPhase === 'open'
      ? [1, 2, 3, 4, 5].map((value, id) => ({ id, value, held: false }))
      : null,
  );
  const nextDieId = useRef(5);
  const heldCount = dice?.filter((die) => die.held).length ?? 0;
  const [cupState, setCupState] = useState<'empty' | 'shaking' | 'closed' | 'open'>(
    initialPhase === 'open' ? 'open' : 'empty',
  );
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundError, setSoundError] = useState(false);
  const [dialog, setDialog] = useState<
    'dice' | 'identity-setup' | 'identity-reset' | 'identity-draw' | null
  >(null);
  const diceEnabled = selection.dice;
  const identityEnabled = selection.identity;
  const [identityConfiguration, setIdentityConfiguration] = useState<IdentityConfiguration>(
    initialPhase === 'identity' ? exampleIdentityConfiguration : emptyIdentityConfiguration,
  );
  const [savedConfigurations, setSavedConfigurations] = useState<
    readonly SavedIdentityConfiguration[]
  >([]);
  const [deck, setDeck] = useState<readonly IdentityCard[]>(
    initialPhase === 'identity' ? createIdentityDeck(exampleIdentityConfiguration) : [],
  );
  const [drawnCards, setDrawnCards] = useState<readonly IdentityCard[]>([]);
  const reducedMotion = usePrefersReducedMotion();
  useEffect(() => {
    if (cupState !== 'shaking') return;
    const timer = window.setTimeout(() => setCupState('closed'), reducedMotion ? 0 : 1400);
    return () => window.clearTimeout(timer);
  }, [cupState, reducedMotion]);
  const roll = () => {
    if (cupState === 'shaking') return;
    const heldDice = dice?.filter((die) => die.held) ?? [];
    const rolledDice = Array.from({ length: diceCount - heldDice.length }, () => ({
      id: nextDieId.current++,
      value: Math.floor(Math.random() * 6) + 1,
      held: false,
    }));
    setDice([...heldDice, ...rolledDice]);
    setCupState('shaking');
    setSoundError(false);
    if (soundEnabled) {
      void playDiceRattle().then(
        (played) => setSoundError(!played),
        (error: unknown) => {
          audioLog.warn('Dice preview: rattle playback failed', error);
          setSoundError(true);
        },
      );
    }
  };
  const toggleDie = (id: number) => {
    if (dice === null) return;
    const updatedDice = dice.map((die) => (die.id === id ? { ...die, held: !die.held } : die));
    setDiceCount(Math.max(diceCount, updatedDice.filter((die) => die.held).length));
    setDice(updatedDice);
  };
  const drawIdentity = () => {
    if (drawnCards.length >= Number(identityConfiguration.cardsPerPlayer) || deck.length === 0)
      return;
    const index = Math.floor(Math.random() * deck.length);
    const card = deck[index];
    if (card === undefined) throw new Error('预览身份牌堆状态无效');
    setDeck(deck.filter((_, cardIndex) => cardIndex !== index));
    setDrawnCards([...drawnCards, card]);
  };
  return {
    playing,
    setPlaying,
    diceCount,
    setDiceCount,
    dice,
    heldCount,
    cupState,
    setCupState,
    soundEnabled,
    setSoundEnabled,
    soundError,
    roll,
    toggleDie,
    dialog,
    setDialog,
    diceEnabled,
    identityEnabled,
    identityConfiguration,
    setIdentityConfiguration,
    savedConfigurations,
    setSavedConfigurations,
    deck,
    setDeck,
    drawnCards,
    setDrawnCards,
    drawIdentity,
  };
}

function DiceRoom({
  viewer,
  initialPhase,
  selection,
  population,
}: {
  readonly viewer: string;
  readonly initialPhase: string;
  readonly selection: ToolSelection;
  readonly population: PreviewPopulation;
}) {
  const tools = usePreviewTools(initialPhase, selection);
  const sceneHostRef = useRef<HTMLDivElement>(null);
  const { playing, diceEnabled, identityEnabled, setDialog, setPlaying } = tools;
  const [seated, setSeated] = useState(initialPhase !== 'lobby' && viewer !== '2');
  const participantCount = population.seatedOthers + (seated ? 1 : 0);
  const totalCount = population.otherPlayers + 1;
  const actions =
    playing && seated
      ? [
          ...(diceEnabled
            ? [
                {
                  key: 'dice',
                  label: '骰子',
                  category: 'player' as const,
                  audience: 'participant' as const,
                  icon: 'game-controller-outline' as const,
                  opensDialog: true,
                  state: { kind: 'ready' as const, onPress: () => setDialog('dice') },
                },
              ]
            : []),
          ...(identityEnabled
            ? [
                {
                  key: 'draw-identity',
                  label: '抽牌',
                  category: 'player' as const,
                  audience: 'participant' as const,
                  icon: 'albums-outline' as const,
                  opensDialog: true,
                  state: { kind: 'ready' as const, onPress: () => setDialog('identity-draw') },
                },
              ]
            : []),
        ]
      : playing
        ? []
        : [
            {
              key: 'join',
              label: seated ? '取消入座' : '入座',
              category: 'player' as const,
              audience: 'anyone' as const,
              icon: seated ? ('person-remove-outline' as const) : ('person-add-outline' as const),
              state: { kind: 'ready' as const, onPress: () => setSeated(!seated) },
            },
          ];
  const model = createRoomShellModel({
    roomCode: '1234',
    viewer: { userId: `dice-player-${viewer}`, isHost: viewer === '0', seat: seated ? 0 : null },
    phase: playing ? 'playing' : 'lobby',
    step: null,
    isAudioPlaying: false,
    isSubmitting: false,
    pendingActionKey: null,
    capabilities,
    header: {
      onBack: unsupported,
      onTitlePress: unsupported,
      onTitleLongPress: unsupported,
      userAction: null,
    },
    connection: { status: { kind: 'live' }, pendingDurableCount: 0, onRetryNow: unsupported },
    seatSource: {
      count: 0,
      revision: 0,
      getSeat: () => {
        throw new Error('道具箱预览没有座位表');
      },
    },
    seatsVisuallyDisabled: false,
    onSeatPress: unsupported,
    onBotSeatLongPress: null,
    seatConfirmation: null,
    profile: null,
    share: {
      isVisible: false,
      roomCode: '1234',
      roomUrl: '',
      open: unsupported,
      close: unsupported,
      copyLink: async () => {
        throw new Error('此操作尚未接入预览');
      },
      shareImage: async () => {
        throw new Error('此操作尚未接入预览');
      },
    },
    playerActions: {
      message: null,
      progress: null,
      actions,
      group: null,
    },
    buildHostManagement: () =>
      playing
        ? identityEnabled
          ? {
              task: { kind: 'action', actionKey: 'reset-identity' },
              actions: [
                {
                  key: 'reset-identity',
                  label: '重开身份牌',
                  category: 'host',
                  icon: 'refresh-outline',
                  opensDialog: true,
                  state: { kind: 'ready', onPress: () => setDialog('identity-reset') },
                },
              ],
            }
          : null
        : {
            task: { kind: 'action', actionKey: 'start' },
            actions: [
              {
                key: 'start',
                label: '开始',
                category: 'host',
                icon: 'play-outline',
                opensDialog: identityEnabled,
                state:
                  participantCount === 0
                    ? { kind: 'blocked', reason: '至少一人入座才能开始' }
                    : {
                        kind: 'ready',
                        onPress: () =>
                          identityEnabled ? setDialog('identity-setup') : setPlaying(true),
                      },
              },
            ],
          },
    controlledSeat: null,
  });
  return (
    <RoomShell
      model={model}
      phaseLabel={playing ? '道具使用中' : '待开始'}
      content={{
        kind: 'workspace',
        element: (
          <div className="dice-preview-room">
            <RoomGameSummary
              title="道具箱（暂名）"
              playerCount={totalCount}
              guide={null}
              settings={[
                { label: '入座人数', value: `${participantCount} 人` },
                { label: '房间总人数', value: `${totalCount} 人` },
                {
                  label: '本局道具',
                  value: [diceEnabled && '骰子', identityEnabled && '抽身份']
                    .filter(Boolean)
                    .join('、'),
                },
              ]}
            />
            <div
              className="dice-preview-room-status"
              data-state={seated ? 'seated' : playing ? 'watching' : 'unseated'}
            >
              <ResidentSceneLayer hostRef={sceneHostRef} />
              <p className="dice-preview-room-phase">{playing ? '道具使用中' : '等待开始'}</p>
              <div className="dice-preview-room-avatar">
                <ResidentAvatarTile
                  userId={`dice-player-${viewer}`}
                  avatarUrl={makeBuiltinAvatarUrl('nightSovereign')}
                  residents={previewResidents}
                  sceneHostRef={sceneHostRef}
                />
              </div>
              <p className="dice-preview-room-name">{viewer === '0' ? '房主' : '预览玩家'}（你）</p>
              <p className="dice-preview-room-status-label" role="status">
                {seated ? '已入座' : playing ? '观看中' : '请入座'}
              </p>
            </div>
          </div>
        ),
      }}
      directory={{ main: [], manual: [], openConfiguration: null }}
      leadingExtraActions={null}
      trailingExtraActions={null}
      gameOverlays={<PreviewToolOverlays tools={tools} participantCount={participantCount} />}
    />
  );
}

function PreviewToolOverlays({
  tools,
  participantCount,
}: {
  readonly tools: ReturnType<typeof usePreviewTools>;
  readonly participantCount: number;
}) {
  const {
    dialog,
    setDialog,
    roll,
    cupState,
    dice,
    diceCount,
    heldCount,
    soundEnabled,
    soundError,
    setDiceCount,
    setSoundEnabled,
    setCupState,
    toggleDie,
    setPlaying,
    identityConfiguration,
    savedConfigurations,
    playing,
    setSavedConfigurations,
    setIdentityConfiguration,
    setDeck,
    setDrawnCards,
    deck,
    drawnCards,
    drawIdentity,
  } = tools;
  return dialog === 'dice' ? (
    <RoomDialog
      title="我的骰盅"
      dismissOnEscape
      onClose={() => setDialog(null)}
      footer={
        <Button onClick={roll} disabled={cupState === 'shaking'}>
          摇骰
        </Button>
      }
    >
      <DiceCup
        dice={dice}
        diceCount={diceCount}
        heldCount={heldCount}
        cupState={cupState}
        soundEnabled={soundEnabled}
        soundError={soundError}
        onDiceCountChange={setDiceCount}
        onSoundChange={setSoundEnabled}
        onToggleCup={() => setCupState(cupState === 'open' ? 'closed' : 'open')}
        onToggleDie={toggleDie}
      />
    </RoomDialog>
  ) : dialog === 'identity-setup' ? (
    <IdentitySetupDialog
      initial={identityConfiguration}
      seatCount={participantCount}
      saved={savedConfigurations}
      reset={playing}
      onSave={(item) =>
        setSavedConfigurations((current) => [
          ...current.filter((entry) => entry.name !== item.name),
          item,
        ])
      }
      onClose={(configuration) => {
        if (!playing) setIdentityConfiguration(configuration);
        setDialog(null);
      }}
      onSubmit={(configuration) => {
        setIdentityConfiguration(configuration);
        setDeck(createIdentityDeck(configuration));
        setDrawnCards([]);
        setPlaying(true);
        setDialog(null);
      }}
    />
  ) : dialog === 'identity-reset' ? (
    <RoomDialog
      title="重开身份牌？"
      dismissOnEscape
      onClose={() => setDialog(null)}
      footer={
        <>
          <Button onClick={() => setDialog('identity-setup')}>继续配置</Button>
          <Button variant="secondary" onClick={() => setDialog(null)}>
            取消
          </Button>
        </>
      }
    >
      <p>确认重开后，所有人已抽的身份牌将返回牌堆，其他道具不受影响。</p>
    </RoomDialog>
  ) : dialog === 'identity-draw' ? (
    <IdentityDrawDialog
      remaining={deck.length}
      cards={drawnCards}
      limit={Number(identityConfiguration.cardsPerPlayer)}
      onDraw={drawIdentity}
      onClose={() => setDialog(null)}
    />
  ) : null;
}

function DicePreviewContent({
  phase,
  viewer,
  page,
  population,
}: {
  readonly phase: string;
  readonly viewer: string;
  readonly page: PreviewPage;
  readonly population: PreviewPopulation;
}) {
  const { loading, error, user } = useAuthContext();
  const [selection, setSelection] = useState<ToolSelection>({
    dice: true,
    identity: phase === 'identity',
  });
  const [enteredRoom, setEnteredRoom] = useState(false);
  if (loading) return <p role="status">正在加载预览账号…</p>;
  if (error !== null || user === null) throw new Error(error ?? '预览账号未就绪');
  if (page === 'home') return <HomePage />;
  if (page === 'config' && !enteredRoom)
    return (
      <DiceConfiguration
        selection={selection}
        onChange={setSelection}
        onCreate={() => setEnteredRoom(true)}
      />
    );
  return (
    <DiceRoom
      viewer={viewer}
      initialPhase={enteredRoom ? 'lobby' : phase}
      selection={selection}
      population={population}
    />
  );
}

/** Provides fictional scenarios for an unimplemented, rule-neutral tabletop toolbox. */
function DicePreviewScreen(props: {
  readonly phase: string;
  readonly viewer: string;
  readonly page: PreviewPage;
  readonly population: PreviewPopulation;
}) {
  const services = useMemo(
    () => createPreviewServices(`dice-player-${props.viewer}`),
    [props.viewer],
  );
  const queryClient = useMemo(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    [],
  );
  return (
    <QueryClientProvider client={queryClient}>
      <ServiceProvider services={services}>
        <MemoryRouter>
          <AuthProvider>
            <div className="preview-content">
              <DicePreviewContent {...props} />
            </div>
            <AlertHostSlot />
          </AuthProvider>
        </MemoryRouter>
      </ServiceProvider>
    </QueryClientProvider>
  );
}

export const dicePreview: PreviewGame = {
  id: 'dice',
  label: '道具箱（暂名）',
  phases: [
    { id: 'lobby', label: '等待开始' },
    { id: 'playing', label: '自由摇骰' },
    { id: 'open', label: '已掀开骰盅' },
    { id: 'identity', label: '抽身份示例' },
  ],
  viewers: () => [
    { id: '0', label: '房主' },
    { id: '1', label: '玩家' },
    { id: '2', label: '观众（开始后）' },
  ],
  Screen: DicePreviewScreen,
};
