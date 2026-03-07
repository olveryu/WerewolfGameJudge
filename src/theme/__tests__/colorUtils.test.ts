import { darken, lighten, withAlpha } from '../colorUtils';

describe('colorUtils', () => {
  describe('withAlpha', () => {
    it('appends correct hex alpha for common opacities', () => {
      // 0% → '00', 100% → 'FF'
      expect(withAlpha('#FF0000', 0)).toBe('#FF000000');
      expect(withAlpha('#FF0000', 1)).toBe('#FF0000FF');
    });

    it('converts decimal opacity to 2-digit hex', () => {
      // 0.09 ≈ 23/255 → 0x17 = '17'  (rounds to 23)
      expect(withAlpha('#DC2626', 0.09)).toBe('#DC262617');
      // 0.12 ≈ 31/255 → 0x1F = '1F'
      expect(withAlpha('#6366F1', 0.12)).toBe('#6366F11F');
      // 0.19 ≈ 48/255 → 0x30 = '30'
      expect(withAlpha('#7C3AED', 0.19)).toBe('#7C3AED30');
      // 0.25 ≈ 64/255 → 0x40 = '40'
      expect(withAlpha('#F59E0B', 0.25)).toBe('#F59E0B40');
      // 0.50 ≈ 128/255 → 0x80 = '80'
      expect(withAlpha('#000000', 0.5)).toBe('#00000080');
      // 0.80 ≈ 204/255 → 0xCC = 'CC'
      expect(withAlpha('#1A1A1A', 0.8)).toBe('#1A1A1ACC');
    });

    it('clamps out-of-range opacity values', () => {
      expect(withAlpha('#000000', -0.5)).toBe('#00000000');
      expect(withAlpha('#000000', 2.0)).toBe('#000000FF');
    });

    it('preserves original hex casing', () => {
      // The base hex is preserved as-is; only the alpha suffix is uppercase
      expect(withAlpha('#abcdef', 0.5)).toBe('#abcdef80');
    });
  });

  describe('lighten', () => {
    it('returns white at amount=1', () => {
      expect(lighten('#000000', 1)).toBe('#FFFFFF');
    });

    it('returns original at amount=0', () => {
      expect(lighten('#FF0000', 0)).toBe('#FF0000');
    });
  });

  describe('darken', () => {
    it('returns black at amount=1', () => {
      expect(darken('#FFFFFF', 1)).toBe('#000000');
    });

    it('returns original at amount=0', () => {
      expect(darken('#FF0000', 0)).toBe('#FF0000');
    });
  });
});
