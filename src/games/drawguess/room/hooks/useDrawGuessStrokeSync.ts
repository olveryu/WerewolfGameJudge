/**
 * 画手笔画同步：整笔 300ms 批量发送 `drawguess.stroke.add`，撤销/清屏走命令并乐观更新。
 *
 * 笔画命令幂等（客户端 stroke id），重放不重复入画；冲突时以权威快照为准。
 */

import type { DrawGuessStroke } from '@game-judge/game-engine/games/drawguess/public';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  DRAWING_WIDTHS,
  type DrawingColor,
  type DrawingElement,
  type DrawingPoint,
  type DrawingWidth,
  isDrawingColor,
} from '@/features/drawing/model/drawing';
import { isSuccessfulRoomCommand } from '@/features/room/session/roomCommandResult';
import type { DrawGuessRoomSession } from '@/games/drawguess/model/DrawGuessRoomSession';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

import { createDrawGuessFillElement } from '../../services/drawGuessMediaApi';

const STROKE_FLUSH_MS = 300;

function toDrawGuessWidth(value: number): DrawingWidth {
  if (value === DRAWING_WIDTHS[0] || value === DRAWING_WIDTHS[1] || value === DRAWING_WIDTHS[2])
    return value;
  throw new Error(`[FAIL-FAST] DrawGuess stroke width is invalid: ${value}`);
}

/** 权威笔画 → 本地渲染元素；损坏数据直接失败，不猜测修复。 */
export function drawGuessStrokeToElement(stroke: DrawGuessStroke): DrawingElement {
  if (!isDrawingColor(stroke.color)) {
    throw new Error('[FAIL-FAST] DrawGuess stroke color is invalid');
  }
  const width = toDrawGuessWidth(stroke.width);
  switch (stroke.kind) {
    case 'brush':
    case 'eraser':
      return {
        id: stroke.id,
        kind: stroke.kind,
        color: stroke.color,
        width,
        points: stroke.points.map((point) => ({ x: point.x, y: point.y })),
      };
    case 'line':
    case 'rectangle':
    case 'ellipse':
      return {
        id: stroke.id,
        kind: stroke.kind,
        color: stroke.color,
        width,
        start: { x: stroke.start.x, y: stroke.start.y },
        end: { x: stroke.end.x, y: stroke.end.y },
      };
    case 'fill':
      return {
        id: stroke.id,
        kind: stroke.kind,
        color: stroke.color,
        width,
        rectangles: stroke.rectangles.map((rectangle) => ({ ...rectangle })),
      };
  }
}

/** 本地元素 → 服务端笔画命令载荷。 */
function drawGuessElementToStroke(element: DrawingElement, authorSeat: number): DrawGuessStroke {
  switch (element.kind) {
    case 'brush':
    case 'eraser':
      return {
        id: element.id,
        kind: element.kind,
        color: element.color,
        width: element.width,
        points: element.points.map((point) => ({ x: point.x, y: point.y })),
        authorSeat,
      };
    case 'line':
    case 'rectangle':
    case 'ellipse':
      return {
        id: element.id,
        kind: element.kind,
        color: element.color,
        width: element.width,
        start: { x: element.start.x, y: element.start.y },
        end: { x: element.end.x, y: element.end.y },
        authorSeat,
      };
    case 'fill':
      return {
        id: element.id,
        kind: element.kind,
        color: element.color,
        width: element.width,
        rectangles: element.rectangles.map((rectangle) => ({ ...rectangle })),
        authorSeat,
      };
  }
}

export interface DrawGuessStrokeSync {
  /** 权威 + 本地待确认笔画的合并渲染列表。 */
  readonly elements: readonly DrawingElement[];
  /** 待发送的笔画数（断线/重试时大于 0）。 */
  readonly pendingCount: number;
  readonly onElementChange: (element: DrawingElement) => void;
  readonly onElementComplete: (element: DrawingElement) => void;
  readonly onFill: (point: DrawingPoint, color: DrawingColor, width: DrawingWidth) => void;
  readonly undo: () => void;
  readonly redo: () => void;
  readonly canRedo: boolean;
  readonly clear: () => void;
}

interface UseDrawGuessStrokeSyncInput {
  readonly session: DrawGuessRoomSession;
  /** 当前轮权威笔画（drawing 或 roundEnd 阶段）。 */
  readonly authoritativeStrokes: readonly DrawGuessStroke[];
  readonly phaseRevision: number;
  readonly turnIndex: number;
  /** 画手的有效席位（仅用于文档说明）；非画手只读，由 canDraw 控制。 */
  readonly effectiveSeat: number | null;
  readonly controlledSeat: number | null;
  readonly canDraw: boolean;
}

/**
 * 整笔粒度同步：完成一笔即入本地待发送队列，300ms 批量发出。
 * 撤销/清屏先排空待发送队列再发命令，保证服务端顺序与本地一致。
 */
export function useDrawGuessStrokeSync({
  session,
  authoritativeStrokes,
  phaseRevision,
  turnIndex,
  effectiveSeat,
  controlledSeat,
  canDraw,
}: UseDrawGuessStrokeSyncInput): DrawGuessStrokeSync {
  const pendingRef = useRef(
    new Map<string, { readonly element: DrawingElement; readonly stroke: DrawGuessStroke }>(),
  );
  const flushingRef = useRef(false);
  const latestRef = useRef({ phaseRevision, turnIndex, controlledSeat, canDraw });
  latestRef.current = { phaseRevision, turnIndex, controlledSeat, canDraw };
  const [pendingElements, setPendingElements] = useState<readonly DrawingElement[]>([]);
  const [activeElement, setActiveElement] = useState<DrawingElement | null>(null);
  const [optimisticUndoneId, setOptimisticUndoneId] = useState<string | null>(null);
  const [optimisticallyCleared, setOptimisticallyCleared] = useState(false);
  const redoStackRef = useRef<DrawingElement[]>([]);
  const [canRedo, setCanRedo] = useState(false);

  const authoritativeIds = useMemo(
    () => new Set(authoritativeStrokes.map((stroke) => stroke.id)),
    [authoritativeStrokes],
  );

  // 已被权威快照确认的待发送笔画出队；乐观撤销/清屏在权威落地后复位。
  useEffect(() => {
    let changed = false;
    for (const id of pendingRef.current.keys()) {
      if (authoritativeIds.has(id)) {
        pendingRef.current.delete(id);
        changed = true;
      }
    }
    if (changed) setPendingElements([...pendingRef.current.values()].map((entry) => entry.element));
    if (optimisticUndoneId !== null && !authoritativeIds.has(optimisticUndoneId))
      setOptimisticUndoneId(null);
    if (optimisticallyCleared && authoritativeStrokes.length === 0) setOptimisticallyCleared(false);
  }, [authoritativeIds, authoritativeStrokes.length, optimisticUndoneId, optimisticallyCleared]);

  const flushPending = useCallback(async (): Promise<void> => {
    if (flushingRef.current || pendingRef.current.size === 0) return;
    flushingRef.current = true;
    try {
      const latest = latestRef.current;
      for (const [id, entry] of [...pendingRef.current.entries()]) {
        try {
          const result = await session.dispatch(
            {
              type: 'drawguess.stroke.add',
              stroke: entry.stroke,
              phaseRevision: latest.phaseRevision,
              turnIndex: latest.turnIndex,
            },
            { controlledSeat: latest.controlledSeat, label: '同步笔画' },
          );
          // 成功或被服务端拒绝都出队：拒绝（如笔画上限、过期）以权威快照为准，不重试。
          pendingRef.current.delete(id);
          if (!isSuccessfulRoomCommand(result))
            roomScreenLog.warn('stroke rejected by server', { strokeId: id });
        } catch {
          // 网络/传输失败保留在队列里，下一个 300ms 周期重试；属预期内的瞬时失败，只记 warn。
          roomScreenLog.warn('stroke dispatch failed, will retry', { strokeId: id });
          break;
        }
      }
    } finally {
      flushingRef.current = false;
      setPendingElements([...pendingRef.current.values()].map((entry) => entry.element));
    }
  }, [session]);

  useEffect(() => {
    const timer = setInterval(() => {
      void flushPending();
    }, STROKE_FLUSH_MS);
    return () => clearInterval(timer);
  }, [flushPending]);

  const enqueueStroke = useCallback(
    (element: DrawingElement): void => {
      if (effectiveSeat === null) {
        throw new Error('[FAIL-FAST] DrawGuess stroke requires an effective seat');
      }
      const stroke = drawGuessElementToStroke(element, effectiveSeat);
      pendingRef.current.set(element.id, { element, stroke });
      setPendingElements([...pendingRef.current.values()].map((entry) => entry.element));
    },
    [effectiveSeat],
  );

  const onElementChange = useCallback((element: DrawingElement) => {
    setActiveElement(element);
  }, []);

  const onElementComplete = useCallback(
    (element: DrawingElement): void => {
      setActiveElement(null);
      if (!latestRef.current.canDraw) return;
      // 新笔画使重做栈失效（与 Pictionary 本地 draft 语义一致）
      if (redoStackRef.current.length > 0) {
        redoStackRef.current = [];
        setCanRedo(false);
      }
      enqueueStroke(element);
    },
    [enqueueStroke],
  );

  const onFill = useCallback(
    (point: DrawingPoint, color: DrawingColor, width: DrawingWidth): void => {
      if (!latestRef.current.canDraw) return;
      const currentElements = [
        ...authoritativeStrokes.map(drawGuessStrokeToElement),
        ...[...pendingRef.current.values()].map((entry) => entry.element),
      ];
      const fillElement = createDrawGuessFillElement(currentElements, point, color, width);
      if (fillElement !== null) {
        // 新填充使重做栈失效
        if (redoStackRef.current.length > 0) {
          redoStackRef.current = [];
          setCanRedo(false);
        }
        enqueueStroke(fillElement);
      }
    },
    [authoritativeStrokes, enqueueStroke],
  );

  const undo = useCallback(() => {
    if (!latestRef.current.canDraw) return;
    void (async () => {
      // 先算出要撤销的是哪一笔（必须在 flush 清掉 pending 之前，
      // 否则 authoritativeStrokes 还没收到服务端广播，会算出空数组导致第一下没反应）
      const displayedBeforeFlush = [
        ...authoritativeStrokes.map(drawGuessStrokeToElement),
        ...[...pendingRef.current.values()].map((entry) => entry.element),
      ];
      const last = displayedBeforeFlush.at(-1);
      if (last === undefined) return;
      await flushPending();
      const latest = latestRef.current;
      // 先乐观更新 UI，再发服务端（修"慢一拍"）；同时入重做栈
      setOptimisticUndoneId(last.id);
      redoStackRef.current.push(last);
      setCanRedo(true);
      try {
        await session.dispatch(
          {
            type: 'drawguess.stroke.undo',
            phaseRevision: latest.phaseRevision,
            turnIndex: latest.turnIndex,
          },
          { controlledSeat: latest.controlledSeat, label: '撤销笔画' },
        );
      } catch (error: unknown) {
        // 失败回滚：恢复显示，弹出重做栈
        setOptimisticUndoneId(null);
        redoStackRef.current.pop();
        setCanRedo(redoStackRef.current.length > 0);
        handleError(error, {
          label: '撤销笔画',
          logger: roomScreenLog,
          alertMessage: '撤销失败，请重试',
        });
      }
    })();
  }, [authoritativeStrokes, flushPending, session]);

  const redo = useCallback(() => {
    if (!latestRef.current.canDraw) return;
    const element = redoStackRef.current.pop();
    if (element === undefined) return;
    setCanRedo(redoStackRef.current.length > 0);
    // 重做 = 把撤销的笔画重新发一遍（新 stroke.add，复用原 ID；服务端幂等，已删的不算重复）
    enqueueStroke(element);
  }, [enqueueStroke]);

  const clear = useCallback(() => {
    if (!latestRef.current.canDraw) return;
    void (async () => {
      await flushPending();
      const latest = latestRef.current;
      try {
        await session.dispatch(
          {
            type: 'drawguess.stroke.clear',
            phaseRevision: latest.phaseRevision,
            turnIndex: latest.turnIndex,
          },
          { controlledSeat: latest.controlledSeat, label: '清空画布' },
        );
        setOptimisticallyCleared(true);
      } catch (error: unknown) {
        handleError(error, {
          label: '清空画布',
          logger: roomScreenLog,
          alertMessage: '清空失败，请重试',
        });
      }
    })();
  }, [flushPending, session]);

  const elements = useMemo(() => {
    const confirmed = authoritativeStrokes
      .map(drawGuessStrokeToElement)
      .filter((element) => element.id !== optimisticUndoneId);
    const base = optimisticallyCleared ? [] : confirmed;
    const merged =
      activeElement === null
        ? [...base, ...pendingElements]
        : [
            ...base.filter((element) => element.id !== activeElement.id),
            ...pendingElements,
            activeElement,
          ];
    return merged;
  }, [
    authoritativeStrokes,
    optimisticUndoneId,
    optimisticallyCleared,
    activeElement,
    pendingElements,
  ]);

  return {
    elements,
    pendingCount: pendingElements.length,
    onElementChange,
    onElementComplete,
    onFill,
    undo,
    redo,
    canRedo,
    clear,
  };
}
