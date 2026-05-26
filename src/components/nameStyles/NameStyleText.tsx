/**
 * NameStyleText — cross-platform name effect renderer
 *
 * Web: CSS background-clip: text + @keyframes animation (injected via <style> tag)
 * Native: solid color + static textShadow style (gradient / animation downgraded to solid color)
 *
 * Usage: <NameStyleText styleId="phoenixRebirth" style={baseStyle}>玩家名</NameStyleText>
 * If styleId is invalid or undefined, renders as a plain <Text>.
 */

import React, { useMemo } from 'react';
import { Platform, Text, type TextProps, type TextStyle } from 'react-native';

import { crossPlatformTextShadow } from '@/theme/tokens';

import { NAME_STYLE_CONFIGS, type NameStyleConfig, type TextShadowLayer } from './nameStyleConfigs';

interface NameStyleTextProps extends TextProps {
  /** Name style ID from rewardCatalog. Undefined/null/invalid = plain text. */
  styleId?: string | null;
}

/** Build a native TextStyle from textShadow layers (only first layer — RN limitation) */
function buildNativeTextShadow(layers: TextShadowLayer[]): TextStyle {
  if (layers.length === 0) return {};
  // RN only supports a single textShadow — pick the most prominent one (first layer)
  const l = layers[0]!;
  return crossPlatformTextShadow(l.color, l.offsetX, l.offsetY, l.blur);
}

/** Build web textShadow CSS string from multiple layers */
function buildWebTextShadow(layers: TextShadowLayer[]): string {
  return layers.map((l) => `${l.offsetX}px ${l.offsetY}px ${l.blur}px ${l.color}`).join(', ');
}

// ── CSS injection (web-only, singleton) ─────────────────────────────────────

let injectedKeyframes = false;

function ensureKeyframesInjected(): void {
  if (injectedKeyframes || Platform.OS !== 'web') return;
  injectedKeyframes = true;

  const rules: string[] = [];
  for (const config of Object.values(NAME_STYLE_CONFIGS)) {
    if (!config.animations) continue;
    for (const anim of config.animations) {
      rules.push(`@keyframes ${anim.name} { ${anim.keyframes} }`);
    }
  }

  if (rules.length === 0) return;

  const style = document.createElement('style');
  style.setAttribute('data-name-styles', '1');
  style.textContent = rules.join('\n');
  document.head.appendChild(style);
}

// ── Component ───────────────────────────────────────────────────────────────

function buildStyleForConfig(config: NameStyleConfig): TextStyle | Record<string, unknown> {
  if (Platform.OS === 'web') {
    return buildWebStyle(config);
  }
  return buildNativeStyle(config);
}

function buildNativeStyle(config: NameStyleConfig): TextStyle {
  const style: TextStyle = { color: config.color };
  if (config.textShadows && config.textShadows.length > 0) {
    Object.assign(style, buildNativeTextShadow(config.textShadows));
  }
  return style;
}

function buildWebStyle(config: NameStyleConfig): Record<string, unknown> {
  const style: Record<string, unknown> = {};

  if (config.gradient) {
    style.backgroundImage = `linear-gradient(90deg, ${config.gradient.stops})`;
    style.WebkitBackgroundClip = 'text';
    style.backgroundClip = 'text';
    style.WebkitTextFillColor = 'transparent';
    // Force inline display so background only covers the text's inline box,
    // preventing gradient leaking as a visible color block in WebViews (WeChat).
    style.display = 'inline';
    style.padding = 0;
    if (config.gradient.backgroundSize) {
      style.backgroundSize = config.gradient.backgroundSize;
    }
    if (config.gradient.dropShadow) {
      style.filter = config.gradient.dropShadow;
    }
  } else {
    style.color = config.color;
    if (config.textShadows && config.textShadows.length > 0) {
      style.textShadow = buildWebTextShadow(config.textShadows);
    }
  }

  if (config.animations && config.animations.length > 0) {
    ensureKeyframesInjected();
    style.animationName = config.animations.map((a) => a.name).join(', ');
    style.animationDuration = config.animations.map((a) => a.duration).join(', ');
    style.animationTimingFunction = config.animations.map((a) => a.timing).join(', ');
    style.animationIterationCount = config.animations.map(() => 'infinite').join(', ');
  }

  return style;
}

export const NameStyleText: React.FC<NameStyleTextProps> = React.memo(
  ({ styleId, style, children, ...rest }) => {
    const config = styleId ? NAME_STYLE_CONFIGS[styleId as keyof typeof NAME_STYLE_CONFIGS] : null;

    const nameStyle = useMemo(() => {
      if (!config) return null;
      return buildStyleForConfig(config);
    }, [config]);

    return (
      <Text style={nameStyle ? [style, nameStyle] : style} {...rest}>
        {children}
      </Text>
    );
  },
);

NameStyleText.displayName = 'NameStyleText';
