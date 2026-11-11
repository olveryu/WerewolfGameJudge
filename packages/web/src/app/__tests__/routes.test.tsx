import { render, screen } from '@testing-library/react';
import { createMemoryRouter, type RouteObject, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { routes } from '@/app/routes';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
}

describe('routes', () => {
  it('declares no lazy route, so no navigation waits on a route chunk', () => {
    const lazyRoutePaths: string[] = [];
    const collectLazyRoutes = (routeObjects: readonly RouteObject[]) => {
      for (const route of routeObjects) {
        if (route.lazy !== undefined) lazyRoutePaths.push(route.path ?? '(index)');
        if (route.children !== undefined) collectLazyRoutes(route.children);
      }
    };
    collectLazyRoutes(routes);
    expect(lazyRoutePaths).toEqual([]);
  });

  it('renders the home page at /', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { name: '狼人面杀电子裁判助手' })).toBeDefined();
  });

  it('renders the not-found page for an unknown path', async () => {
    renderAt('/no-such-page');
    expect(await screen.findByRole('heading', { name: '页面不存在' })).toBeDefined();
  });
});
