/**
 * CapsuleMachine — Canvas 2D 扭蛋机组件（DOM Component）
 *
 * 物理+渲染全部在 CapsuleMachineCanvas（DOM 组件）内完成。
 * 本组件保持 forwardRef/useImperativeHandle 接口兼容。
 */
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { REF_H, REF_W } from '../gachaConstants';
import CapsuleMachineCanvas from './CapsuleMachineCanvas';

// ─── Types ──────────────────────────────────────────────────────────────

export interface CapsuleMachineRef {
  startAnimation: (drawType: 'normal' | 'golden', count: number) => void;
  setResults: (rarities: string[]) => void;
  cancelAnimation: () => void;
}

interface CapsuleMachineProps {
  width: number;
  height: number;
  drawType: 'normal' | 'golden';
  onPhaseChange?: (phase: number) => void;
}

// ─── Component ──────────────────────────────────────────────────────────

export const CapsuleMachine = forwardRef<CapsuleMachineRef, CapsuleMachineProps>(
  function CapsuleMachine({ width, height, drawType, onPhaseChange }, ref) {
    const scale = Math.min(width / REF_W, height / REF_H);
    const canvasW = REF_W * scale;
    const canvasH = REF_H * scale;

    const [startTrigger, setStartTrigger] = useState(0);
    const [drawCount, setDrawCount] = useState(1);
    const [results, setResults] = useState<string | null>(null);
    const [cancelTrigger, setCancelTrigger] = useState(0);
    const drawTypeRef = useRef(drawType);
    drawTypeRef.current = drawType;

    useImperativeHandle(
      ref,
      () => ({
        startAnimation: (_drawType: 'normal' | 'golden', count: number) => {
          setResults(null);
          setDrawCount(count);
          setStartTrigger((n) => n + 1);
        },
        setResults: (rarities: string[]) => {
          setResults(JSON.stringify(rarities));
        },
        cancelAnimation: () => {
          setCancelTrigger((n) => n + 1);
        },
      }),
      [],
    );

    const handlePhaseChange = useCallback(
      (phase: number) => {
        onPhaseChange?.(phase);
      },
      [onPhaseChange],
    );

    return (
      <View style={[styles.container, { width: canvasW, height: canvasH }]}>
        <CapsuleMachineCanvas
          dom={{ matchContents: true }}
          width={width}
          height={height}
          drawType={drawType}
          startTrigger={startTrigger}
          drawCount={drawCount}
          results={results}
          cancelTrigger={cancelTrigger}
          onPhaseChange={handlePhaseChange}
        />
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});
