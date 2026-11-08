# GTNH 原版图标全目录解析（v0.1.21）

日期：2026-11-08。检查最终运行目录的全部 **20,742 个物品／设备、19,747 个图标引用路径**，严格审计 **0 缺失、0 非矢量、0 空文件**。问号不计为物品图标；当前 `icon-gaps.json` 和 `src/data/icon-gaps.js` 均无未解决条目。

## 完成范围

初查缺少 3,460 个物品引用、3,438 个独立文件。本次累计新增 **3,438 张 SVG，修复全部 3,460 个引用**：

- 静态注册／材质解析：876 张，涵盖 GT 原矿、钣金、染料、Forestry／Natura 木种、矿车模块、奇点及多层物品。
- 原版运行时解析：2,561 张，涵盖剩余模组的子类型、特殊模型、动态图像和机器；采用 `RenderItem.renderItemAndEffectIntoGUI` 与 Forge 专用渲染器。
- 三角定位器：1 张，按 WR-CBE `TriangTexManager.processTexture(-1, 0)` 的原始算法，选择 `triangGrad.png` 的非透明像素，否则选择 `triangRing.png`，保留默认白色／未连频状态。

回旋加速器、精密组装机、中子活化器、艾萨研磨机、轨道组装模块、造物主等离子模块和五级硅岩反应堆等设备，依据实际 `GregTechAPI.METATILEENTITIES` 注册表绑定控制器。共享图标的能力变种继续共享同一实际设备图片。

Railcraft 的旧符号轨道名称经 `EnumTrack.getItem()` 解析真实物品及其子类型数据，未按错误伤害值猜图。KekzTech 的钆铈／钇锆电解质单元通过原版静态字段找到实际方块。陨石箱子的 32767 通配值不适用于库存模型渲染，因此图片预览选用真实默认子类型 0；配方物品 ID、原始 metadata、数量和匹配条件保持不变。机器人补充菜单外原版渲染器所需的纹理管理上下文。

两处历史别名的图标引用已统一大小写：`spaceTime` 指向 `spacetime.svg`，`titaniumtetrachloride` 指向 `titaniumTetrachloride.svg`，均为相同原版材料／化学品。ASAR 严格区分路径大小写，审计器现在同时核对实际文件名；规范化后原始 19,749 个独立字符串引用收敛为 19,747 个有效图标路径。

## 原始素材与导出隔离

只读用户的 GTNH 2.9.0 原始 mod jar 与 Minecraft 1.7.10 客户端 jar。开发导出客户端位于工程 `.local/icon-client`，复制 mods／config／scripts，使用离线虚构身份，不读取启动器账户，不复制或打开玩家存档；资源包列表为空，不复制额外材质包。内存中的预览世界仅供模型读取亮度，不进入或保存游戏世界。渲染完成自动退出。

导出的透明图像裁切空白后描摹为 SVG path；**没有 `<image>`、data URI 或嵌入 PNG**。导出工具与 Minecraft 运行环境不随 EXE 发行；应用使用本地 SVG，无需运行 Minecraft。

`src/assets/gtnh/sources.json` 记录每张新图的注册名、metadata、实现类及原始 jar 的 SHA-256。机器额外记录控制器注册类；特殊轨道记录枚举；通配预览记录原始值和展示值。运行时渲染使用原版图集及专用模型，并未伪造逐张 PNG 路径；`runtimeAssets` 保存完整原始资源集的 jar 文件名和哈希。静态解析图片仍记录准确 PNG 路径、着色及分层证据。

## 重建与验证

```powershell
# 静态注册材质规则补缺
npm run import:icons:repair

# 为仍缺失的路径准备原版运行时请求；绑定表位于 scripts/data/runtime-icon-bindings.json
node scripts/prepare-icon-tasks.mjs
python scripts/export-runtime-icons.py --run
python scripts/import-runtime-icons.py
node scripts/audit-icons.mjs --write-gaps --strict

# 全目录引用及 XML／矢量检查
npm run audit:icons

# 实际成品全目录图片分批解码及页面切换；使用独立测试存档
node scripts/ui-icons.mjs --packaged
```

运行时导出默认针对本机既定 GTNH 2.9.0、Prism libraries 和 JDK 路径。批次结果合并保存在 `.local/icon-runtime-results.json`；透明空图、渲染错误和紫黑缺材质图会被拒绝，不生成“成功”记录。原版 Java 模型导出的中间 PNG 仅为开发缓存，发行素材均为 SVG 路径。

- `npm test`：**121/121 通过，0 失败、0 跳过**，包括匠魂炉新档实际建造、原版材质身份／颜色、全部真实图标覆盖、机器 metadata、不同线缆图像与通配条件不变。
- **19,944 个 SVG**：XML、可绘制矢量内容及无嵌入位图检查全部通过。
- 修正版成品实际解码 **19,824 条图片路径**（含整个目录及已修复的额外共用图），**0 解码失败、0 页面异常**；工作台、仓库、工厂、采集切页通过。每批最多 1,024 张使用独立临时渲染进程，覆盖范围不减少。
- 发布流程在构建后、提交与标签前运行全目录成品图片解码、工作台／仓库／工厂／采集切页，以及其余九项成品检查。实际完成记录为 `release-validation.json`，日志为 `.local/release-v0.1.21.log`。

本次完成的是当前应用目录的全部图标绑定，并非将 Minecraft 每一种 NBT 组合或动画逐帧移植到应用；动态图像使用原版可显示的库存预览状态。
