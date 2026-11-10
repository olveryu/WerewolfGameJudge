import { type RouteObject } from 'react-router';

import { AppRoot } from '@/app/AppRoot';
import { RouteErrorPage } from '@/app/RouteErrorPage';
import { LoadingScreen } from '@/components/LoadingScreen';

/** Appearance and Unlocks share one lazy chunk, so one loader serves both routes. */
const loadCosmeticPages = () => import('@/routes/cosmeticPages');
/** Gacha and Shard Exchange share one lazy chunk, so one loader serves both routes. */
const loadGachaPages = () => import('@/routes/gachaPages');

/**
 * Route table. Each page is a `lazy` route so it ships as its own chunk
 * (docs/web-client-rewrite.md §5.10); paths match the current client, including `/room/:code`.
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppRoot />,
    // Rendered until the first match's lazy route module has loaded.
    HydrateFallback: LoadingScreen,
    errorElement: <RouteErrorPage />,
    children: [
      {
        index: true,
        lazy: async () => {
          const { HomePage } = await import('@/routes/home/HomePage');
          return { Component: HomePage };
        },
      },
      {
        path: 'games',
        lazy: async () => {
          const { GamePickerPage } = await import('@/routes/games/GamePickerPage');
          return { Component: GamePickerPage };
        },
      },
      {
        path: 'room/:roomCode',
        lazy: async () => {
          const { RoomPage, RoomPageError } = await import('@/routes/room/RoomPage');
          return { Component: RoomPage, ErrorBoundary: RoomPageError };
        },
      },
      {
        path: 'game/:gameType/config/:mode/:roomCode?',
        lazy: async () => {
          const { GameConfigRoutePage } = await import('@/routes/game/GameRoutePage');
          return { Component: GameConfigRoutePage };
        },
      },
      {
        path: 'game/:gameType/guide/:roomCode?',
        lazy: async () => {
          const { GameGuideRoutePage } = await import('@/routes/game/GameRoutePage');
          return { Component: GameGuideRoutePage };
        },
      },
      {
        path: 'game/:gameType/notepad/:roomCode',
        lazy: async () => {
          const { GameNotepadRoutePage } = await import('@/routes/game/GameRoutePage');
          return { Component: GameNotepadRoutePage };
        },
      },
      {
        path: 'settings/music/:roomCode?',
        lazy: async () => {
          const { MusicSettingsPage } = await import('@/routes/settings/MusicSettingsPage');
          return { Component: MusicSettingsPage };
        },
      },
      {
        path: 'settings/:roomCode?',
        lazy: async () => {
          const { SettingsPage } = await import('@/routes/settings/SettingsPage');
          return { Component: SettingsPage };
        },
      },
      {
        path: 'appearance/:roomCode?',
        lazy: async () => {
          const { AppearancePage } = await loadCosmeticPages();
          return { Component: AppearancePage };
        },
      },
      {
        path: 'unlocks/:roomCode?',
        lazy: async () => {
          const { UnlocksPage } = await loadCosmeticPages();
          return { Component: UnlocksPage };
        },
      },
      {
        path: 'gacha/:roomCode?',
        lazy: async () => {
          const { GachaPage } = await loadGachaPages();
          return { Component: GachaPage };
        },
      },
      {
        path: 'shard-exchange/:roomCode?',
        lazy: async () => {
          const { ShardExchangePage } = await loadGachaPages();
          return { Component: ShardExchangePage };
        },
      },
      {
        path: '__bench/scene',
        lazy: async () => {
          const { SceneBenchPage } = await import('@/routes/bench/SceneBenchPage');
          return { Component: SceneBenchPage };
        },
      },
    ],
  },
];
