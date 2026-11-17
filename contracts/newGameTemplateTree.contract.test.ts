/** Contract test: the new-game generator keeps a single capability-gated template tree. */
import { readdirSync } from 'fs';
import { join } from 'path';

const TEMPLATES_DIR = join(import.meta.dirname, '../scripts/lib/new-game/templates');

describe('new-game generator template tree', () => {
  it('keeps exactly one game template tree next to the shared tree', () => {
    expect(readdirSync(TEMPLATES_DIR).sort()).toEqual(['game', 'shared']);
  });
});
