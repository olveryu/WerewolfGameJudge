/**
 * tokens.test — Design token structural integrity tests
 *
 * Ensures token exports are complete and semantically ordered.
 * Does not test runtime behavior — that's covered by screen/component tests.
 */
import {
  borderRadius,
  componentSizes,
  fixed,
  layout,
  shadows,
  spacing,
  textStyles,
  typography,
} from '../tokens';

describe('spacing', () => {
  it('has all semantic keys', () => {
    const keys = Object.keys(spacing);
    expect(keys).toEqual(
      expect.arrayContaining([
        'micro',
        'tight',
        'small',
        'medium',
        'large',
        'xlarge',
        'xxlarge',
        'screenH',
      ]),
    );
  });

  it('values are strictly ascending', () => {
    const ordered = [
      spacing.micro,
      spacing.tight,
      spacing.small,
      spacing.medium,
      spacing.large,
      spacing.xlarge,
      spacing.xxlarge,
    ];
    for (let i = 1; i < ordered.length; i++) {
      expect(ordered[i]).toBeGreaterThan(ordered[i - 1]);
    }
  });
});

describe('typography', () => {
  it('font sizes are strictly ascending', () => {
    const ordered = [
      typography.captionSmall,
      typography.caption,
      typography.secondary,
      typography.body,
      typography.subtitle,
      typography.title,
      typography.heading,
      typography.hero,
      typography.display,
    ];
    for (let i = 1; i < ordered.length; i++) {
      expect(ordered[i]).toBeGreaterThan(ordered[i - 1]);
    }
  });

  it('every font size has a matching lineHeight', () => {
    const sizeKeys = [
      'captionSmall',
      'caption',
      'secondary',
      'body',
      'subtitle',
      'title',
      'heading',
      'hero',
      'display',
    ] as const;
    for (const key of sizeKeys) {
      expect(typography.lineHeights[key]).toBeGreaterThan(typography[key]);
    }
  });
});

describe('textStyles presets', () => {
  it('every preset has fontSize and lineHeight', () => {
    for (const [name, style] of Object.entries(textStyles)) {
      expect(style).toHaveProperty('fontSize', expect.any(Number));
      expect(style).toHaveProperty('lineHeight', expect.any(Number));
      // lineHeight must be >= fontSize
      const s = style as { fontSize: number; lineHeight: number };
      expect(s.lineHeight).toBeGreaterThanOrEqual(s.fontSize);
      // Avoid the name being unused in assertion messages
      void name;
    }
  });
});

describe('borderRadius', () => {
  it('has expected keys', () => {
    expect(Object.keys(borderRadius)).toEqual(
      expect.arrayContaining(['none', 'small', 'medium', 'large', 'xlarge', 'full']),
    );
  });

  it('full is 9999', () => {
    expect(borderRadius.full).toBe(9999);
  });
});

describe('shadows', () => {
  it('has all standard levels', () => {
    expect(Object.keys(shadows)).toEqual(
      expect.arrayContaining(['none', 'sm', 'md', 'lg', 'upward', 'lgUpward']),
    );
  });
});

describe('componentSizes', () => {
  it('button sizes are ascending sm < md < lg', () => {
    expect(componentSizes.button.sm).toBeLessThan(componentSizes.button.md);
    expect(componentSizes.button.md).toBeLessThan(componentSizes.button.lg);
  });

  it('avatar sizes are ascending xs < sm < md < lg < xl', () => {
    const { xs, sm, md, lg, xl } = componentSizes.avatar;
    expect(xs).toBeLessThan(sm);
    expect(sm).toBeLessThan(md);
    expect(md).toBeLessThan(lg);
    expect(lg).toBeLessThan(xl);
  });
});

describe('fixed', () => {
  it('disabledOpacity is 0.5', () => {
    expect(fixed.disabledOpacity).toBe(0.5);
  });

  it('activeOpacity is 0.7', () => {
    expect(fixed.activeOpacity).toBe(0.7);
  });

  it('minTouchTarget meets accessibility minimum', () => {
    expect(fixed.minTouchTarget).toBeGreaterThanOrEqual(44);
  });
});

describe('layout', () => {
  it('screenPaddingH equals spacing.screenH', () => {
    expect(layout.screenPaddingH).toBe(spacing.screenH);
  });

  it('cardPadding equals spacing.medium', () => {
    expect(layout.cardPadding).toBe(spacing.medium);
  });
});
