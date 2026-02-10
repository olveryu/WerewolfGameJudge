import type { ChooseSeatSchema } from '@/models/roles/spec/schema.types';
import { deriveSkipIntentFromSchema } from '@/screens/RoomScreen/hooks/useRoomActions';

describe('deriveSkipIntentFromSchema (chooseSeat schemas)', () => {
  it('returns skip intent when currentSchema.kind=chooseSeat and canSkip=true', () => {
    const schema: ChooseSeatSchema = {
      kind: 'chooseSeat',
      canSkip: true,
      constraints: [],
      id: 'seerCheck',
      displayName: 'Seer',
    };

    const intent = deriveSkipIntentFromSchema(
      'seer',
      schema,
      () => '确定不发动技能吗？',
      false,
      null,
    );

    expect(intent).toEqual(
      expect.objectContaining({
        type: 'skip',
        targetIndex: -1,
      }),
    );
  });
});
