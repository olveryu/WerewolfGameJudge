/**
 * Contract test: Ensure production code does not contain console.*
 *
 * 这些文件不应该包含 console.log/warn/error，应使用结构化 logger
 */

describe('No console.* in production code', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('node:fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('node:path');

  const filesToCheck = [
    'src/navigation/AppNavigator.tsx',
    'src/theme/ThemeProvider.tsx',
    'src/screens/RoomScreen/useRoomHostDialogs.ts',
  ];

  it.each(filesToCheck)('should not contain console.* in %s', (filePath) => {
    const fullPath = path.join(process.cwd(), filePath);
    const content = fs.readFileSync(fullPath, 'utf-8');

    // Should NOT contain console.log, console.warn, console.error, etc.
    expect(content).not.toMatch(/console\.(log|warn|error|info|debug)\s*\(/);
  });
});

describe('No Math.random in speakOrder logic', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('node:fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('node:path');

  it('should not use Math.random in useRoomHostDialogs.ts', () => {
    const fullPath = path.join(process.cwd(), 'src/screens/RoomScreen/useRoomHostDialogs.ts');
    const content = fs.readFileSync(fullPath, 'utf-8');

    expect(content).not.toMatch(/Math\.random\s*\(\s*\)/);
  });
});
