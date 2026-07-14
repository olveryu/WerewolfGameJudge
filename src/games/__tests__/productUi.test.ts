import type { GameProductUiContribution } from '@/features/product/model/GameProductUi';
import { createClientProductUi } from '@/games/productUi';

const Preview = () => null;

const werewolfContribution: GameProductUiContribution = {
  getAvatarDisplayName: (id) => (id === 'wolf' ? '狼人' : null),
  getRevealEffectPresentation: (id) =>
    id === 'roulette'
      ? {
          id: 'roulette',
          label: '轮盘',
          icon: 'radio-button-on-outline',
          shortDescription: '自动旋转',
          Preview,
        }
      : null,
};

describe('createClientProductUi', () => {
  it('owns generated avatar labels in the product catalog', () => {
    const productUi = createClientProductUi([werewolfContribution]);

    expect(productUi.getAvatarDisplayName('genC001')).toBe('色环 001');
    expect(productUi.getAvatarDisplayName('genR001')).toBe('人像 001');
  });

  it('resolves game-owned avatar and reveal-effect presentation', () => {
    const productUi = createClientProductUi([werewolfContribution]);

    expect(productUi.getAvatarDisplayName('wolf')).toBe('狼人');
    expect(productUi.getRevealEffectPresentation('roulette').label).toBe('轮盘');
  });

  it('fails fast for missing or duplicate game owners', () => {
    const missing = createClientProductUi([
      {
        getAvatarDisplayName: () => null,
        getRevealEffectPresentation: () => null,
      },
    ]);
    const duplicate = createClientProductUi([werewolfContribution, werewolfContribution]);

    expect(() => missing.getRevealEffectPresentation('roulette')).toThrow(
      'Expected exactly one product UI owner for reveal effect roulette',
    );
    expect(() => duplicate.getAvatarDisplayName('wolf')).toThrow(
      'Expected exactly one product UI owner for avatar wolf',
    );
  });
});
