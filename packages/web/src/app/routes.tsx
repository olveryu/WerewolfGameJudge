import { Navigate, type RouteObject } from 'react-router';

import { AdminRoot } from '@/app/AdminRoot';
import { AppRoot } from '@/app/AppRoot';
import { RouteErrorPage } from '@/app/RouteErrorPage';
import { D1UsagePage } from '@/routes/admin/pages/D1UsagePage';
import { MaintenanceSettingsPage } from '@/routes/admin/pages/MaintenanceSettingsPage';
import { AiPage, GrowthPage, PerformancePage } from '@/routes/admin/pages/MonitoringPages';
import { OverviewPage } from '@/routes/admin/pages/OverviewPage';
import { RoomsPage } from '@/routes/admin/pages/RoomsPage';
import { TrafficPage } from '@/routes/admin/pages/TrafficPage';
import { UsersPage } from '@/routes/admin/pages/UsersPage';
import { WordsPage } from '@/routes/admin/pages/WordsPage';
import { AppearancePage } from '@/routes/appearance/AppearancePage';
import { SceneBenchPage } from '@/routes/bench/SceneBenchPage';
import { GachaPage } from '@/routes/gacha/GachaPage';
import {
  GameConfigRoutePage,
  GameGuideRoutePage,
  GameNotepadRoutePage,
} from '@/routes/game/GameRoutePage';
import { GamePickerPage } from '@/routes/games/GamePickerPage';
import { HomePage } from '@/routes/home/HomePage';
import { RoomPage, RoomPageError } from '@/routes/room/RoomPage';
import { MusicSettingsPage } from '@/routes/settings/MusicSettingsPage';
import { SettingsPage } from '@/routes/settings/SettingsPage';
import { ShardExchangePage } from '@/routes/shardExchange/ShardExchangePage';
import { UnlocksPage } from '@/routes/unlocks/UnlocksPage';

/**
 * Route table. Every page is statically imported so it ships in the start-up entry and no
 * navigation waits on a route chunk (docs/web-client-rewrite.md §5.10); paths match the
 * current client, including `/room/:code`.
 */
export const routes: RouteObject[] = [
  {
    path: '/admin',
    Component: AdminRoot,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, Component: OverviewPage },
      { path: 'maintenance', Component: MaintenanceSettingsPage },
      { path: 'users', Component: UsersPage },
      { path: 'rooms', Component: RoomsPage },
      { path: 'words', element: <Navigate to="/admin/words/fibking" replace /> },
      { path: 'words/:game', Component: WordsPage },
      { path: 'growth', Component: GrowthPage },
      { path: 'performance', Component: PerformancePage },
      { path: 'traffic', Component: TrafficPage },
      { path: 'd1', Component: D1UsagePage },
      { path: 'ai', Component: AiPage },
    ],
  },
  {
    path: '/',
    element: <AppRoot />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        index: true,
        Component: HomePage,
      },
      {
        path: 'games',
        Component: GamePickerPage,
      },
      {
        path: 'room/:roomCode',
        Component: RoomPage,
        ErrorBoundary: RoomPageError,
      },
      {
        path: 'game/:gameType/config/:mode/:roomCode?',
        Component: GameConfigRoutePage,
      },
      {
        path: 'game/:gameType/guide/:roomCode?',
        Component: GameGuideRoutePage,
      },
      {
        path: 'game/:gameType/notepad/:roomCode',
        Component: GameNotepadRoutePage,
      },
      {
        path: 'settings/music/:roomCode?',
        Component: MusicSettingsPage,
      },
      {
        path: 'settings/:roomCode?',
        Component: SettingsPage,
      },
      {
        path: 'appearance/:roomCode?',
        Component: AppearancePage,
      },
      {
        path: 'unlocks/:roomCode?',
        Component: UnlocksPage,
      },
      {
        path: 'gacha/:roomCode?',
        Component: GachaPage,
      },
      {
        path: 'shard-exchange/:roomCode?',
        Component: ShardExchangePage,
      },
      {
        path: '__bench/scene',
        Component: SceneBenchPage,
      },
    ],
  },
];
