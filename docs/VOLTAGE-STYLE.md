# 电压外观系统

视觉依据为 `资料/voltage-tier-styles.html`。应用不载入这份页面，不包含其中的演示机器、演示物品、Lucide 或外部字体。

`src/data/voltage-tiers.js` 保留 ULV 至 MAX 全部 15 级的数据，包括中英文名称、电压、材料、三组色值、背景、纹理、细节、标签和原文说明。`node scripts/import-voltage-styles.mjs` 可从参考重新生成该数据文件以及纹理、细节纹章样式。

| Token | 用途 | 数据来源 |
| --- | --- | --- |
| `--a` / `--a2` | 强调色、次色、进度、边缘光 | `palette.accent` |
| `--c1` / `--c2` / `--c3` | 机壳三层 | `palette.casing` |
| `--p1` / `--p2` | 面板两层 | `palette.panel` |
| `--bg` / `--lcd-bg` | 页面背景、读数视窗 | `background` / `lcdBackground` |
| `--ink` / `--dim` / `--inset` / `--line` | 原参考中性配色 | `tier-theme.js` 的深浅色分支 |
| `--text` / `--muted` / `--green` / `--panel` / `--raised` | 现有组件的语义别名 | 指向上述 token |
| `--readable-dim` | 小号次要文字 | MAX 对参考中性灰略作加深，保持 4.5:1 对比度 |
| `--tex` / `--shell-*` / `--rivets` / `--progress-fill` | 表面、结构、进度形态 | `data-tex` / `data-era` / `data-tier` |

`data-tier`、`data-era`、`data-tex`、`data-detail`、`data-light` 应用到主题作用域。所有组件颜色由 CSS 变量决定；流体自身的颜色仍来自真实物品数据，GTNH SVG 图标保持原资源颜色。

基础工业使用厚边框、四角铆钉、分段进度；精密高压改为细边和读数视窗；终极星体使用无缝边缘和辉光；超越极限使用渐变边。MAX 使用浅色背景及全谱纹理、进度和三棱镜纹章。

## 组件与边界

- `tier-theme.js`：电压映射、CSS token、主题应用、独立外观偏好的读取与保存。
- `tier-appearance.js`：四组阶梯、上下一级、预览容器、STYLE DNA、色板和键盘选择。预览内容由应用传入。
- `tier-system.css`：真实游戏组件的主题绑定、四阶段结构、响应式布局和减少动态效果。
- `tier-motifs.css`：从参考提取的全部纹理和 15 种细节纹章。
- `app.js`：在设置与顶栏接入外观选择，预览复用当前世界的电网、生产现场、机器状态与导航；全局主题覆盖实际工作台、工厂、仓库、资源、科技与弹窗。

默认外观随当前科技阶段变化。石器、蒸汽两个非电力章节共用 ULV；LV 至 MAX 按代码匹配。游戏仍是 16 个章节，配方、电压计算、进度和存档结构不变。外观预览不解锁科技、不生成物品；“使用此外观”只在独立键 `glh-voltage-appearance` 中保存界面偏好。

≤1120px 阶梯为 2×2，预览与 DNA 上下排列；≤760px 阶梯为单列；≤420px 每组阶梯为两列。控制器测量实际内容高度，放不下时切换为阶梯／预览／DNA 页签；小窗口还可逐组查看阶梯，以及分页查看 DNA 的工艺和配色。所有内容均有按钮访问，不通过隐藏滚动条截断。

阶梯支持 Tab、方向键、Home、End、Enter、空格，使用 `aria-pressed` 表示选择，并遵守 `prefers-reduced-motion`。字体使用本地字体，代码与电压回退到 Consolas。

## 必要检查

```powershell
node --test tests/voltage-tiers.test.js
# 另开终端运行 npm run dev:web
npm run test:ui:tiers
```

数据检查覆盖原参考逐字段一致性、科技映射、外观偏好与文字对比度。界面检查覆盖全部 15 级、真实存档预览、键盘、持久保存、自动模式、减少动态效果，以及 390×680 至 1920×1080 和高屏堆叠布局。
