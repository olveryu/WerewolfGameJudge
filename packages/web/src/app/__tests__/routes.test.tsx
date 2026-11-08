import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { routes } from '@/app/routes';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
}

describe('routes', () => {
  it('lazy-loads the home page at /', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { name: '狼人面杀电子裁判助手' })).toBeDefined();
  });

  it('renders the not-found page for an unknown path', async () => {
    renderAt('/no-such-page');
    expect(await screen.findByRole('heading', { name: '页面不存在' })).toBeDefined();
  });
});
