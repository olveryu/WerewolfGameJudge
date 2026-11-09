/**
 * NameStyleText — a player name rendered with its equipped name style (solid colour and glow,
 * gradient text via `background-clip: text`, CSS keyframe animations that stop under reduced
 * motion). An unknown or missing style id renders plain text.
 */
import './nameStyles.css';

import type { CSSProperties, ReactNode } from 'react';

import { NAME_STYLE_CONFIGS, type NameStyleConfig } from './nameStyleConfigs';

const NAME_STYLE_CONFIG_MAP: ReadonlyMap<string, NameStyleConfig> = new Map(
  Object.entries(NAME_STYLE_CONFIGS),
);

const styleCache = new Map<NameStyleConfig, CSSProperties>();

function buildStyle(config: NameStyleConfig): CSSProperties {
  const style: CSSProperties = { color: config.color };
  if (config.gradient) {
    style.backgroundImage = `linear-gradient(90deg, ${config.gradient.stops})`;
    style.backgroundSize = config.gradient.backgroundSize;
    style.filter = config.gradient.dropShadow;
  } else if (config.textShadows && config.textShadows.length > 0) {
    style.textShadow = config.textShadows
      .map((layer) => `${layer.offsetX}px ${layer.offsetY}px ${layer.blur}px ${layer.color}`)
      .join(', ');
  }
  if (config.animations && config.animations.length > 0) {
    style['--name-style-animation-name'] = config.animations.map((a) => a.name).join(', ');
    style['--name-style-animation-duration'] = config.animations.map((a) => a.duration).join(', ');
    style['--name-style-animation-timing'] = config.animations.map((a) => a.timing).join(', ');
  }
  config.filters?.forEach((filter, index) => {
    style[`--name-style-filter-${index}`] = filter;
  });
  return style;
}

/** Inline style of a config; built once per style. */
function styleFor(config: NameStyleConfig): CSSProperties {
  let style = styleCache.get(config);
  if (!style) {
    style = buildStyle(config);
    styleCache.set(config, style);
  }
  return style;
}

interface NameStyleTextProps {
  /** Equipped name style id; `undefined`, `null` or an unknown id renders plain text. */
  readonly styleId: string | null | undefined;
  readonly className?: string;
  readonly children: ReactNode;
}

export function NameStyleText({ styleId, className, children }: NameStyleTextProps) {
  const config = styleId ? NAME_STYLE_CONFIG_MAP.get(styleId) : undefined;
  if (!config) {
    return <span className={className}>{children}</span>;
  }
  return (
    <span
      className={className === undefined ? 'name-style' : `name-style ${className}`}
      data-gradient={config.gradient !== undefined}
      data-animated={config.animations !== undefined && config.animations.length > 0}
      style={styleFor(config)}
    >
      {children}
    </span>
  );
}
