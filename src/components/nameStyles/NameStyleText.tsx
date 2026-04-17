/**
 * NameStyleText — 跨平台名字特效渲染器
 *
 * Web: CSS background-clip: text + @keyframes 动画（通过 <style> 标签注入）
 * Native: 纯色 + textShadow 静态样式（渐变/动画降级到纯色）
 *
 * 用法: <NameStyleText styleId="phoenixRebirth" style={baseStyle}>玩家名</NameStyleText>
 * 如果 styleId 无效或 undefined，渲染为普通 <Text>。
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
  const l = layers[0];
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
    style.background = `linear-gradient(90deg, ${config.gradient.stops})`;
    style.WebkitBackgroundClip = 'text';
    style.backgroundClip = 'text';
    style.WebkitTextFillColor = 'transparent';
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
