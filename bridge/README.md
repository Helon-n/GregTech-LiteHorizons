# 原版运行时配方导出

这个可选 Forge 1.7.10 mod 在 `FMLLoadCompleteEvent` 阶段读取 GregTech 注册表，导出 `RecipeMap.ALL_RECIPE_MAPS` 和装配线配方。它不会修改配方、物品、玩家或存档。

1. 运行 `powershell -File bridge/build.ps1`；或使用附带的 `gtnh-idle-export-0.1.0.jar`。
2. 将 jar 放入需要核对的实例 `.minecraft/mods`，正常启动 GTNH 并等到加载完成。
3. 导出文件在 `.minecraft/config/gtnh-idle-export/recipes.json`。
4. 在桌面 App 的「原版资料」页导入该文件。

导出器已编译，但本工程没有自动往游戏目录安装该 mod，也没有替用户启动 Minecraft，因此尚未取得真实的运行时配方导出文件。第一次使用请保留游戏日志并检查 JSON 的 `errors` 字段。

## 范围限制

导出字段包括物品 ID、meta、数量、NBT、矿辞、流体、耗时、EU/t、概率、特殊值、可用标记和装配线研究信息。数量为 0 的物品可能是配方工具，不能直接当作消耗品。

不包含原版工作台/熔炉和其他 mod 独立配方系统。任意特殊元数据、材料温度、线圈、洁净室、重力和多方块条件仍需独立建模。配方导入用于资料核对，不会自动把桌面游戏切换为「全量原版模拟」。
