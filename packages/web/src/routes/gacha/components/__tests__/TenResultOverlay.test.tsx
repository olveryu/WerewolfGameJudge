import { render, screen } from '@testing-library/react';

import type { DrawResultItem } from '@/features/gacha/services/gachaApi';
import type { ClientProductUi } from '@/features/product/model/ClientProductUi';

import { TenResultOverlay } from '../TenResultOverlay';

vi.mock('@/features/product/components/ResidentPreview', () => ({
  ResidentSceneLayer: () => null,
}));

vi.mock('../RewardPreview', () => ({
  getRewardDisplayName: (_productUi: unknown, _rewardType: unknown, rewardId: string) => rewardId,
  RewardPreview: () => null,
}));

const productUi: ClientProductUi = {
  getAvatarDisplayName: (avatarId) => avatarId,
  getRevealEffectPresentation: () => {
    throw new Error('Reveal presentation is not used by this test');
  },
};

function result(index: number): DrawResultItem {
  return {
    rarity: 'common',
    rewardType: 'avatar',
    rewardId: `avatar-${index}`,
    isNew: true,
    isPityTriggered: false,
    isDuplicate: false,
    shardsAwarded: 0,
  };
}

describe('TenResultOverlay', () => {
  it.each([
    { drawType: 'normal' as const, count: 2, title: '2连抽结果' },
    { drawType: 'golden' as const, count: 5, title: '黄金5连抽结果' },
    { drawType: 'normal' as const, count: 10, title: '10连抽结果' },
  ])('shows the actual count for $drawType draws of $count', ({ drawType, count, title }) => {
    render(
      <TenResultOverlay
        results={Array.from({ length: count }, (_, index) => result(index))}
        drawType={drawType}
        productUi={productUi}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
  });
});
