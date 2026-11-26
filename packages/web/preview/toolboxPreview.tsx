import {
  projectToolboxStateForUser,
  type ToolboxConfig,
  toolboxEngine,
  type ToolboxPublicCommand,
  type ToolboxState,
} from '@game-judge/game-engine/games/toolbox/public';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMemo } from 'react';
import { MemoryRouter, Route, Routes, useNavigate, useParams } from 'react-router';

import { AlertHostSlot } from '@/components/AlertHostSlot';
import { AuthProvider, useAuthContext } from '@/contexts/AuthContext';
import { ServiceProvider } from '@/contexts/ServiceContext';
import { ToolboxConfigScreen } from '@/games/toolbox/config/ToolboxConfigScreen';
import type { ToolboxRoomSession } from '@/games/toolbox/model/ToolboxRoomSession';
import { toolboxReview } from '@/games/toolbox/review/toolboxReview';
import { ToolboxRoomScreen } from '@/games/toolbox/room/ToolboxRoomScreen';
import { ToolboxGuideScreen } from '@/games/toolbox/screens/ToolboxGuideScreen';
import { GamePickerPage } from '@/routes/games/GamePickerPage';
import { HomePage } from '@/routes/home/HomePage';
import { showErrorAlert } from '@/utils/alertPresets';

import { createPreviewRoomLink, createPreviewServices } from './offlineServices';
import type { PreviewGame, PreviewPage, PreviewPopulation } from './previewGames';

const room = {
  roomCode: '1234',
  roomId: 'preview-room',
  gameType: 'toolbox',
  hostUserId: 'host',
  createdAt: new Date('2026-01-01T00:00:00Z'),
} as const;

const phaseOptions = [
  { id: 'preparing', label: '准备中' },
  { id: 'active', label: '使用中' },
  { id: 'revealed', label: '已掀开骰盅' },
  { id: 'drawn', label: '已抽身份' },
] as const;
type ToolboxPreviewPhase = (typeof phaseOptions)[number]['id'];

const viewerOptions = [
  { id: 'host', label: '房主（已入座）' },
  { id: 'u1', label: '玩家（已入座）' },
  { id: 'spectator', label: '观众（开始后进入）' },
] as const;
type ToolboxPreviewViewer = (typeof viewerOptions)[number]['id'];

function isPhase(value: string): value is ToolboxPreviewPhase {
  return phaseOptions.some((option) => option.id === value);
}

function isViewer(value: string): value is ToolboxPreviewViewer {
  return viewerOptions.some((option) => option.id === value);
}

function unsupported() {
  showErrorAlert('离线预览', '此入口尚未接入预览，不会连接真实服务。');
}

function createScenarioConfig(participantCount: number): ToolboxConfig {
  return {
    tools: ['dice', 'identity'],
    identity: {
      identities: [
        { name: '侦探', description: '观察并寻找线索', count: 1 },
        { name: '旅人', description: '', count: Math.max(3, participantCount) },
      ],
      cardsPerPlayer: 1,
    },
  };
}

function applyCommand(state: ToolboxState, userId: string, command: ToolboxPublicCommand) {
  const commandId = `preview-scenario-${userId}-${command.type}`;
  const decision = toolboxEngine.decide(state, command, {
    actor: { kind: 'user', userId },
    controlledSeat: null,
    nowMs: 0,
    commandId,
    randomSeed: commandId,
  });
  if (decision.kind === 'reject')
    throw new Error(`Toolbox preview scenario rejected ${command.type}: ${decision.reason}`);
  return decision.events.reduce((current, event) => toolboxEngine.evolve(current, event), state);
}

function readActivePhase(state: ToolboxState, userId: string) {
  const { phase } = projectToolboxStateForUser(state, userId);
  if (phase.kind !== 'active') throw new Error('Toolbox preview scenario is not active');
  return phase;
}

function revealOwnDice(state: ToolboxState, userId: string): ToolboxState {
  const readVersion = (current: ToolboxState) => {
    const { participation } = readActivePhase(current, userId);
    if (participation.kind !== 'participant' || participation.dice === null)
      throw new Error(`Toolbox preview viewer ${userId} has no dice cup`);
    return participation.dice.version;
  };
  const rolled = applyCommand(state, userId, {
    type: 'toolbox.dice.roll',
    cupVersion: readVersion(state),
  });
  return applyCommand(rolled, userId, {
    type: 'toolbox.dice.reveal',
    cupVersion: readVersion(rolled),
  });
}

function drawOwnIdentity(state: ToolboxState, userId: string): ToolboxState {
  const { identity, sessionId } = readActivePhase(state, userId);
  if (identity === null) throw new Error('Toolbox preview scenario has no identity round');
  return applyCommand(state, userId, { type: 'toolbox.identity.draw', sessionId });
}

/** Builds each scenario through the real engine, so previews never show impossible states. */
function buildScenario(
  phase: ToolboxPreviewPhase,
  viewer: ToolboxPreviewViewer,
  population: PreviewPopulation,
): ToolboxState {
  const others = Array.from(
    { length: population.otherPlayers },
    (_, index) => `preview-member-${index + 1}`,
  );
  const seatedUsers = ['host', 'u1', ...others.slice(0, population.seatedOthers)];
  let state = toolboxEngine.createInitialState(createScenarioConfig(seatedUsers.length), {
    roomCode: room.roomCode,
    hostUserId: room.hostUserId,
    nowMs: 0,
    commandId: 'preview-create',
  });
  const lateMembers = phase === 'preparing' ? [] : ['spectator'];
  const earlyMembers = phase === 'preparing' ? ['u1', 'spectator', ...others] : ['u1', ...others];
  for (const userId of earlyMembers)
    state = applyCommand(state, userId, { type: 'toolbox.member.join' });
  for (const userId of seatedUsers)
    state = applyCommand(state, userId, { type: 'toolbox.seat.take' });
  if (phase === 'preparing') return state;
  state = applyCommand(state, 'host', {
    type: 'toolbox.session.begin',
    configVersion: state.configVersion,
  });
  for (const userId of lateMembers)
    state = applyCommand(state, userId, { type: 'toolbox.member.join' });
  const actingUser = viewer === 'spectator' ? 'u1' : viewer;
  if (phase === 'revealed') return revealOwnDice(state, actingUser);
  if (phase === 'drawn') return drawOwnIdentity(state, actingUser);
  return state;
}

function PreviewRoutes({ link }: { readonly link: ToolboxRoomSession }) {
  const navigate = useNavigate();
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/games" element={<GamePickerPage />} />
      <Route path="/game/:gameType/config/:mode/:roomCode?" element={<ConfigRoute link={link} />} />
      <Route path="/game/toolbox/guide/:roomCode?" element={<ToolboxGuideScreen />} />
      <Route
        path="/room/:roomCode"
        element={
          <ToolboxRoomScreen
            room={room}
            entryReason={null}
            session={link}
            review={toolboxReview}
            onOpenMusicSettings={unsupported}
            onOpenRoomSettings={() => void navigate('/game/toolbox/config/edit/1234')}
            onOpenUserSettings={unsupported}
          />
        }
      />
      <Route path="*" element={<p role="status">此页面尚未接入离线预览。</p>} />
    </Routes>
  );
}

function ConfigRoute({ link }: { readonly link: ToolboxRoomSession }) {
  const { gameType } = useParams();
  if (gameType !== 'toolbox') return <p role="status">该游戏尚未接入离线预览。</p>;
  return <ToolboxConfigScreen session={link} />;
}

function AuthenticatedPreviewRoutes({ link }: { readonly link: ToolboxRoomSession }) {
  const { loading, error, user } = useAuthContext();
  if (loading) return <p role="status">正在加载预览账号…</p>;
  if (error !== null || user === null) throw new Error(error ?? '预览账号未就绪');
  return <PreviewRoutes link={link} />;
}

const pagePaths: Record<PreviewPage, string> = {
  home: '/',
  config: '/game/toolbox/config/create',
  room: '/room/1234',
};

/** Renders the real toolbox pages against an in-memory room driven by the real engine. */
function ToolboxPreviewScreen({
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
  if (!isPhase(phase)) throw new Error(`Unknown toolbox preview phase: ${phase}`);
  if (!isViewer(viewer)) throw new Error(`Unknown toolbox preview viewer: ${viewer}`);
  const services = useMemo(() => createPreviewServices(viewer), [viewer]);
  const queryClient = useMemo(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    [],
  );
  const link = useMemo(
    () =>
      createPreviewRoomLink({
        initialState: buildScenario(phase, viewer, population),
        identity: { room, userId: viewer },
        engine: toolboxEngine,
        project: (state) => projectToolboxStateForUser(state, viewer),
      }),
    [phase, viewer, population],
  );
  return (
    <QueryClientProvider client={queryClient}>
      <ServiceProvider services={services}>
        <MemoryRouter initialEntries={[pagePaths[page]]}>
          <AuthProvider key={viewer}>
            <div className="preview-content">
              <AuthenticatedPreviewRoutes link={link} />
            </div>
            <AlertHostSlot />
          </AuthProvider>
        </MemoryRouter>
      </ServiceProvider>
    </QueryClientProvider>
  );
}

/** 聚会工具's real screens and engine-built scenarios for the shared preview host. */
export const toolboxPreview: PreviewGame = {
  id: 'toolbox',
  label: '聚会工具',
  phases: phaseOptions,
  viewers: (phase) => {
    if (!isPhase(phase)) throw new Error(`Unknown toolbox preview phase: ${phase}`);
    return phase === 'preparing'
      ? viewerOptions.map((option) =>
          option.id === 'spectator' ? { id: option.id, label: '房间成员（未入座）' } : option,
        )
      : viewerOptions;
  },
  supportsPopulation: true,
  Screen: ToolboxPreviewScreen,
};
