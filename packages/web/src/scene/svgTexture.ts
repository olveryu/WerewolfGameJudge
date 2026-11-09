/**
 * Static SVG artwork → PixiJS texture.
 *
 * The previous client drew avatar frames as DOM SVG (react-native-svg on web), with linear and
 * radial gradients (including gradient strokes), group opacity, rotated groups and dash arrays.
 * PixiJS `Graphics.svg()` approximates a subset of that (no group compositing, no dashes), so the
 * browser's own SVG renderer rasterises the artwork instead: same renderer, same pixels. Each
 * texture is drawn at the seat's exact device-pixel size (crisp at every tile size, unlike a
 * pre-baked atlas scaled per viewport) and its texel grid matches the device-pixel grid. The
 * stage caches textures per `(art, size, resolution)` and destroys them with their last user.
 */
import { ImageSource, Texture } from 'pixi.js';

import type { SvgArtwork } from '@/scene/decoration';

/** Whole device pixels covering `artwork` at `resolution`. */
function pixelSize(artwork: SvgArtwork, resolution: number): { width: number; height: number } {
  return {
    width: Math.ceil(artwork.width * resolution),
    height: Math.ceil(artwork.height * resolution),
  };
}

/**
 * A standalone SVG document drawing `artwork` at `resolution`: the viewBox is widened with the
 * pixel size rounded up, so one user unit keeps its scale and the artwork its origin.
 */
export function svgDocument(artwork: SvgArtwork, resolution: number): string {
  const pixels = pixelSize(artwork, resolution);
  const [minX, minY, width, height] = artwork.viewBox;
  const viewWidth = (width * pixels.width) / (artwork.width * resolution);
  const viewHeight = (height * pixels.height) / (artwork.height * resolution);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pixels.width}" height="${pixels.height}" ` +
    `viewBox="${minX} ${minY} ${viewWidth} ${viewHeight}" preserveAspectRatio="none">` +
    `${artwork.body}</svg>`
  );
}

/**
 * Rasterises `artwork` into a texture whose source resolution is `resolution`, so a sprite shows
 * it at `artwork.width × artwork.height` CSS px (rounded up to whole device pixels).
 *
 * @throws when the browser cannot decode the document
 */
export async function rasterizeSvg(artwork: SvgArtwork, resolution: number): Promise<Texture> {
  const pixels = pixelSize(artwork, resolution);
  const image = new Image(pixels.width, pixels.height);
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgDocument(artwork, resolution))}`;
  await image.decode();
  // Through a canvas, as PixiJS's own SVG loader does, so the upload sees plain pixels.
  const canvas = document.createElement('canvas');
  canvas.width = pixels.width;
  canvas.height = pixels.height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D is unavailable for SVG rasterisation');
  }
  context.drawImage(image, 0, 0);
  return new Texture({
    source: new ImageSource({
      resource: canvas,
      resolution,
      alphaMode: 'premultiply-alpha-on-upload',
    }),
  });
}
