/**
 * 结算揭晓水位：把「这条结算在进房前就已存在」与「进房后新发生」分开。
 *
 * 结算数据住在服务端权威状态里、随每份快照全量投影，而房间屏重挂载时
 * 组件本地状态归零——只靠本地已看标记去重，进房前的旧结算会被再弹一遍。
 * 本 hook 的语义：第一份就绪快照里的键只作基线（视为已看），基线之后
 * 出现的新键才展示；dismiss 把当前键记为已看；键回到 null（结果被下一
 * 轮清零）时已看与强制记录一并失效。reveal() 是设计内的主动重看入口
 * （如湖仙「查验结果」按钮）：强制当前键可见，直到 dismiss。
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface RevealWatermark {
  /** 当前键是否应展示揭晓面板。 */
  readonly shouldReveal: boolean;
  /** 关闭面板：当前键记为已看。 */
  readonly dismiss: () => void;
  /** 主动重看：强制当前键可见，直到 dismiss。 */
  readonly reveal: () => void;
}

/**
 * @param currentKey 当前结算的身份键；无结算时为 null。键必须在同一局内
 *   单调唯一（调用方以对局代次 + 序号/结果值组键，防跨局碰撞）。
 * @param isReady 快照是否已就绪；就绪前的渲染不作基线。
 */
export function useRevealWatermark(currentKey: string | null, isReady: boolean): RevealWatermark {
  const baselineRef = useRef<string | null | undefined>(undefined);
  const [seenKey, setSeenKey] = useState<string | null>(null);
  const [forcedKey, setForcedKey] = useState<string | null>(null);

  // 基线只在第一份就绪快照到达时对齐一次。ref 写入不触发渲染，但基线键
  // 本来就不展示，后续新键到达时的渲染自然读到已对齐的基线。
  useEffect(() => {
    if (isReady && baselineRef.current === undefined) baselineRef.current = currentKey;
  }, [isReady, currentKey]);

  // 结果消失（新一轮提案清零 / 新局重置）时，已看与强制记录一并失效。
  useEffect(() => {
    if (currentKey === null) {
      setSeenKey(null);
      setForcedKey(null);
    }
  }, [currentKey]);

  const shouldReveal =
    currentKey !== null &&
    baselineRef.current !== undefined &&
    (forcedKey === currentKey || (currentKey !== baselineRef.current && currentKey !== seenKey));

  const dismiss = useCallback(() => {
    setSeenKey(currentKey);
    setForcedKey(null);
  }, [currentKey]);

  const reveal = useCallback(() => {
    if (currentKey !== null) setForcedKey(currentKey);
  }, [currentKey]);

  return { shouldReveal, dismiss, reveal };
}
