/**
 * Takeover banner wiring: the banner model comes from the shared factory
 * (createControlledSeatModel) and reports an active takeover only — there
 * is no hint state. This test pins that the Avalon shell factory feeds the
 * factory the controlled seat and its display name.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import { createControlledSeatModel } from '@/features/room/model/createControlledSeatModel';

/** The inputs the shell factory passes to the shared banner factory. */
function bannerModel(controlledSeat: number | null) {
  return createControlledSeatModel({
    controlledSeat,
    controlledBotName: controlledSeat !== null ? `机器人${controlledSeat + 1}号` : null,
    release: () => undefined,
    gameName: 'Avalon',
  });
}

describe('avalon takeover banner gate', () => {
  it('pins the factory wiring in the shell factory', () => {
    const adapter = readFileSync(join(__dirname, '../avalonRoomAdapter.ts'), 'utf8');
    expect(adapter).toMatch(
      /createControlledSeatModel\(\{\s*controlledSeat: input\.controlledSeat,/,
    );
  });

  it('renders no banner while no takeover is active', () => {
    expect(bannerModel(null)).toBeNull();
  });

  it('keeps the controlled banner while a takeover is active', () => {
    const model = bannerModel(3);
    expect(model).toMatchObject({ seat: 3, displayName: '机器人4号' });
    expect(typeof model?.onRelease).toBe('function');
  });
});
