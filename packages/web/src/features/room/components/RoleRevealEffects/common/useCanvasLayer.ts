import { Container } from 'pixi.js';
import { useEffect, useState } from 'react';

import { clipToRect } from '../pixi/kit';
import { usePixiLayer } from '../pixiLayer';
import type { ViewRect } from './useAnchorRect';

/**
 * A Pixi stand-in for one old Skia `<Canvas>` covering `rect`: its children draw in the canvas'
 * own coordinates and are clipped to its bounds, as the Skia surface clipped them.
 */
export function useCanvasLayer(zIndex: number, rect: ViewRect): Container {
  const layer = usePixiLayer(zIndex);
  const [content] = useState(() => new Container());
  useEffect(() => {
    layer.addChild(content);
  }, [layer, content]);
  useEffect(() => {
    layer.position.set(rect.x, rect.y);
    clipToRect(layer, 0, 0, rect.width, rect.height);
  }, [layer, rect.x, rect.y, rect.width, rect.height]);
  return content;
}
