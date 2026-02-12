````instructions
---
applyTo: "src/screens/**/*.tsx,src/components/**/*.tsx"
---

# React Native 平台级性能规范

> 补充 `screens.instructions.md` 中的 memo/styles 规范，聚焦 RN 平台特有的性能陷阱。

## 核心原则

- ✅ 超 ~10 项列表使用 `FlatList` / `SectionList`。
- ✅ `keyExtractor` 返回稳定唯一字符串（`item.id` / `String(item.seatNumber)`）。
- ✅ `renderItem` 用 `useCallback` 包裹或提取为独立组件。
- ✅ 预计算 style 数组或用 `StyleSheet.compose` 做条件样式。
- ✅ `InteractionManager.runAfterInteractions` 做导航后重计算。
- ✅ `<Image>` 指定 `resizeMode` + 明确 `width`/`height`。
- ✅ 动画优先 `react-native-reanimated` 或 `useNativeDriver: true`。
- ❌ 禁止 `<ScrollView>{items.map(...)}</ScrollView>` 渲染长列表。
- ❌ 禁止用 index 作 key（除非列表静态不可变且不会重排）。
- ❌ 禁止 `renderItem` 内联匿名函数（每次渲染创建新函数 → memo 失效）。
- ❌ 禁止循环/列表内创建内联 style 对象。
- ❌ 禁止在渲染路径做同步 I/O（`JSON.parse` 大对象放 `useEffect`）。
- ❌ 禁止在动画回调中频繁 `setState`。

## 列表渲染（Hard rule）

- 超过 ~10 项的列表**必须**使用 `FlatList`（或 `SectionList`）。
  - ❌ 禁止 `<ScrollView>{items.map(...)}</ScrollView>` 渲染长列表。
- `keyExtractor` 必须返回**稳定的唯一字符串**。
  - ❌ 禁止用 index 作 key（除非列表静态不可变且不会重排）。
  - ✅ `keyExtractor={(item) => item.id}` 或 `keyExtractor={(item) => String(item.seatNumber)}`。

## `renderItem` 禁止内联匿名函数（Hard rule）

- ❌ `renderItem={({ item }) => <SeatTile .../>}`（每次渲染创建新函数 → memo 失效）
- ✅ 提取为 `useCallback` 包裹的函数，或独立组件。

```typescript
// ✅ 正确
const renderSeat = useCallback(
  ({ item }: ListRenderItemInfo<Seat>) => <SeatTile seat={item} styles={styles} />,
  [styles],
);
<FlatList renderItem={renderSeat} ... />
````

## 禁止循环内创建内联 style 对象

- ❌ `style={{ backgroundColor: isActive ? colors.primary : colors.surface }}`（循环/列表内）
- ✅ 预计算 style 数组，或用 `StyleSheet.compose` / 条件索引已有 style。
- 例外：非循环场景的一次性内联 style 可接受（但优先用 styles factory）。

## 昂贵操作走 `InteractionManager`

- 导航切换/动画完成后才执行的重计算（如列表初始化、大数据解析），使用：

```typescript
InteractionManager.runAfterInteractions(() => {
  setProcessedData(expensiveCompute(raw));
});
```

## 图片规范

- `<Image>` 必须指定 `resizeMode`（`cover` / `contain` / `center`）。
- 必须指定明确的 `width` + `height`（或通过 style 约束），禁止让图片自适应未知尺寸。

## 避免 JS 线程阻塞

- 禁止在渲染路径（render / useMemo / useCallback body）中做同步 I/O。
- `JSON.parse` / `JSON.stringify` 大对象时，考虑放到 `useEffect` 或 `InteractionManager` 中。

## 动画

- 优先使用 `react-native-reanimated`（或 `Animated` + `useNativeDriver: true`）。
- ❌ 禁止在动画回调中频繁 `setState`（会导致 JS 线程抖动）。

```

```
