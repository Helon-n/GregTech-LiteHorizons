# 原版运行时配方导出

这个可选 Forge 1.7.10 mod 在 `FMLLoadCompleteEvent` 阶段只读配方注册表。schema 2 导出 `RecipeMap.ALL_RECIPE_MAPS`、装配线、原版 CraftingManager 及 FurnaceRecipes。它不会修改配方、物品、玩家或存档。

1. 运行 `powershell -File bridge/build.ps1`；或使用附带的 `gtnh-idle-export-0.1.0.jar`。
2. 将 jar 放入需要核对的实例 `.minecraft/mods`，正常启动 GTNH 并等到加载完成。
3. 导出文件在 `.minecraft/config/gtnh-idle-export/recipes.json`。
4. 保留 JSON 供工程核对实际注册表。当前 App 只提供世界存档导入，已没有「原版资料」页；不要将配方快照导入世界存档入口。

导出器已编译，但本工程没有自动往游戏目录安装该 mod，也没有替用户启动 Minecraft，因此尚未取得真实的运行时配方导出文件。第一次使用请保留游戏日志并检查 JSON 的 `errors` 字段。

## 范围限制

导出字段包括物品 ID、meta、数量、NBT、矿辞、流体、耗时、EU/t、概率、特殊值、可用标记和装配线研究信息。数量为 0 的物品可能是配方工具，不能直接当作消耗品。

其他 mod 的独立配方系统仍可能不包含。未知自定义原料和 metadata 保留 Java 类型及描述；NBT、特殊值、线圈、洁净室、重力与多方块条件需要对应的显式实现。导出快照用于工程核对，不会自动将桌面游戏切换为全量原版模拟。
