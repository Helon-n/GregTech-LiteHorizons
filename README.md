# 格雷的长路 · GTNH Idle

从零搭建的 Windows 离线放置工厂游戏，工程位置 **D:/GTNH_proj**。技术栈：Electron、原生 ES Modules、HTML/CSS；运行时不需要服务器或网络。

## 当前交付状态

**v0.1.1 是可以运行和打包的工艺改编版，不是已经完成的 GTNH 2.9.0 全内容精确复刻。**

- 16 个科技章节：石器、蒸汽、LV、MV、HV、EV、IV、LuV、ZPM、UV、UHV、UEV、UIV、UMV、UXV、MAX／星门。
- 190 个物品／流体、162 条简化配方、27 类机器。
- 连续点击推进手动采集，完成后显示掉落物品和数量；各资源点独立保留进度。
- 配方书选择物品，九宫格工作台预览并放入材料，再合成；手工队列支持取消退料。
- 可叠加自动采集器，按自动周期运行并参与离线结算。
- 每台机器独立选择配方、原料预扣、工时、电力消费、缺电暂停、蒸汽与发电。
- 仓库、阶段累计目标、月球／火星／小行星远征、工业日志。
- 自动保存、有效备份恢复、JSON 导入导出、重置前备份。
- 最多 12 小时离线结算，与在线共用模拟模块。
- 从指定本地实例导入 3,814 个任务、46 个章节和 2,875 条中文语言资料。
- 附带可编译的只读配方导出 Forge mod，供后续核对运行时配方。

完整原版配方校准、实体管线、多方块空间搭建、概率副产物、过压与超频、仓库容量、全部维度、魔法和农业支线尚未实现。详见 [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md)。

## 直接运行

构建完成后，运行安装版 `release/GTNH-Idle-0.1.1-Setup.exe`，或免安装目录中的 `release/win-unpacked/格雷的长路.exe`（必须保留整个目录）。

安装后不需要 Node.js。安装包未进行商业代码签名。

## 从源码开发

需要 Node.js 20.19+ 或 22+，建议使用当前构建环境 Node.js 24。

```powershell
cd D:/GTNH_proj
npm ci
npm start
```

也可以双击 `Start-Game.cmd`。浏览器开发预览：`npm run dev:web`，打开 `http://127.0.0.1:4173/`。

如果 `npm ci` 卡在 Electron 运行时下载，可运行 `powershell -File scripts/bootstrap.ps1`，它通过 PowerShell 下载并校验运行时；不会修改系统代理。当前电脑也可使用 `powershell -File scripts/build-windows.ps1` 复用已下载的 NSIS 资源。

```powershell
npm test                 # 模拟、科技可达性、能耗、离线一致性、存档恢复
npm run test:ui          # 浏览器导航与采集，先启动 dev:web
npm run test:desktop     # Electron 交互检查，独立临时存档
npm run pack             # 生成免安装目录
npm run dist             # 生成 Windows x64 NSIS 安装包
```

UI 检查默认使用本机 Chrome 路径；不同电脑可调整 `scripts/ui-smoke.mjs` 的 `executablePath`。

## 版本更新与 Git

工程使用本地 Git 保存源码，每次发布提交代码并创建 `v版本号` 标签。`release/` 只保留最新应用安装包、对应 blockmap 和当前免安装目录，旧代码通过 Git 历史保留。

更新版本号、锁文件和界面文档后，运行 `npm run release:windows`。此命令执行逻辑测试、Windows 打包、打包 EXE 交互检查，再清理旧安装包、更新 SHA-256，最后提交源码并创建标签。新包验证失败时保留旧安装包；已有标签禁止覆盖。浏览器界面有变化时，另运行 `npm run test:ui` 检查。

构建产物、依赖、缓存、测试截图和生成的导出器 jar 不进入 Git。当前未配置远端，不自动推送。

## 新世界入门

1. 在「资源采集」连续点击树木、矿石或采集按钮。林地、地表与河岸每轮 4 次点击，完成立即掉落并入库，无需等待 2 秒。
2. 在「制造与建造」配方书选择木棍或燧石镐，在九宫格查看原料，点「放入材料」再「合成」；建造机器也采用选择、放入、建造的操作。
3. 在「生产工厂」给砖炉选择木炭、红砖或金属冶炼配方。
4. 红砖与燧石镐完成第一章。继续开采铜、锡、铁，制作锻造锤与金属板。
5. 用铁板部署自动采集器；用焦炉、锅炉与机器扩展生产。
6. 蒸汽轮机发电后接入电力机器。注意准备锅炉的煤炭与水。

机器不会擅自选择配方，也不会自动切换产品。当前电网不模拟电缆和电压等级限制。

## 本地 GTNH 资料更新

下面的命令只读游戏目录，不读取玩家任务完成度或复制游戏存档：

```powershell
python scripts/import-instance.py --instance "D:/PrismLauncher/instances/GT_New_Horizons_2.9.0_Java_17-26" --output src/data/reference.json
```

任务库是路线参考，不是 NEI 配方数据库。运行时配方导出方式和限制见 [bridge/README.md](bridge/README.md)。导出器已编译，但尚未在实际游戏加载中验证。

## 工程结构

```text
src/
  main.cjs                 Electron 生命周期与窗口设置
  index.html               应用入口
  app.js                   视图、事件与局部刷新
  styles.css               基础布局
  components.css           组件、图标与适配样式
  interaction.css          工作台、点击采集与掉落反馈
  core/engine.js           独立可测试的模拟与存档校验
  core/workbench.js        放置版九宫格布局，原料数量与配方一致
  core/storage.js          主存档、备份与恢复
  data/catalog.js          简化工艺与阶段内容
  data/reference.json      本地版本、任务、章节及语言参考
scripts/                   导入、预览与 UI 检查
tests/                     独立模拟测试，不修改真实游戏进度
bridge/                    Forge 导出器源码与 jar
release/                   Windows 构建输出
docs/                      状态、架构与原版复刻待办
```

## 存档

Windows 下 Electron 把本地存档放在应用用户目录（通常是 `%APPDATA%/GTNH Idle/`）的 Local Storage 中，独立于 Minecraft。JSON 导入支持 schema 2；兼容 v0.1.0 的正式存档，保留物品、机器和队列，未完成的手动采集计时会转成点击进度。旧临时原型存档不自动迁移。建议升级前导出存档。

九宫格使用当前放置版配方，原料数量与模拟规则一致；尚未逐项校准为 GTNH 原版工作台排布。「放入材料」用于确认本次配方，实际扣料发生在点击合成／建造时。

代码与图标为本工程实现，没有复制 Bilibili 网页代码，也没有提取并分发游戏贴图或音频。任务与语言参考来自用户指定的本地实例；公开分发前需要处理相关数据的许可和归属。
