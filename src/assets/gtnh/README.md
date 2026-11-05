# GTNH 图标资源

从用户本地 GTNH 2.9.0 实例只读提取，运行应用无需安装 Minecraft。
`sources.json` 记录每个图标的原始 jar、贴图路径和材质染色。只读取 Minecraft 与模组自带资源，**不读取 options.txt 或 resourcepacks，不应用额外材质包覆盖**。

界面的物品、机器、导航及整合包标志均使用 SVG。原图是像素素材，导入时将同色像素段逐行转成矢量路径，保留像素轮廓及透明度；SVG 内没有 image、base64 或外链位图。放大后保持像素风，不凭空添加原图不存在的细节。199 个图标条目中 spacetime／spaceTime 共用同一个材质；Windows 不区分大小写，因此实际有 198 个 SVG 文件。程序窗口及 EXE 图标使用 Windows 要求的 ICO 格式。

- 材料：读取已安装 GregTech 的材质集合和 RGB 颜色，叠加原始材质和覆盖层；矿石使用石质底层。
- 电路与元件：读取 GregTech 元物品枚举 ID，使用对应图标。
- 方块与机器：以原始顶面、侧面、正面贴图生成独立等距图标。
- 火箭：从已安装 Galacticraft 的模型方块、旋转、UV 和贴图生成图标。
- 放置玩法的自定义物品没有一一对应的原版实体：木桶使用 GTNH 桶图标及 GregTech 木材颜色；恒星核心使用 Quantum Star，聚变核心使用 Nuclear Star，时空和终极电路使用整合包对应高阶电路，星门采用其 Chevron 物品。改编机器采用对应或相近机器的 GTNH 控制器与外壳材质。

开发时重新提取（需要 Pillow、NumPy、Node 和 javap）：

```powershell
python scripts/import-icons.py --instance "D:/PrismLauncher/instances/GT_New_Horizons_2.9.0_Java_17-26" --vanilla "D:/PrismLauncher/libraries/com/mojang/minecraft/1.7.10/minecraft-1.7.10-client.jar"
```
