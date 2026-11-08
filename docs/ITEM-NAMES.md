# 物品名称与图标校准

截图中的 `TConstruct:materials` / metadata `2` 是焦黑砖。旧导入器使用注册名作为显示名，并猜测 `assets/tconstruct/textures/items/materials.png`；实际名称键是 `item.tconstruct.Materials.SearedBrick.name`，材质来自原版模组的 `assets/tinker/textures/items/materials/material_searedbrick.png`。一个注册名下的不同 metadata 不能使用同一个默认物品名。

`src/data/item-presentations.js` 按 `registry@meta` 保存已确认的显示映射。`item-presentation-catalog.js` 在目录装配时统一应用，使工作台、配方树、收藏、仓库与工厂使用相同名称；只更新由产物名称生成的配方标题，保留独立命名的路线和随机配方。没有更改物品 ID、注册身份、配方投入产出、耗能时间、工具、地区、研究或存档格式。

本轮确认 1,817 条注册身份的显示映射，实际修正 1,814 个物品名称与 3,737 个配方标题。涵盖匠魂材料、工具部件、木模／金属铸模／黏土铸模、AE2 材料和部件、OpenComputers 配件与设备、物流模块和升级，以及具有精确语言键的常见模组物品。优先使用模组原始中文；缺少中文时使用原始英文名称。AE2 线缆保留颜色、P2P 保留通道类型，电脑配件保留等级；通用匠魂部件图形按注册材料色着色。

## 原始资料与重建

`scripts/import-item-presentations.py` 只读本机 GTNH 2.9 实例、原版 Minecraft 语言资源及开发缓存中的固定版本源码。语言键必须精确匹配；metadata 家族取自源码的枚举 ID、数组、实际构造顺序或注册调用，不按首个匹配词猜测。原始语言文件及使用的源码 SHA-256 见 `src/data/item-presentation-provenance.json`。

源码缓存位于 `.local/gtnh-technology/`，不随应用分发：

- `TConstruct-1.14.123-source`：GTNewHorizons/TinkersConstruct，标签 `1.14.123-GTNH`。
- `Applied-Energistics-2-Unofficial-rv3-beta-1095-GTNH`：现有 AE2 源码缓存。
- `OpenComputers-1.12.68-GTNH-source`：GTNewHorizons/OpenComputers，标签 `1.12.68-GTNH`。
- `LogisticsPipes-1.5.39-GTNH-source`：GTNewHorizons/LogisticsPipes，标签 `1.5.39-GTNH`。

在工程根目录执行：

```powershell
python scripts/import-item-presentations.py
python scripts/import-industry-icons.py --presentations-only
```

第二条仅检查对应物品的图标，复用已导入的正确图标。确定的原版 PNG 通过现有路径描摹器生成 SVG，不嵌入位图，也不读取额外材质包。`src/assets/gtnh/sources.json` 记录每个生成图标的原始 jar、材质路径和导入签名。后续重导入科技配方和工业图标时同样读取显示映射，避免回退成内部注册名。

生成器重跑读取原始导入数据进行审计；不会因为运行时已经应用校准而丢失映射。

## 尚未校准的范围

这不是全模组名称或渲染器的完整移植。审计保留 2,513 个尚未确认映射的候选标签，包含 Forestry、Railcraft、Natura、GalaxySpace 等特殊子类型、损伤值／通配值物品和缺少明确注册资料的条目；候选标签不等同于全部已证实错误。原始注册身份和材料规则照常保留，未以别的物品名称代替。清单位于上述 provenance 文件的 `unresolved`。

名称已校准也不代表其全部模型图标已完成：部分方块和特殊模型需要单独解析。名称校准时，图标导入器将仍无法确认的对应图标列入 `.local/presentation-missing-icons.json`，当时为 887 项；不会用无关物品图标掩盖缺口。截图所涉焦黑砖、相关材料／铸模和已确认的普通元件材质已生成并校验。后续全目录图标审计扩展到运行时的全部物品及共用引用，当前范围与待补清单以 `ICONS.md`、`icon-gaps.json` 为准。

## 验证

`tests/item-presentations.test.js` 检查焦黑砖真实配方的名称、耗能／时间及 SVG，不同 metadata 的材料／形状／颜色／等级差异，已确认材质的矢量文件存在性，以及名称校准前后的规则不变性。

`node scripts/ui-item-presentations.mjs` 使用独立临时存档检查实际 Electron 中的工作台标题、原料／产物图标加载、收藏、配方树、仓库拼音搜索和工厂运行配方名称，不接触玩家存档。

本轮纳入 v0.1.20。发布流程执行 `node scripts/ui-item-presentations.mjs --packaged` 检查实际成品，全部发布门槛通过后创建本地提交与版本标签。测试结果见 `VALIDATION.md`。

## v0.1.21 图标解析完成

名称候选审计与图标覆盖分别统计。此前尚缺的模型、动态图标和子类型图片已通过原版隔离客户端及原始材质算法补齐；最终目录全部 20,742 个物品、19,749 个图标引用路径缺图为零。原版运行时注册／渲染证据见 `ICONS.md` 和 SVG 来源清单；未把名称候选数当作缺图数，也未改写配方规则。
