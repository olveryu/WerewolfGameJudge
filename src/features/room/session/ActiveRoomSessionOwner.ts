/** Grants one synchronous room lease before any connection resources are allocated. */
export class ActiveRoomSessionOwner {
  #release: (() => void) | null = null;

  /** Acquire exclusive room ownership; the returned release only affects this lease. */
  acquire(): () => void {
    if (this.#release !== null) {
      throw new Error('[FAIL-FAST] Disconnect the active room before entering another room');
    }
    const release = () => {
      if (this.#release === release) this.#release = null;
    };
    this.#release = release;
    return release;
  }
}
