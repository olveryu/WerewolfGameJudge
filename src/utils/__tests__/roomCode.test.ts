/**
 * Tests for room code generation
 */

import { generateRoomCode } from '@/utils/roomCode';

describe('generateRoomCode', () => {
  it('should generate a 4-digit string', () => {
    const code = generateRoomCode();

    expect(code).toMatch(/^\d{4}$/);
  });

  it('should generate codes in range 1000-9999', () => {
    // Generate multiple codes to verify range
    for (let i = 0; i < 100; i++) {
      const code = generateRoomCode();
      const num = Number.parseInt(code, 10);

      expect(num).toBeGreaterThanOrEqual(1000);
      expect(num).toBeLessThanOrEqual(9999);
    }
  });

  it('should generate different codes on multiple calls', () => {
    const codes = new Set<string>();

    // Generate 50 codes
    for (let i = 0; i < 50; i++) {
      codes.add(generateRoomCode());
    }

    // Should have some variety (at least 10 unique codes out of 50)
    expect(codes.size).toBeGreaterThan(10);
  });

  it('should always return a string (not a number)', () => {
    const code = generateRoomCode();

    expect(typeof code).toBe('string');
    // Verify it doesn't lose leading zeros (though our range starts at 1000)
    expect(code.length).toBe(4);
  });
});

describe('ConfigScreen Math.random contract', () => {
  it('should not use Math.random in ConfigScreen.tsx', () => {
    // This is a static analysis contract test
    // Use __dirname which is resolved at runtime by Jest
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('node:path');

    // Navigate from src/utils/__tests__ to src/screens/ConfigScreen
    const configScreenPath = path.join(process.cwd(), 'src/screens/ConfigScreen/ConfigScreen.tsx');

    const content = fs.readFileSync(configScreenPath, 'utf-8');

    // Should NOT contain Math.random() for room number generation
    expect(content).not.toMatch(/Math\.random\s*\(\s*\)/);
  });
});
