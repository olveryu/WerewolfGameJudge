import { type RouteObject } from 'react-router';

import { AdminRoot } from '@/app/AdminRoot';
import { AppRoot } from '@/app/AppRoot';
import { RouteErrorPage } from '@/app/RouteErrorPage';
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
