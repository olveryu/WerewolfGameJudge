/**
 * WebGL context loss on the scene canvas. Browsers (iOS WebKit in particular, under GPU memory
 * pressure or after the page was backgrounded) may drop the canvas's context and later restore it
 * as `webglcontextrestored`. PixiJS (8.x `GlContextSystem`) already prevents the loss event's
 * default, which is what lets the browser restore it, and re-creates its GPU state on restore;
 * this watcher only observes both events so the stage can pause while the context is gone and
 * redraw once it is back.
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
  const lost = () => handlers.onLost();
  const restored = () => handlers.onRestored();
  canvas.addEventListener('webglcontextlost', lost);
  canvas.addEventListener('webglcontextrestored', restored);
  return () => {
    canvas.removeEventListener('webglcontextlost', lost);
    canvas.removeEventListener('webglcontextrestored', restored);
  };
}
