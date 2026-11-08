# GregTech-LiteHorizons

以 GT New Horizons 2.9 为蓝本的单机放置工厂游戏。从采集木头、燧石开始，烧砖、炼钢、造机器，再逐步搭起矿物处理、化工、电路和能源产线。

Windows x64，下载后可直接玩，不需要安装 Minecraft，也不需要联网。

## 下载

[下载最新版](https://github.com/Helon-n/GregTech-LiteHorizons/releases/latest)

- **Portable.exe**：免安装，双击运行。
- **Setup.exe**：安装版，可选择安装目录并创建快捷方式。
- **SHA256SUMS.txt**：下载文件的 SHA-256 校验值。

## 怎么玩

在「资源采集」连续点击获取材料。矿脉有工具和地区要求；造出自动采集器后，可以安排多台一起工作。

「配方与工作台」可以查询合成和加工路线，点原料继续往上查。常用配方可以收藏，复杂物品可以展开配方树、查看缺料，再按制作计划安排手工合成和机器生产。搜索支持中文、英文、全拼和拼音首字母。

「生产工厂」按机型管理设备。同配方的机器可以合并查看，也可以单独暂停、停止和更换配方。设备与容器都能起别名、分组，并设置输入输出。

液体和气体需要桶或储罐，电力需要发电设备和装有电池的电池箱。机器可以直连产能设备，也可以从缓存取能；缺料、断能或输出容器满时会停下来。

游戏自动保存。关闭程序后停止生产，重新打开从保存的进度继续，不计算离线收益。

## 存档

免安装版和安装版共用 `%APPDATA%\GTNH Idle\` 下的存档，与 Minecraft 存档无关。可以在「存档与设置」导出、导入世界；更新前建议导出一份备份。

## 与 GTNH 的区别

这是放置玩法改编。机器建造、物流和部分研究、探索流程做了简化；实体管线、多方块空间搭建、完整魔法与农业支线尚未实现，配方和后期产线仍在校准。

## 从源码运行

需要 Windows、Node.js 20.19+ 或 22+。项目使用 Electron 和原生 JavaScript。

```powershell
git clone https://github.com/Helon-n/GregTech-LiteHorizons.git
cd GregTech-LiteHorizons
npm ci
npm start
```

检查与打包：

```powershell
npm test                    # 基础逻辑测试
npm run audit:icons         # 图标引用与 SVG 检查
npm run pack                # 生成可运行目录
npm run dist                # 生成 Portable 和 Setup
```

构建结果在 `release/`。素材重新提取需要本地 GTNH 实例及相应工具，普通运行和打包不需要。

## 文档

- [版本记录](docs/CHANGELOG.md)
- [能源](docs/ENERGY.md) · [材料加工](docs/MATERIALS.md) · [工业配方](docs/INDUSTRY.md)
- [科技产线](docs/TECHNOLOGY.md) · [配方树与制作计划](docs/PRODUCTION-PLAN.md)
- [界面布局](docs/LAYOUT.md) · [电压外观](docs/VOLTAGE-STYLE.md)
- [物品名称](docs/ITEM-NAMES.md) · [图标来源](docs/ICONS.md)
- [测试记录](docs/VALIDATION.md) · [配方导出工具](bridge/README.md)

## 素材来源

Minecraft、GTNH 及各模组的名称和素材归各自作者所有。图标取自原版模组资源，未使用额外材质包；来源记录在 [sources.json](src/assets/gtnh/sources.json)。第三方拼音库的许可见 [pinyin-pro/LICENSE](src/vendor/pinyin-pro/LICENSE)。

本项目与 GTNH 官方无隶属关系。
