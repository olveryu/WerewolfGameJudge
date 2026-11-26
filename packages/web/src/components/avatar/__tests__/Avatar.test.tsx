import { render, screen } from '@testing-library/react';

import { AVATAR_CORNER_RATIO } from '@/config/avatarShape';

import { Avatar } from '../Avatar';

const CORNER = `${AVATAR_CORNER_RATIO * 100}%`;

describe('Avatar', () => {
  it.each([
    ['an uploaded image', 'https://example.test/a.png'],
    ['a generated avatar', 'builtin://genC001'],
    ['the wolf-paw fallback', null],
  ])('gives %s the one corner at a fixed size and when filling', (_label, avatarUrl) => {
    const { unmount } = render(<Avatar userId="u1" avatarUrl={avatarUrl} size={36} />);
    const fixed = screen.getByRole('img', { name: '头像' });
    expect(fixed.style.width).toBe('36px');
    expect(fixed.style.borderRadius).toBe(CORNER);
    unmount();

    render(<Avatar userId="u1" avatarUrl={avatarUrl} size="fill" />);
    expect(screen.getByRole('img', { name: '头像' }).style.borderRadius).toBe(CORNER);
  });

  it.each(['genC001', 'genR001'])('lets %s fill its square, with no shape of its own', (id) => {
    render(<Avatar userId="u1" avatarUrl={`builtin://${id}`} size={36} />);
    const avatar = screen.getByRole('img', { name: '头像' });
    const svg = avatar.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.querySelector('mask, clipPath, [mask], [clip-path]')).toBeNull();
  });
});
