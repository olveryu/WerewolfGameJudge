import { type RouteObject } from 'react-router';

import { AppRoot } from '@/app/AppRoot';
import { RouteErrorPage } from '@/app/RouteErrorPage';

/**
 * Route table. Each page is a `lazy` route so it ships as its own chunk
 * (docs/web-client-rewrite.md §5.10); paths match the current client, including `/room/:code`.
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppRoot />,
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
        path: 'settings/:roomCode?',
        lazy: async () => {
          const { SettingsPage } = await import('@/routes/settings/SettingsPage');
          return { Component: SettingsPage };
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
