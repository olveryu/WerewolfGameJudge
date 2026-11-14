/** Reveal semantic characters without breaking emoji or changing paragraph layout/content. */

import { render, screen } from '@testing-library/react';

import { useRevealProgress } from '@/features/room/hooks/useRevealProgress';

import { GalleryRevealText } from '../GalleryRevealText';

vi.mock('@/features/room/hooks/useRevealProgress', () => ({ useRevealProgress: vi.fn() }));

it('keeps the complete text accessible while revealing a family emoji as one unit', () => {
  vi.mocked(useRevealProgress).mockReturnValue(1 / 3);
  const { rerender } = render(
    <p>
      <GalleryRevealText text="甲👩‍👩‍👧‍👦乙" timing={null} clock={null} />
    </p>,
  );
  expect(screen.getByRole('paragraph')).toHaveTextContent('甲👩‍👩‍👧‍👦乙');
  expect(screen.getByText('👩‍👩‍👧‍👦乙')).toHaveClass('gallery-reveal-pending');
  vi.mocked(useRevealProgress).mockReturnValue(2 / 3);
  rerender(
    <p>
      <GalleryRevealText text="甲👩‍👩‍👧‍👦乙" timing={null} clock={null} />
    </p>,
  );
  expect(screen.getByText('乙')).toHaveClass('gallery-reveal-pending');
  expect(screen.getByRole('paragraph')).toHaveTextContent('甲👩‍👩‍👧‍👦乙');
});

it('shows full text on supported older WebViews without Intl.Segmenter', () => {
  const original = Intl.Segmenter;
  Reflect.set(Intl, 'Segmenter', undefined);
  try {
    render(
      <p>
        <GalleryRevealText text="完整👩‍👩‍👧‍👦" timing={null} clock={null} />
      </p>,
    );
    expect(screen.getByText('完整👩‍👩‍👧‍👦')).toBeVisible();
    expect(screen.getByRole('paragraph')).toHaveTextContent('完整👩‍👩‍👧‍👦');
  } finally {
    Reflect.set(Intl, 'Segmenter', original);
  }
});
