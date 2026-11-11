import { fireEvent, render, screen } from '@testing-library/react';
import { Container } from 'pixi.js';

import { RevealCardFace } from '@/features/room/components/RoleRevealEffects/common/RevealCardFace';
import {
  RevealScene,
  RevealSceneContext,
} from '@/features/room/components/RoleRevealEffects/runtime';
import { ALIGNMENT_THEMES } from '@/features/room/components/RoleRevealEffects/themes';
import type { RevealEffectProps } from '@/features/room/components/RoleRevealEffects/types';
import { getRoleAvatar } from '@/games/werewolf/assets/roleAvatars';
import { werewolfProductUi } from '@/games/werewolf/productUi';
import { TESTIDS } from '@/testids';

const stage = vi.hoisted(() => ({ reducedMotion: false }));

vi.mock('@/scene/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => stage.reducedMotion,
}));

// Keep the real card renderer, replacing only the WebGL stage and effect choreography.
vi.mock('@/features/room/components/RoleRevealEffects/RevealEffectStage', () => ({
  default: ({ effectProps }: { effectProps: RevealEffectProps }) => (
    <RevealSceneContext value={new RevealScene(new Container())}>
      {effectProps.allRoles.map((role) => (
        <RevealCardFace
          key={role.id}
          role={role}
          width={280}
          height={400}
          revealGradient={ALIGNMENT_THEMES[role.alignment].revealGradient}
        />
      ))}
      <button onClick={effectProps.onComplete}>
        {effectProps.reducedMotion ? '完成静态预览' : '完成动画预览'}
      </button>
    </RevealSceneContext>
  ),
}));

describe('Werewolf product reveal preview', () => {
  afterEach(() => {
    stage.reducedMotion = false;
  });

  it('renders portraits instead of initial-letter squares for the target and candidate cards', () => {
    const presentation = werewolfProductUi.getRevealEffectPresentation('tarot');
    if (presentation === null) throw new Error('Missing tarot presentation');
    render(<presentation.Preview effectId="tarot" onComplete={() => {}} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByTestId(TESTIDS.roleBadge)).not.toBeInTheDocument();
    expect(screen.queryByText('村', { exact: true })).not.toBeInTheDocument();
    const portraits = document.querySelectorAll('img');
    expect([...portraits].map((portrait) => portrait.getAttribute('src'))).toEqual([
      getRoleAvatar('villager'),
      getRoleAvatar('wolf'),
      getRoleAvatar('seer'),
      getRoleAvatar('witch'),
      getRoleAvatar('hunter'),
      getRoleAvatar('guard'),
    ]);
    expect(screen.getByText('平民')).toBeInTheDocument();
  });

  it.each([false, true])('preserves completion with reduced motion %s', (reducedMotion) => {
    stage.reducedMotion = reducedMotion;
    const presentation = werewolfProductUi.getRevealEffectPresentation('tarot');
    if (presentation === null) throw new Error('Missing tarot presentation');
    const onComplete = vi.fn();
    render(<presentation.Preview effectId="tarot" onComplete={onComplete} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: reducedMotion ? '完成静态预览' : '完成动画预览',
      }),
    );
    expect(onComplete).toHaveBeenCalledOnce();
  });
});
