import { render, screen } from '@testing-library/react';

import { Avatar } from '../Avatar';

/*
 * The corners themselves live in Avatar.css (jsdom applies no stylesheet); the visual gate's
 * render probe (e2e/visual/avatarShapeProbe.ts) measures them on real pages.
 */
describe('Avatar', () => {
  it.each([
    ['an uploaded image', 'https://example.test/a.png'],
    ['a generated avatar', 'builtin://genC001'],
    ['the wolf-paw fallback', null],
  ])('hands %s its size as a custom property, and no inline shape', (_label, avatarUrl) => {
    const { unmount } = render(<Avatar userId="u1" avatarUrl={avatarUrl} size={36} />);
    const fixed = screen.getByRole('img', { name: '头像' });
    expect(fixed).toHaveClass('avatar');
    expect(fixed.style.getPropertyValue('--avatar-size')).toBe('36px');
    expect(fixed.style.borderRadius).toBe('');
    expect(fixed.style.width).toBe('');
    unmount();

    render(<Avatar userId="u1" avatarUrl={avatarUrl} size="fill" />);
    const filling = screen.getByRole('img', { name: '头像' });
    expect(filling).toHaveAttribute('data-fill', 'true');
    expect(filling.style.getPropertyValue('--avatar-size')).toBe('');
    expect(filling.style.borderRadius).toBe('');
  });

  it('hands the fallback its tint and mask as custom properties', () => {
    render(<Avatar userId="u1" avatarUrl={null} size={36} />);
    const mark = screen.getByRole('img', { name: '头像' }).querySelector('.avatar-fallback-mark');
    if (!(mark instanceof HTMLElement)) throw new Error('fallback mark missing');
    expect(mark.style.getPropertyValue('--avatar-tint')).not.toBe('');
    expect(mark.style.getPropertyValue('--avatar-mask')).toMatch(/^url\(.+\)$/);
    expect(mark.style.maskImage).toBe('');
  });

  it.each(['genC001', 'genR001'])('lets %s fill its square, with no shape of its own', (id) => {
    render(<Avatar userId="u1" avatarUrl={`builtin://${id}`} size={36} />);
    const avatar = screen.getByRole('img', { name: '头像' });
    const svg = avatar.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.querySelector('mask, clipPath, [mask], [clip-path]')).toBeNull();
  });
});
