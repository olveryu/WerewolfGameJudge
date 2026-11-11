import { type RouteObject } from 'react-router';

import { AppRoot } from '@/app/AppRoot';
import { RouteErrorPage } from '@/app/RouteErrorPage';
import { LoadingScreen } from '@/components/LoadingScreen';
import { AdminPage } from '@/routes/admin/AdminPage';
import { SceneBenchPage } from '@/routes/bench/SceneBenchPage';
import { AppearancePage, UnlocksPage } from '@/routes/cosmeticPages';
import { GachaPage, ShardExchangePage } from '@/routes/gachaPages';
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

/**
 * Route table. Every page is statically imported so it ships in the start-up entry
 * (v4 D11: global non-lazy — no route chunk is downloaded on first visit);
 * paths match the current client, including `/room/:code`.
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppRoot />,
    // Rendered while the router hydrates on first load.
    HydrateFallback: LoadingScreen,
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
        path: 'admin',
        Component: AdminPage,
      },
      {
        path: '__bench/scene',
        Component: SceneBenchPage,
      },
    ],
  },
];
