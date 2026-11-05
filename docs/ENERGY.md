# GTNH 2.9 能源规则

v0.1.7 能源规则；本次发布按用户要求执行逻辑、浏览器及桌面应用检查和打包，结果见 `VALIDATION.md`。未启动 Minecraft 实例。数值依据用户指定实例中的 GregTech **5.09.54.265**，使用同名源代码标签核对；锅炉与轮机关键方法另与安装 jar 的 `javap` 输出对照。文件哈希与来源索引在 `src/data/energy-provenance.json`，运行数值在 `src/data/energy-reference.js`。

## 已采用的数值

| 项目 | 规则 | GT5 源文件 |
| --- | --- | --- |
| 游戏时间 | 20 ticks/s | `GTValues`、各机器 tick |
| 小型燃煤锅炉 | 高于 100 °C 时每 10 ticks 产 60 mB，即 120 mB/s；上限 500 °C | `MTEBoiler`、`MTEBoilerBronze` |
| 锅炉水汽转换 | 1 mB 水 → 160 mB 蒸汽，余数保留 | `GTValues.STEAM_PER_WATER`、`MTEBoiler.produceSteam` |
| 锅炉燃料和温度 | 普通煤熔炉燃烧值 1600 / 10 = 160 加热点；每 12 ticks 消耗 1 点升温 1 °C；温度高于环境时每 46 ticks 降温 1 °C | `MTEBoilerBronze.updateFuel`、`MTEBoiler.calculateHeatUp/calculateCooldown` |
| 锅炉容量 | 水、蒸汽各 16000 mB；蒸汽超量后安全阀降至 75% | `MTEBoiler` |
| 小锅炉物品自动化 | 实例 `allowSmallBoilerAutomation=false`，通过按钮向燃料槽装煤，不自动从仓库无限补煤 | `config/GregTech/GregTech.cfg` |
| 青铜蒸汽机器 | 基准 EU/t 不变，工时 ×2；2 mB 蒸汽 = 1 EU；物理汽量容量 32000 mB、启动门槛 2000 mB | `MTEBasicMachineBronze`、`SteamOverclockDescriber` |
| 矿石研磨基准 | 2 EU/t、20 秒；青铜机器实际 80 mB/s、40 秒 | `ProcessingOre` |
| 铜锡青铜合金基准 | 15 EU/t、200 ticks；青铜合金炉实际 600 mB/s、20 秒 | `AlloySmelterRecipes` |
| 蒸汽轮机 LV / MV / HV | 每次分别耗 7 / 8 / 9 mB，产 3 EU；额定分别 32 / 128 / 512 EU/t，1 A | `MTESteamTurbine`、`MTEBasicGenerator` |
| 柴油 | 热值 480 EU/mB；LV / MV / HV 效率 95% / 90% / 85%，实际 456 / 432 / 408 EU/mB | `MaterialsInit.loadDiesel`、`LoaderMetaTileEntities`、`MTEBasicGenerator` |
| 氢气 | 热值 20 EU/mB；燃气轮机 LV / MV / HV / EV / IV 效率 95% / 90% / 85% / 60% / 50% | `MaterialsInit.loadHydrogen`、`LoaderMetaTileEntities` |
| 氦等离子体 | 热值 81920 EU/mB；小型等离子发电机效率为 `(10 + 10 × tier)%`，最高 UV | `ProcessingCell`、`MTEPlasmaGenerator` |
| 发电机内部 | `V × 80 + 512` EU 缓冲；保留 512 EU 后输出；每 10 ticks 按整数燃料操作填充缓冲 | `MTEBasicGenerator`、`MetaTileEntity` |
| 普通用电机器内部 | `V × 64` EU 缓冲，输入安培上限 `floor(2 × 实际 EU/t / V) + 1` | `MTEBasicMachine` |
| 普通超频 | 按电压等级差，每次功率 ×4、工时 ÷2；ULV 配方按 LV 处理 | `OverclockCalculator`、`EUOverclockDescriber` |
| 四格电池箱 | 必须装电池；每节电池允许 2 A 输入、1 A 输出；箱体缓冲 `V × 64 × 4`，另加电池容量 | `MTEBasicBatteryBuffer` |
| 电池容量 | LV / MV / HV 锂电池 100000 / 400000 / 1600000 EU；EV–UXV 全电池依次 6400000 至 1677721600000 EU | `MetaGeneratedItem01.setElectricStats` |
| 水电解 | 1000 mB 水对应 2000 mB 氢、1000 mB 氧；30 EU/t、100 秒，消耗 60000 EU | `ElectrolyzerRecipes`；气体自动进入独立储罐，省略原版空单元格操作 |
| 同位素离心 | 160 mB 氢 → 40 mB 氘，20 EU/t、8 秒；160 mB 氘 → 40 mB 氚，80 EU/t、8 秒 | `CentrifugeRecipes` |
| 氦等离子体聚变 | 氘、氚各 125 mB → 等离子体 125 mB；3840 EU/t、16 ticks；40000000 EU 启动 | `FusionReactorRecipes` |
| 聚变控制器 | 按装满能源仓的 MK I–III 抽象，容量 `160000000 × 2^(tier−6) + 3000 × (tier−5)`；已校准聚变配方超频功率 ×2、工时 ÷2 | `MTEFusionComputer`、`FusionOverclockDescriber` |
| 戴森 | 每模块 10000000 EU/t，主世界系数 1；每周期 72000 ticks，预扣 3600000 mB `cryotheum`；最大 10000 模块，按实例公式损耗，当前计算站 CPS = 0 | `TileEntityDysonSwarm`、实例 `config/gtnhintergalactic.cfg` |

蒸汽轮机采用安装版本方法实际计算出来的 `mB → EU` 比值，没有套用其他 GregTech 版本的效率百分比。原版燃料操作为整数，余留燃料保留在机内，不按显示用的“每批时间”任意放大发电量。

## 连接和操作

- 用汽机器和蒸汽轮机：在“供能”页选择直连某台锅炉，或从指定储罐取汽。锅炉可将剩余蒸汽送入一个指定储罐。
- 用电机器：选择直连某台发电设备，或从某台电池箱取电。电池箱选择发电设备作为充电来源。
- 燃油、燃气、等离子发电机：指定燃料储罐；燃料进入各自内部燃料罐，按实际热值燃烧。
- 设备之间以能源类型与电压筛选，过高电压拒绝连接，不会把高压 EU 自动降压。同一来源的所有消费者共享输出限制，不能因连接多台设备而复制安培或电量。
- 开始生产前需要启动储能；运行时持续扣除 EU／蒸汽。强制停止取消批次，保留机内存量。锅炉停止装煤后，已燃烧燃料和余热继续工作。
- 普通暂停保留当前批次和聚变启动状态；强制停止或切换配方清除启动状态，再启动聚变需要重新积累启动电量。
- 电池从工作台合成，在电池箱“供能”页装入。无电池不能充放电。取出一节前，剩余电池与箱体必须能容纳现有电量，避免取出再装入复制电量。
- 升级需要付材料，并且不能有未结束批次；电池箱先取出电池。章节解锁不会自动提高已有设备电压。
- 拆除前用完或排空机内能源；排空会退回可存放的流体，剩余 EU 散去。燃烧中的锅炉先冷却。戴森周期可用强制停止取消，已用冷却液不返还。

## 存档迁移

schema 4 保存设备电压、连接、EU／汽／燃料缓冲、电池槽、锅炉热状态和戴森周期；schema 2、3 可迁移。旧全局 EU 转入 `legacyEnergy`，它不能供给机器，只能在实体电池箱装入电池后，按空余容量转存。转存不会增加累计产出。

旧批次按剩余进度换算工时；此前预扣但尚未用完的蒸汽／燃料计入对应设备缓冲。旧聚变配方的剩余氢和氦退入迁移罐，重新选择氘氚配方；不凭空生成新同位素。新连接默认留空，让玩家选择实际能源来源。移除设备／空罐会解除相关连接。

迁移退料优先合并到同流体的旧式储罐；满额存档允许必要的迁移罐占位，避免迁移后的存档无法重新载入。正常建造的容器上限仍为 10000。

## 放置版边界

这里对照的是能源转换、额定输出、储能和普通超频数值，**不是整个 GTNH 内容已完整复刻的声明**。

目前连接代表相邻端口或理想的零长度连线，没有物理坐标、电缆长度／线损／过流烧线、变压器、多方块搭建、转子磨损、机器维护或计算站建设。普通机器保留断能暂停批次的放置玩法；锅炉缺水采用暂停产汽保护，没有原版热锅炉补水爆炸。锅炉以 20 tick 时钟计算，其他设备及共享连接沿用放置模拟的有限步长；离线最多 0.5 秒一步，不宣称网络转移顺序逐 tick 等同 Minecraft。

戴森按模块功率向逻辑输出端供能，选定电压决定连接兼容性，支持多安培输出；多方块动力仓没有逐个建模。每步先分配当步发电，再将未用电量保留到 `V × 80 + 512` 的放置版输出缓冲；过量发电舍弃，不发生原版动力仓满载爆炸。这一缓冲是本游戏的连接抽象，不是原版戴森储能参数，也不限制模块额定发电率。

大部分材料加工、设备建造与升级材料、电池的制取、极寒之凛冰的制取以及后期材料聚变仍为 `source: adapted`。本轮校正了水电解、同位素离心、氘氚聚变、青铜合金及矿石研磨的能源基准；盐水配方修正能耗和气量，省略了前置混合及氢氧化钠副产物。完整燃料化工链、大型锅炉／大型燃机／核电等机型尚未全部移植。

新增图标由 `scripts/import-energy-icons.py` 从原始模组 jar 转成 SVG 路径，来源写入图标清单。不读取额外材质包；原始 jar 缺少高阶电池素材时共用原版 HV 锂电池外形，等级由文字标识，清单明确记录替代。
