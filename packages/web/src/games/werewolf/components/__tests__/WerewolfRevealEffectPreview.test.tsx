import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ROLE_REVEAL_EFFECT_IDS } from '@game-judge/game-engine/product/rewards';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Container } from 'pixi.js';

import { createClientProductUi } from '@/features/product/model/ClientProductUi';
import { RevealCardFace } from '@/features/room/components/RoleRevealEffects/common/RevealCardFace';
import {
  RevealScene,
  RevealSceneContext,
} from '@/features/room/components/RoleRevealEffects/runtime';
import { ALIGNMENT_THEMES } from '@/features/room/components/RoleRevealEffects/themes';
import type { RevealEffectProps } from '@/features/room/components/RoleRevealEffects/types';
import { loadGameProductUiContributions } from '@/games/productUiCatalog';
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

  it.each(ROLE_REVEAL_EFFECT_IDS)(
    'plays %s in the shared reveal dialog above every page layer, dismissible with Escape',
    async (effectId) => {
      const productUi = createClientProductUi(await loadGameProductUiContributions());
      const { Preview } = productUi.getRevealEffectPresentation(effectId);
      // The appearance page: a lifted, selected cell with its badge, inside the app root.
      const root = document.createElement('div');
      root.id = 'root';
      document.body.append(root);
      const cell = document.createElement('div');
      cell.style.zIndex = '1';
      cell.style.transform = 'translateY(-4px)';
      root.append(cell);
      const onComplete = vi.fn();
      render(<Preview effectId={effectId} onComplete={onComplete} />, { container: cell });

      const dialog = await screen.findByRole('dialog');
      expect(dialog).toHaveAttribute('data-testid', 'role-reveal-modal');
      expect(root.contains(dialog)).toBe(false);
      expect(document.body.contains(dialog)).toBe(true);
      await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

      await userEvent.keyboard('{Escape}');
      expect(onComplete).toHaveBeenCalledOnce();
      root.remove();
    },
  );

  it('relies on the app root isolating page z-indexes below body-level portals', () => {
    const globalCss = readFileSync(join(import.meta.dirname, '../../../../global.css'), 'utf8');
    expect(globalCss).toMatch(/#root\s*\{[^}]*isolation:\s*isolate;/);
  });
});
