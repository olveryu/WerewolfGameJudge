import type { SecrethitlerPhaseKind } from '@game-judge/game-engine/games/secrethitler/public';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMemo } from 'react';
import { MemoryRouter, Route, Routes, useNavigate, useParams } from 'react-router';

import { AlertHostSlot } from '@/components/AlertHostSlot';
import { AuthProvider, useAuthContext } from '@/contexts/AuthContext';
import { ServiceProvider } from '@/contexts/ServiceContext';
import { createGameConfigDefiner } from '@/features/room/config/createGameConfigScreen';
import { getSecrethitlerIdentityName } from '@/games/secrethitler/components/SecrethitlerRoleCardAdapter';
import { defineSecrethitlerConfig } from '@/games/secrethitler/module';
import { secrethitlerReview } from '@/games/secrethitler/review/secrethitlerReview';
import { SECRETHITLER_PHASE_LABELS } from '@/games/secrethitler/room/secrethitlerPresentation';
import { SecrethitlerRoomScreen } from '@/games/secrethitler/room/SecrethitlerRoomScreen';
import { SecrethitlerRulesScreen } from '@/games/secrethitler/screens/SecrethitlerRulesScreen';
import { GamePickerPage } from '@/routes/games/GamePickerPage';
import { HomePage } from '@/routes/home/HomePage';
import { buildSecrethitlerPhaseStates } from '@/test-utils/secrethitlerState';
import { showErrorAlert } from '@/utils/alertPresets';

import { createPreviewRoomLink, createPreviewServices, previewAudio } from './offlineServices';
import type { PreviewGame, PreviewPage } from './previewGames';

const states = buildSecrethitlerPhaseStates();
const phaseOptions = Array.from(states.keys());
const ConfigScreen = defineSecrethitlerConfig(
  createGameConfigDefiner('secrethitler', '秘密希特勒'),
);
const room = {
  roomCode: '1234',
  roomId: 'preview-room',
  gameType: 'secrethitler',
  hostUserId: 'host',
  createdAt: new Date('2026-01-01T00:00:00Z'),
} as const;

function isPhase(value: string): value is SecrethitlerPhaseKind {
  return phaseOptions.some((phase) => phase === value);
}

function unsupported() {
  showErrorAlert('离线预览', '此入口尚未接入预览，不会连接真实服务。');
}

function PreviewRoutes({
  phase,
  viewerSeat,
}: {
  readonly phase: SecrethitlerPhaseKind;
  readonly viewerSeat: number;
}) {
  const navigate = useNavigate();
  const fixture = states.get(phase);
  if (fixture === undefined) throw new Error(`Missing preview state: ${phase}`);
  const userId = viewerId(viewerSeat);
  const state = useMemo(
    () =>
      viewerSeat < 2
        ? fixture
        : {
            ...fixture,
            roster: {
              ...fixture.roster,
              [viewerSeat]: { seat: viewerSeat, userId, profile: { displayName: '预览玩家' } },
            },
          },
    [fixture, userId, viewerSeat],
  );
  const link = useMemo(() => createPreviewRoomLink(state, { room, userId }), [state, userId]);
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/games" element={<GamePickerPage />} />
      <Route path="/game/:gameType/config/:mode/:roomCode?" element={<ConfigRoute link={link} />} />
      <Route path="/game/secrethitler/guide/:roomCode?" element={<SecrethitlerRulesScreen />} />
      <Route
        path="/room/:roomCode"
        element={
          <SecrethitlerRoomScreen
            room={room}
            entryReason={null}
            session={link}
            audio={previewAudio}
            review={secrethitlerReview}
            onOpenMusicSettings={unsupported}
            onOpenRoomSettings={() => void navigate('/game/secrethitler/config/edit/1234')}
            onOpenUserSettings={unsupported}
          />
        }
      />
      <Route path="*" element={<p role="status">此页面尚未接入离线预览。</p>} />
    </Routes>
  );
}

function viewerId(seat: number): string {
  return seat === 0 ? 'host' : seat === 1 ? 'u1' : `preview-seat-${seat}`;
}

function AuthenticatedPreviewRoutes(props: {
  readonly phase: SecrethitlerPhaseKind;
  readonly viewerSeat: number;
}) {
  const { loading, error, user } = useAuthContext();
  if (loading) return <p role="status">正在加载预览账号…</p>;
  if (error !== null || user === null) throw new Error(error ?? '预览账号未就绪');
  return <PreviewRoutes {...props} />;
}

function ConfigRoute({ link }: { readonly link: ReturnType<typeof createPreviewRoomLink> }) {
  const { gameType } = useParams();
  if (gameType !== 'secrethitler') return <p role="status">该游戏尚未接入离线预览。</p>;
  return <ConfigScreen session={link} />;
}

const pagePaths: Record<PreviewPage, string> = {
  home: '/',
  config: '/game/secrethitler/config/create',
  room: '/room/1234',
};

/** Renders production pages against a fictional local account and room. */
function SecrethitlerPreviewScreen({
  phase,
  viewer,
  page,
}: {
  readonly phase: string;
  readonly viewer: string;
  readonly page: PreviewPage;
}) {
  if (!isPhase(phase)) throw new Error(`Unknown Secret Hitler preview phase: ${phase}`);
  const viewerSeat = Number(viewer);
  if (!Number.isInteger(viewerSeat) || viewerSeat < 0 || viewerSeat >= 8)
    throw new Error(`Unknown Secret Hitler preview viewer: ${viewer}`);
  const userId = viewerId(viewerSeat);
  const services = useMemo(() => createPreviewServices(userId), [userId]);
  const queryClient = useMemo(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    [],
  );
  return (
    <QueryClientProvider client={queryClient}>
      <ServiceProvider services={services}>
        <MemoryRouter initialEntries={[pagePaths[page]]}>
          <AuthProvider key={userId}>
            <div className="preview-content">
              <AuthenticatedPreviewRoutes phase={phase} viewerSeat={viewerSeat} />
            </div>
            <AlertHostSlot />
          </AuthProvider>
        </MemoryRouter>
      </ServiceProvider>
    </QueryClientProvider>
  );
}

/** Secret Hitler's real screens and deterministic scenarios for the shared preview host. */
export const secrethitlerPreview: PreviewGame = {
  id: 'secrethitler',
  label: '秘密希特勒',
  phases: phaseOptions.map((phase) => ({ id: phase, label: SECRETHITLER_PHASE_LABELS[phase] })),
  viewers: (phase) => {
    if (!isPhase(phase)) throw new Error(`Unknown Secret Hitler preview phase: ${phase}`);
    const state = states.get(phase);
    if (state === undefined) throw new Error(`Missing preview state: ${phase}`);
    return Array.from({ length: state.config.numberOfPlayers }, (_, seat) => {
      const identity = state.identities[seat];
      const label = identity === undefined ? '身份未分配' : getSecrethitlerIdentityName(identity);
      return {
        id: String(seat),
        label: `${seat + 1}号${seat === 0 ? '（房主）' : ''} · ${label}`,
      };
    });
  },
  Screen: SecrethitlerPreviewScreen,
};
