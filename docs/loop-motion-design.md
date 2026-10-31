# 常驻装饰动画：loopMotion 设计

> 适用范围：`src/components/loopMotion/`、`src/components/seatFlairs/`、`src/components/seatPets/`、`src/components/avatarFrames/` 中的循环动画，以及 `IndeterminateProgressBar` 这类常驻指示器。一次性播放的翻牌特效（`RoleRevealEffects`）不在此范围，它们继续使用 shared value，但必须在卸载时 `cancelAnimation`。

## 1. 问题

座位装饰（flair / pet / frame）在房间页每个座位常驻一份，原实现是：

```
useLoopProgress(ms)  →  withRepeat(withTiming(1), -1)  →  useAnimatedProps  →  SVG cx/cy/r/d/opacity
```

Reanimated 在 web 上没有 UI 线程：每个循环都是主线程 `requestAnimationFrame` + `setAttribute`，SVG 属性变化每帧触发重绘。12 个座位 × 多元素 × 60fps 让房间空闲时主线程也满载，表现为发热与耗电。

## 2. 原则

浏览器厂商十年未变的三条规则，也是 2026 年 web 动画的通行做法：

1. **JS 不参与每一帧。** 声明式交给引擎：web 走真 `@keyframes`（合成器线程），native 走 Reanimated core。
2. **只动 `transform` 和 `opacity`。** 不触发 layout / paint。
3. **形状静态化。** SVG 只画一次；运动由包裹它的节点承担。

Reanimated ≥ 4 的 **CSS Animations API**（`animationName` / `animationDuration` / `animationIterationCount` / `animationDelay`）正是为此设计：web 端 `css/web/domUtils.js` 会把 keyframes 编译为 `@keyframes` 规则插入样式表；native 端在 Reanimated core 中运行。两端同一份代码。

## 3. 核心：采样 → 共享 keyframes 规则

[`loopKeyframes.ts`](../src/components/loopMotion/loopKeyframes.ts)

- **Sampler**：每个装饰元素把原来的逐帧数学原样保留为纯函数 `(t, size) => geometry`，`t ∈ [0, 1)` 为循环进度。Sampler 必须是**模块级常量**——它是缓存键。
- **采样**：按固定 1/15 s 间隔采样（`LOOP_SAMPLE_INTERVAL_MS`），`n = max(24, ceil(duration / 66.7))`，共 `n + 1` 帧，最后一帧是 `t = 1`。更密的采样对这类正弦微动没有可见收益，却会线性增加 Blink / cc 在迭代边界评估曲线的主线程时间。`100%` 关键帧用 `sample(1)` 而不是复用第 0 帧：CSS 迭代边界是瞬时重启，若回插到第 0 帧，平移波、不闭合旋转会每圈出现一次 33 ms 倒带。
- **规则共享**：`createLoopRuleCache(derive)` 以 `(sampler, size, durationMs)` 为键缓存 `css.keyframes()` 结果。同一 flair 在 12 个座位上只产生一套规则；10 种颜色变体也共享（颜色不在 keyframes 里）。
- **相位**：元素错相用负 `animationDelay = -phase × duration`，而不是把 `phase` 烘进 sampler；这样共享同一规则。若原代码把 phase 用于非时间项（如角度偏移），该项保留在 sampler 内。

## 4. 原语

| 原语           | 用途                                       | 映射方式                                                                                        |
| -------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `LoopDot`      | 实心圆 `cx/cy/r/opacity`                   | View + `borderRadius`；`translate` 定位、`scale = r / rMax`                                     |
| `LoopLine`     | 圆头线段 `x1/y1/x2/y2/strokeWidth/opacity` | 水平条：长度→`scaleX`，粗细→`scaleY`，角度→`rotate`                                             |
| `LoopRing`     | 描边圆 `r/strokeWidth/opacity`             | 带 `borderWidth` 的 View；`strokeWidth` 变化用细 / 粗两层交叉淡入                               |
| `LoopPath`     | 静态 `d`，只有 `opacity/strokeWidth` 变化  | 静态 SVG；粗细变化同上两层                                                                      |
| `LoopLayer`    | 任意静态内容的刚体运动                     | 盒子中心 `(x, y)` + `rotate/scale/opacity`；用于旋转组、平移周期波、整组同步淡入                |
| `LoopMorph`    | `d` 真实形变                               | K 个静态变体，三角窗交叉淡入（`crossfade`）或方波（`step`）；`cyclesPerLoop` 支持短于循环的周期 |
| `LoopDashFlow` | `strokeDashoffset` 滑动                    | 虚线以 `dash + gap` 为周期，渲染 N 个偏移副本由 `LoopMorph` 循环 `round(travel / period)` 次    |

帧组件辅助：[`PerimeterSweep`](../src/components/avatarFrames/PerimeterSweep.tsx) 用圆角矩形弧长解析参数化，把"沿边框跑一圈的高光"拆成若干 `LoopLine` 弦段；[`frameViewBox.ts`](../src/components/avatarFrames/frameViewBox.ts) 统一 `-8 -8 116 116` 坐标契约。[`PetFloat`](../src/components/seatPets/PetFloat.tsx) 是宠物的上下浮动包裹层。

## 5. 不能直译时的取舍

- **描边粗细随 `scale` 变化**（JadeMist / ThornVine / PetalDance / SolarFlare）：用 `scale` 表达半径或生长时，描边会一起缩放。装饰级效果可接受；若不可接受改用 `LoopRing` / `LoopPath` 的两层交叉淡入。
- **组透明度 vs 逐元素透明度**：多个元素合并进一个 `LoopLayer` 后，重叠处先合成再淡出，比逐元素淡出略淡。
- **路径形变**只在 DarkSmoke / SilverStream / Aurora / 宠物触手等少数处使用 `LoopMorph`，变体数 6–8。
- 原实现在循环边界的硬跳变（`speed ≠ 1` 等）在新实现里是 CSS 迭代重启，表现一致。

## 6. 约束与检查

- 新增装饰必须使用 loopMotion 原语；`useAnimatedProps` / `withRepeat(..., -1)` 不得用于常驻装饰。
- Sampler 放模块级，不得在组件体内创建或用 `useMemo` 包装。
- `renderVariant` / `renderDashes` 依赖 props（颜色）时用 `useCallback` 稳定引用。
- 一次性特效中的无限循环必须在 effect cleanup 中 `cancelAnimation`（PR 中已为 `RoleRevealEffects` 42 处补齐）。
- 用户开关：设置 › 显示 › 座位装饰（`SettingsService.seatDecorationsEnabled`），与系统 reduced-motion 一起通过 [`useSeatDecorationsPreference`](../src/features/product/hooks/useSeatDecorationsPreference.ts) 汇入 `RoomSeatBoard` 的 `seatDecorationsEnabled`。

## 7. 实测（headless Chromium，装饰 › 普通 页，312 个动画节点 ≈ 6 个满员房间）

| 主线程 self time / 5 s                     | 迁移前 (`origin/main`) | 迁移后              |
| ------------------------------------------ | ---------------------- | ------------------- |
| JS (`FunctionCall`)                        | 1338 ms                | 11 ms               |
| Paint + PrePaint + Layout                  | 434 ms                 | 28 ms               |
| Raster（工作线程）                         | 2244 ms                | 0                   |
| Blink/cc 动画 tick + 迭代边界 style recalc | 133 ms                 | ≈620 ms             |
| **合计**                                   | **≈2450 ms（49 %）**   | **≈800 ms（16 %）** |
| 应用层 `requestAnimationFrame` 调用 / 5 s  | 21 209                 | 0                   |

剩余成本是 Blink 在每个动画迭代边界做的主线程记账（`AnimationTimeline::serviceAnimations` + `Document::recalcStyle`）以及 cc 对 keyframe 曲线的求值，与**边界次数**和 **keyframe 数**成正比、与帧率无关；一个 12 座房间的边界次数约为该页面的 1/6。复现脚本见 PR 描述。

## 8. 验证方式

Chrome DevTools：

- Elements → `<style>`：`REA-CSS-*` `@keyframes` 规则数应远小于动画节点数（规则按 sampler 共享）。
- Performance 录房间空闲 10 s：Scripting 应接近 0，Rendering / Painting 不应随座位数增长。
- Rendering → Paint flashing：座位区无持续闪烁。
- 控制台 `document.getAnimations().length` 等于可见装饰元素数；`requestAnimationFrame` 在空闲房间内不应被装饰调用。
