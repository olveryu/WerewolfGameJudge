/**
 * WebGL context loss on the scene canvas. Browsers (iOS WebKit in particular, under GPU memory
 * pressure or after the page was backgrounded) may drop the canvas's context; it comes back only
 * when the `webglcontextlost` event's default is prevented, and then arrives as
 * `webglcontextrestored`. PixiJS listens too and re-creates its GPU state on restore; the stage
 * uses this to pause while the context is gone and redraw once it is back.
 */

export interface WebglContextHandlers {
  readonly onLost: () => void;
  readonly onRestored: () => void;
}

/** Watches `canvas` for context loss and restoration until the returned dispose runs. */
export function watchWebglContext(
  canvas: HTMLCanvasElement,
  handlers: WebglContextHandlers,
): () => void {
  const lost = (event: Event) => {
    // Without this the browser never restores the context and the canvas stays blank.
    event.preventDefault();
    handlers.onLost();
  };
  const restored = () => handlers.onRestored();
  canvas.addEventListener('webglcontextlost', lost);
  canvas.addEventListener('webglcontextrestored', restored);
  return () => {
    canvas.removeEventListener('webglcontextlost', lost);
    canvas.removeEventListener('webglcontextrestored', restored);
  };
}
