import { type RouteObject } from 'react-router';

import { RouteErrorPage } from '@/app/RouteErrorPage';

/**
 * Route table. Each page is a `lazy` route so it ships as its own chunk
 * (docs/web-client-rewrite.md §5.10); paths match the current client, including `/room/:code`.
 */
export const routes: RouteObject[] = [
  {
    path: '/',
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
        path: '__bench/scene',
        lazy: async () => {
          const { SceneBenchPage } = await import('@/routes/bench/SceneBenchPage');
          return { Component: SceneBenchPage };
        },
      },
    ],
  },
];
