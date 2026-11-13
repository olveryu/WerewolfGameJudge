import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, type RouteObject, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { queryClient } from '@/app/queryClient';
import { routes } from '@/app/routes';
import { fetchMaintenance, formatMaintenanceEnd } from '@/features/maintenance/maintenance';
import { TESTIDS } from '@/testids';

vi.mock('@/features/maintenance/maintenance', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/maintenance/maintenance')>()),
  fetchMaintenance: vi.fn(),
}));

const maintenance = {
  enabled: false,
  message: '系统升级中',
  endsAt: '2099-01-02T09:00:00+08:00',
};

beforeEach(() => {
  vi.mocked(fetchMaintenance).mockResolvedValue(maintenance);
});

afterEach(() => {
  queryClient.clear();
  vi.clearAllMocks();
});

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
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

  it('offers home recovery when a page fails to render', async () => {
    const user = userEvent.setup();
    const router = renderAt('/games');
    expect(await screen.findByRole('heading', { name: '出错了' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: '返回首页' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(screen.getByTestId(TESTIDS.homeScreenRoot)).toBeInTheDocument();
  });

  it('replaces player routes with the maintenance page when enabled', async () => {
    vi.mocked(fetchMaintenance).mockResolvedValue({ ...maintenance, enabled: true });
    renderAt('/room/1234');
    expect(await screen.findByRole('heading', { name: '系统维护中' })).toBeInTheDocument();
    expect(screen.getByText(formatMaintenanceEnd(maintenance.endsAt))).toBeInTheDocument();
  });

  it.each(['/admin', '/admin/users', '/admin/maintenance'])(
    'keeps %s login outside the player maintenance and authentication boundary',
    async (path) => {
      vi.mocked(fetchMaintenance).mockRejectedValue(new Error('D1 unavailable'));
      renderAt(path);
      expect(await screen.findByLabelText('管理密码')).toBeInTheDocument();
      expect(fetchMaintenance).not.toHaveBeenCalled();
    },
  );
});
