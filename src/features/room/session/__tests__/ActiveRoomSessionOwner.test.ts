/** Room ownership is exclusive across game types and safe against stale cleanup. */
import { ActiveRoomSessionOwner } from '../ActiveRoomSessionOwner';

describe('ActiveRoomSessionOwner', () => {
  it('rejects concurrent acquisition before resources can be created', () => {
    const owner = new ActiveRoomSessionOwner();
    owner.acquire();
    expect(() => owner.acquire()).toThrow('Disconnect the active room');
  });

  it('allows another room after release without letting old cleanup release it', () => {
    const owner = new ActiveRoomSessionOwner();
    const release = owner.acquire();
    release();
    const releaseNext = owner.acquire();
    release();
    expect(() => owner.acquire()).toThrow('Disconnect the active room');
    releaseNext();
    expect(() => owner.acquire()).not.toThrow();
  });
});
