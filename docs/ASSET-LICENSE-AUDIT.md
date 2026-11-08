# 非 Minecraft 素材许可核对

核对日期：2026-11-08。对象是当前项目中已提取并公开的素材，不是整个 GTNH 模组列表。按要求不检查 Minecraft 官方许可。

## 结论

不能把这些素材统一当作“GTNH 开源素材”分发。当前存在明确的独立项目使用限制，也有允许使用但须署名、非商业或开放改编的素材。仓库公开和免费提供 EXE 本身不足以满足这些条件。

本次完成来源级核对：以 `sources.json` 为清单，读取实际 jar 的元数据、内附许可和署名，对照对应版本 GitHub 标签的根许可、README 和子目录声明。未找到标签的来源保留为待确认，不用最新版本许可代替旧版。CC、MIT、GPL 等名称来自实际文件内容，不只采用 GitHub 自动识别结果。尚未完成每张借用贴图的原作者链条及版权归属核对。

没有删除或替换素材、修改项目许可、重打包或更改远程仓库。此文件记录调查结果，不是权利人的许可证明。

## 最先需要处理的来源

| 来源 | 涉及图标记录 | 核对结果 |
| --- | ---: | --- |
| Railcraft 9.17.36 | 207 | LICENSE.md 禁止在不与 Railcraft 配合运行的其他项目使用 Art Assets；独立放置游戏不属于其列明例外。 |
| Galacticraft 3.4.37-GTNH | 158 | 第 28(d/e) 对 textured models、substantial parts 及 converted/partial copies 有限制；当前 rocket 来自原模型和贴图。GTNH 团队的分支授权不自动覆盖本项目。 |
| Hardcore Ender Expansion 1.12.29-GTNH | 61 | README 的 Source code and asset license 保留权利；修改版分发需明确许可，addon 不能含原模组部分。 |
| BiblioCraft 1.11.7 | 25 | jar copyright.txt 对修改贴图有“发布至作者相关论坛”的特殊条件；未找到当前分发已经满足条件的记录。 |
| Biomes O’ Plenty 1.7.10 分支 | 67 | 旧分支是 CC BY-NC-ND 4.0，非当前版本 ARR。需区分纯技术换格式与构成改编的图像变化。 |
| Tainted Magic 7.7.8-GTNH | 5 | CC BY-NC-ND 4.0；同样需核对是否构成改编，不能把所有 SVG 转换直接判为违法或直接判为允许。 |

Railcraft、Galacticraft、HEE 三个来源涉及 426 条记录；其中 Galacticraft 仍有 non-substantial parts 例外，不能把该来源的每个图标一概视为禁止。明确需要先解决的是现有项目不具备覆盖全部相关内容的授权依据。

ND 4.0 的技术格式转换例外见 [CC BY-NC-ND 4.0 第 2(a)(4) 条](https://creativecommons.org/licenses/by-nc-nd/4.0/legalcode.en#s2a4)。BOP 的 67 条记录中 58 条来自运行时渲染、9 条为单贴图；Tainted Magic 分别为 3 条和 2 条。这些处理记录不是最终的改编判定。

## 已查到的素材专门条款

- **AE2**：代码 LGPL、API MIT，贴图和模型另为 **CC BY-NC-SA 3.0**。应保留 AlgorithmX2 等作者、许可链接、修改说明和适用的相同方式共享条件。
- **OpenComputers、Draconic Evolution**：README 明确称 assets 为公有领域，但保留例外和来源声明要求；不能将同仓库所有第三方内容也视为公有领域。
- **Tinkers Mechworks**：代码 MIT，贴图 **CC BY 3.0**。
- **Twilight Forest**：README 明确回移的 Team Twilight 贴图按 **CC BY-NC-SA 4.0**；声音另有 ARR，当前项目没有收录模组声音。
- **JABBA、Thaumic Tinkerer、Akashic Tome**：分别为 **BY-NC-SA 4.0、BY-NC-SA 3.0、BY-NC 3.0**。
- **Botania 1.13.42-GTNH**：实际版本的 `web/module/license.php` 是自定义许可，明确覆盖 assets。使用代码或素材要求署名、说明修改，项目开放源码且允许他人修改和再分发并保留同类 Copyleft 条款；分发另有 Non-Monetary 条款。只公开 GitHub 源码但不给项目许可，不等于已满足。不能套用现代版本的许可。
- **Blood Magic**：项目 CC BY 4.0；README 说明部分 bound armour/tools 贴图借自 EE2，Pahimar 给 WayofTime 的许可不自动证明本项目可转用。当前目录有 boundPickaxe 等条目，仍需单独处理。
- **GregTech**：根许可 LGPL-3.0-or-later；实际版本另署名 Jimbno/UU-Tex、EtVitki 时空贴图，并保留多个合并模组的 MIT 许可记录。[UU-Tex 上游 README](https://github.com/Jimbno/UU-Tex#licensing) 明确列 CC BY-NC-SA 3.0。需要追踪合入的具体文件及历史授权并保留通知，不能把所有图标只标为 LGPL。

## 未取得足够证据的来源

“未确认”不是已证实禁止。部分模组没有内附素材许可，部分源码只写代码许可，部分官网返回 403 或跳转到登录页。IC2、Advanced Solar Panels、GraviSuite、Extra Utilities、Thaumcraft、Witchery 等不能因为已经随 GTNH 分发就认定允许移植素材。HarvestCraft、GalaxySpace、Better Builder’s Wands、Gendustry、Eternal Singularity 等的本次有效证据也不足。

BOP 特别核对了旧版 `BOP-1.7.10-2.1.x` README/build.gradle；GalaxySpace 改查 `dev_1.7.10`，没有采用其 1.12.2 分支作为旧版授权。CurseForge 的 Thaumcraft、IC2、Extra Utilities、HarvestCraft 许可页本次返回 403；Witchery 的旧官网跳转登录。没有用这些错误页作允许使用的证据。

## 完整来源表

“查到项目许可，素材范围待补核”只表示找到该版本的项目许可，不能替代第三方美术范围核对。“有明确素材或作品授权”也仍须满足对应条件和处理例外。

共 100 个来源：查到项目许可，素材范围待补核 61；尚未确认素材授权 16；有特殊条件需处理 7；有明确素材或作品授权 13；需单独授权或替换 3。

| 来源／实际 jar | 图标记录 | 许可或声明 | 核对状态 | 版本及证据 |
| --- | ---: | --- | --- | --- |
| AFSU-1.3.2-GTNH.jar | 2 | MIT | 查到项目许可，素材范围待补核 | 1.3.2-GTNH（版本标签）；[LICENSE](https://github.com/GTNewHorizons/AFSU/blob/1.3.2-GTNH/LICENSE) |
| AdvancedSolarPanel-1.7.10-3.5.1.jar | 15 | 未取得可确认的素材许可 | 尚未确认素材授权 | 无（未精确对应版本）；未取得有效许可文本 |
| AmunRa-GC-0.8.14.jar | 26 | MIT | 查到项目许可，素材范围待补核 | 0.8.14（版本标签）；[LICENSE](https://github.com/GTNewHorizons/amunra/blob/0.8.14/LICENSE) |
| ArchitectureCraft-1.12.19.jar | 5 | MIT | 查到项目许可，素材范围待补核 | 1.12.19（版本标签）；[LICENSE](https://github.com/GTNewHorizons/ArchitectureCraft/blob/1.12.19/LICENSE) |
| Avaritia-1.100.jar | 104 | MIT | 查到项目许可，素材范围待补核 | 1.100（版本标签）；[LICENSE.txt](https://github.com/GTNewHorizons/Avaritia/blob/1.100/LICENSE.txt) |
| Avaritiaddons-1.9.6-GTNH.jar | 2 | MPL-2.0 | 查到项目许可，素材范围待补核 | 1.9.6-GTNH（版本标签）；[LICENSE](https://github.com/GTNewHorizons/Avaritiaddons/blob/1.9.6-GTNH/LICENSE) |
| BetterBuildersWands-0.13.12-GTNH.jar | 8 | 未取得可确认的素材许可 | 尚未确认素材授权 | 0.13.12-GTNH（版本标签）；[README.md](https://github.com/GTNewHorizons/BetterBuildersWands/blob/0.13.12-GTNH/README.md) |
| BetterQuesting-3.8.92-GTNH.jar | 1 | MIT | 查到项目许可，素材范围待补核 | 3.8.92-GTNH（版本标签）；[LICENSE](https://github.com/GTNewHorizons/BetterQuesting/blob/3.8.92-GTNH/LICENSE) |
| BiblioCraft[v1.11.7][MC1.7.10].jar | 25 | 实际 jar copyright.txt 自定义条款 | 有特殊条件需处理 | master（未精确对应版本）；[README.md](https://github.com/Nuchaz/BiblioCraft/blob/master/README.md) |
| BiomesOPlenty-1.7.10-2.1.0.2308-universal.jar | 67 | CC BY-NC-ND 4.0（1.7.10 分支） | 有特殊条件需处理 | BOP-1.7.10-2.1.x（未精确对应版本）；[README.md](https://github.com/Glitchfiend/BiomesOPlenty/blob/BOP-1.7.10-2.1.x/README.md) |
| BloodArsenal-1.5.12.jar | 17 | CC BY 4.0 | 有明确素材或作品授权 | 1.5.12（版本标签）；[README.md](https://github.com/GTNewHorizons/BloodArsenal/blob/1.5.12/README.md) |
| BloodMagic-1.9.16.jar | 49 | CC BY 4.0；EE2 借用贴图需另核 | 有明确素材或作品授权 | 1.9.16（版本标签）；[README.md](https://github.com/GTNewHorizons/BloodMagic/blob/1.9.16/README.md) |
| Botania-1.13.42-GTNH.jar | 40 | Botania 自定义许可（明确覆盖 assets） | 有明确素材或作品授权 | 1.13.42-GTNH（版本标签）；[web/module/license.php](https://github.com/GTNewHorizons/Botania/blob/1.13.42-GTNH/web/module/license.php) |
| CarpentersBlocks-3.7.3-GTNH.jar | 11 | LGPL-2.1 | 查到项目许可，素材范围待补核 | 3.7.3-GTNH（版本标签）；[LICENSE](https://github.com/GTNewHorizons/CarpentersBlocks/blob/3.7.3-GTNH/LICENSE) |
| CompactKineticGenerators-1.7.10-1.0.jar | 8 | MIT | 尚未确认素材授权 | master（未精确对应版本）；[LICENSE](https://github.com/PinkaLulan/CompactKineticGenerators/blob/master/LICENSE) |
| Computronics-1.9.13-GTNH.jar | 20 | MIT | 查到项目许可，素材范围待补核 | 1.9.13-GTNH（版本标签）；[LICENSE.txt](https://github.com/GTNewHorizons/Computronics/blob/1.9.13-GTNH/LICENSE.txt) |
| Draconic-Evolution-1.5.35-GTNH.jar | 56 | 素材公有领域（保留例外及来源声明） | 有明确素材或作品授权 | 1.5.35-GTNH（版本标签）；[README.md](https://github.com/GTNewHorizons/Draconic-Evolution/blob/1.5.35-GTNH/README.md) |
| EMT-1.7.25.jar | 3 | GPL-3.0 | 查到项目许可，素材范围待补核 | 1.7.25（版本标签）；[LICENSE.txt](https://github.com/GTNewHorizons/Electro-Magic-Tools/blob/1.7.25/LICENSE.txt) |
| EnderIO-2.10.51.jar | 152 | 原版许可 + GTNH 修改 LGPL-3.0-or-later | 查到项目许可，素材范围待补核 | 2.10.51（版本标签）；[LICENSE.txt](https://github.com/GTNewHorizons/EnderIO/blob/2.10.51/LICENSE.txt) |
| EnderStorage-1.8.9.jar | 2 | MIT | 查到项目许可，素材范围待补核 | 1.8.9（版本标签）；[LICENSE.txt](https://github.com/GTNewHorizons/EnderStorage/blob/1.8.9/LICENSE.txt) |
| EnderZoo-1.3.6.jar | 2 | CC0 1.0 | 有明确素材或作品授权 | 1.3.6（版本标签）；[README.md](https://github.com/GTNewHorizons/EnderZoo/blob/1.3.6/README.md) |
| FloodLights-1.5.6.jar | 10 | GPL-3.0 / LGPL-3.0 | 查到项目许可，素材范围待补核 | 1.5.6（版本标签）；[COPYING](https://github.com/GTNewHorizons/FloodLights/blob/1.5.6/COPYING) |
| Forbidden.Magic-0.9.18-GTNH.jar | 9 | WTFPL | 查到项目许可，素材范围待补核 | 0.9.18-GTNH（版本标签）；[LICENSE](https://github.com/GTNewHorizons/ForbiddenMagic/blob/0.9.18-GTNH/LICENSE) |
| Forestry-4.11.40.jar | 218 | LGPL-3.0 | 查到项目许可，素材范围待补核 | 4.11.40（版本标签）；[LICENSE.txt](https://github.com/GTNewHorizons/ForestryMC/blob/4.11.40/LICENSE.txt) |
| ForgeMultipart-1.7.18.jar | 3 | LGPL-2.1 | 查到项目许可，素材范围待补核 | 1.7.18（版本标签）；[LICENSE.txt](https://github.com/GTNewHorizons/ForgeMultipart/blob/1.7.18/LICENSE.txt) |
| ForgeRelocation-0.3.7.jar | 1 | GPL-3.0 | 查到项目许可，素材范围待补核 | 0.3.7（版本标签）；[LICENSE](https://github.com/GTNewHorizons/ForgeRelocation/blob/0.3.7/LICENSE) |
| GTNewHorizonsCoreMod-2.9.99.jar | 482 | GPL-3.0 | 查到项目许可，素材范围待补核 | 2.9.99（版本标签）；[LICENSE](https://github.com/GTNewHorizons/NewHorizonsCoreMod/blob/2.9.99/LICENSE) |
| Galacticraft-3.4.37-GTNH.jar | 158 | Galacticraft 自定义许可 | 需单独授权或替换 | 3.4.37-GTNH（版本标签）；[LICENSE-GTNH.txt](https://github.com/GTNewHorizons/Galacticraft/blob/3.4.37-GTNH/LICENSE-GTNH.txt) |
| GalaxySpace-1.1.144-GTNH.jar | 105 | 未取得可确认的素材许可 | 尚未确认素材授权 | dev_1.7.10（未精确对应版本）；[README.md](https://github.com/BlesseNtumble/GalaxySpace/blob/dev_1.7.10/README.md) |
| GraviSuite-1.7.10-2.0.3.jar | 5 | 未取得可确认的素材许可 | 尚未确认素材授权 | 无（未精确对应版本）；未取得有效许可文本 |
| HardcoreEnderExpansion-1.12.29-GTNH.jar | 61 | All Rights Reserved + 列明例外 | 需单独授权或替换 | 1.12.29-GTNH（版本标签）；[README.md](https://github.com/GTNewHorizons/Hardcore-Ender-Expansion/blob/1.12.29-GTNH/README.md) |
| IC2NuclearControl-2.7.17.jar | 33 | GPL-3.0 / LGPL-3.0 / 原版许可 + GTNH 修改 LGPL-3.0-or-later / MIT / CoFH：代码保留权利／美术 CC BY-SA 4.0 | 查到项目许可，素材范围待补核 | 2.7.17（版本标签）；[LICENSE](https://github.com/GTNewHorizons/Nuclear-Control/blob/2.7.17/LICENSE) |
| IguanaTweaksTConstruct-2.7.15.jar | 1 | CC BY-SA 4.0 | 查到项目许可，素材范围待补核 | 2.7.15（版本标签）；[LICENSE](https://github.com/GTNewHorizons/IguanaTweaksTConstruct/blob/2.7.15/LICENSE) |
| IronChest-6.1.13.jar | 22 | GPL-3.0 | 查到项目许可，素材范围待补核 | 6.1.13（版本标签）；[LICENSE.txt](https://github.com/GTNewHorizons/ironchest/blob/6.1.13/LICENSE.txt) |
| IronChestMinecarts-1.2.1.jar | 7 | 未取得可确认的素材许可 | 尚未确认素材授权 | 1.2.1（版本标签）；[README.md](https://github.com/GTNewHorizons/IronChestMinecarts/blob/1.2.1/README.md) |
| JABBA-1.5.24.jar | 33 | CC BY-NC-SA 4.0 | 有明确素材或作品授权 | 1.5.24（版本标签）；[README.md](https://github.com/GTNewHorizons/Jabba/blob/1.5.24/README.md) |
| MrTJPCore-1.3.7.jar | 20 | GPL-3.0 / LGPL-3.0 | 查到项目许可，素材范围待补核 | 1.3.7（版本标签）；[COPYING](https://github.com/GTNewHorizons/MrTJPCore/blob/1.3.7/COPYING) |
| Natura-2.8.24.jar | 135 | GPL-3.0 / LGPL-3.0 / 原版许可 + GTNH 修改 LGPL-3.0-or-later | 查到项目许可，素材范围待补核 | 2.8.24（版本标签）；[LICENSE](https://github.com/GTNewHorizons/Natura/blob/2.8.24/LICENSE) |
| OpenBlocks-1.12.22-GTNH.jar | 42 | MIT | 查到项目许可，素材范围待补核 | 1.12.22-GTNH（版本标签）；[LICENSE.txt](https://github.com/GTNewHorizons/OpenBlocks/blob/1.12.22-GTNH/LICENSE.txt) |
| OpenComputers-1.12.68-GTNH.jar | 132 | 素材公有领域（保留例外及来源声明） | 有明确素材或作品授权 | 1.12.68-GTNH（版本标签）；[README.md](https://github.com/GTNewHorizons/OpenComputers/blob/1.12.68-GTNH/README.md) |
| OpenModsLibs-0.10.15.jar | 2 | MIT | 查到项目许可，素材范围待补核 | 0.10.15（版本标签）；[LICENSE](https://github.com/GTNewHorizons/OpenModsLib/blob/0.10.15/LICENSE) |
| OpenModularTurrets-2.4.8.jar | 60 | GPL-3.0 | 查到项目许可，素材范围待补核 | 2.4.8（版本标签）；[LICENSE](https://github.com/GTNewHorizons/OpenModularTurrets/blob/2.4.8/LICENSE) |
| ProjRed-4.12.50-GTNH.jar | 87 | MIT | 查到项目许可，素材范围待补核 | 4.12.50-GTNH（版本标签）；[LICENSE.md](https://github.com/GTNewHorizons/ProjectRed/blob/4.12.50-GTNH/LICENSE.md) |
| ProjectBlue-1.2.11-GTNH.jar | 1 | 自定义许可 | 查到项目许可，素材范围待补核 | 1.2.11-GTNH（版本标签）；[LICENSE](https://github.com/GTNewHorizons/ProjectBlue/blob/1.2.11-GTNH/LICENSE) |
| Railcraft-9.17.36.jar | 207 | Railcraft 自定义许可 | 需单独授权或替换 | 9.17.36（版本标签）；[LICENSE.md](https://github.com/GTNewHorizons/Railcraft/blob/9.17.36/LICENSE.md) |
| RandomThings-2.7.13.jar | 18 | LGPL-3.0 / MIT | 查到项目许可，素材范围待补核 | 2.7.13（版本标签）；[LICENSE](https://github.com/GTNewHorizons/Random-Things/blob/2.7.13/LICENSE) |
| RemoteIO-2.7.11.jar | 17 | MIT | 查到项目许可，素材范围待补核 | 2.7.11（版本标签）；[LICENSE](https://github.com/GTNewHorizons/RemoteIO/blob/2.7.11/LICENSE) |
| SGCraft-1.4.14-GTNH.jar | 12 | MIT | 查到项目许可，素材范围待补核 | 1.4.14-GTNH（版本标签）；[LICENSE.txt](https://github.com/GTNewHorizons/SGCraft/blob/1.4.14-GTNH/LICENSE.txt) |
| SpiceOfLife-2.2.12-carrot.jar | 3 | LGPL-3.0 | 查到项目许可，素材范围待补核 | 2.2.12-carrot（版本标签）；[LICENSE.txt](https://github.com/GTNewHorizons/SpiceOfLife/blob/2.2.12-carrot/LICENSE.txt) |
| StevesAddons-0.15.5.jar | 2 | 自定义许可 | 查到项目许可，素材范围待补核 | 0.15.5（版本标签）；[LICENSE.md](https://github.com/GTNewHorizons/StevesAddons/blob/0.15.5/LICENSE.md) |
| StevesCarts-2.3.15.jar | 154 | MIT | 查到项目许可，素材范围待补核 | 2.3.15（版本标签）；[LICENSE](https://github.com/GTNewHorizons/SC2/blob/2.3.15/LICENSE) |
| StevesFactoryManager-1.3.13-GTNH.jar | 9 | 自定义许可 | 查到项目许可，素材范围待补核 | 1.3.13-GTNH（版本标签）；[LICENSE.txt](https://github.com/GTNewHorizons/Steve-s-Factory-Manager/blob/1.3.13-GTNH/LICENSE.txt) |
| TConstruct-1.14.123-GTNH.jar | 266 | LGPL-3.0 | 查到项目许可，素材范围待补核 | 1.14.123-GTNH（版本标签）；[LICENSE](https://github.com/GTNewHorizons/TinkersConstruct/blob/1.14.123-GTNH/LICENSE) |
| TMechworks-0.4.2.jar | 12 | 贴图 CC BY 3.0 | 有明确素材或作品授权 | 0.4.2（版本标签）；[README.md](https://github.com/GTNewHorizons/TinkersMechworks/blob/0.4.2/README.md) |
| Tainted-Magic-7.7.8-GTNH.jar | 5 | CC BY-NC-ND 4.0 | 有特殊条件需处理 | 7.7.8-GTNH（版本标签）；[LICENSE](https://github.com/GTNewHorizons/Tainted-Magic/blob/7.7.8-GTNH/LICENSE) |
| Thaumcraft-1.7.10-4.2.3.5.jar | 55 | 未取得可确认的素材许可 | 尚未确认素材授权 | 无（未精确对应版本）；未取得有效许可文本 |
| Thaumic-Based-1.9.22.jar | 8 | CC0 1.0 | 有明确素材或作品授权 | 1.9.22（版本标签）；[README.md](https://github.com/GTNewHorizons/ThaumicBases/blob/1.9.22/README.md) |
| ThaumicHorizons-1.8.28.jar | 3 | LGPL-3.0 | 查到项目许可，素材范围待补核 | 1.8.28（版本标签）；[LICENSE.txt](https://github.com/GTNewHorizons/ThaumicHorizons/blob/1.8.28/LICENSE.txt) |
| ThaumicTinkerer-2.12.34.jar | 8 | CC BY-NC-SA 3.0 | 有明确素材或作品授权 | 2.12.34（版本标签）；[README.md](https://github.com/GTNewHorizons/ThaumicTinkerer/blob/2.12.34/README.md) |
| Translocator-1.4.5.jar | 3 | GPL-3.0 / LGPL-3.0 | 查到项目许可，素材范围待补核 | 1.4.5（版本标签）；[LICENSE.txt](https://github.com/GTNewHorizons/Translocators/blob/1.4.5/LICENSE.txt) |
| TwilightForest-2.7.45.jar | 47 | 部分贴图 CC BY-NC-SA 4.0；代码 LGPL-2.1 | 有明确素材或作品授权 | 2.7.45（版本标签）；[README.md](https://github.com/GTNewHorizons/twilightforest/blob/2.7.45/README.md) |
| VillageNames-4.5.21-GTNH.jar | 2 | GPL-3.0 | 查到项目许可，素材范围待补核 | 4.5.21-GTNH（版本标签）；[LICENSE](https://github.com/GTNewHorizons/VillageNames/blob/4.5.21-GTNH/LICENSE) |
| WR-CBE-1.7.12.jar | 10 | MIT | 查到项目许可，素材范围待补核 | 1.7.12（版本标签）；[LICENSE.txt](https://github.com/GTNewHorizons/WirelessRedstone-CBE/blob/1.7.12/LICENSE.txt) |
| WirelessCraftingTerminal-1.12.17.jar | 2 | GPL-3.0 | 查到项目许可，素材范围待补核 | 1.12.17（版本标签）；[LICENSE](https://github.com/GTNewHorizons/WirelessCraftingTerminal/blob/1.12.17/LICENSE) |
| WitchingGadgets-1.8.53-GTNH.jar | 1 | LGPL-3.0 | 查到项目许可，素材范围待补核 | 1.8.53-GTNH（版本标签）；[LICENSE.txt](https://github.com/GTNewHorizons/WitchingGadgets/blob/1.8.53-GTNH/LICENSE.txt) |
| Ztones-1.7.10-2.2.2.jar | 2 | MIT | 尚未确认素材授权 | master（未精确对应版本）；[LICENSE](https://github.com/GTNewHorizons/Ztones-Unofficial/blob/master/LICENSE) |
| adventurebackpack-1.4.28-GTNH.jar | 13 | LGPL-3.0 | 查到项目许可，素材范围待补核 | 1.4.28-GTNH（版本标签）；[LICENSE](https://github.com/GTNewHorizons/AdventureBackpack2/blob/1.4.28-GTNH/LICENSE) |
| ae2fc-1.5.116-gtnh.jar | 38 | LGPL-3.0 | 查到项目许可，素材范围待补核 | 1.5.116-gtnh（版本标签）；[LICENSE.txt](https://github.com/GTNewHorizons/AE2FluidCraft-Rework/blob/1.5.116-gtnh/LICENSE.txt) |
| akashictome-1.2.7.jar | 1 | CC BY-NC 3.0 | 有明确素材或作品授权 | 1.2.7（版本标签）；[Readme.md](https://github.com/GTNewHorizons/AkashicTome/blob/1.2.7/Readme.md) |
| appliedenergistics2-rv3-beta-1095-GTNH.jar | 193 | 贴图／模型 CC BY-NC-SA 3.0 | 有明确素材或作品授权 | rv3-beta-1095-GTNH（版本标签）；[README.md](https://github.com/GTNewHorizons/Applied-Energistics-2-Unofficial/blob/rv3-beta-1095-GTNH/README.md) |
| backpack-2.6.18-GTNH.jar | 3 | LGPL-3.0 | 查到项目许可，素材范围待补核 | 2.6.18-GTNH（版本标签）；[LICENSE.md](https://github.com/GTNewHorizons/Minecraft-Backpack-Mod/blob/2.6.18-GTNH/LICENSE.md) |
| battlegear2-1.6.8-backhand.jar | 17 | GPL-3.0 | 查到项目许可，素材范围待补核 | 1.6.8-backhand（版本标签）；[LICENCE](https://github.com/GTNewHorizons/Battlegear2-for-Backhand/blob/1.6.8-backhand/LICENCE) |
| bdlib-1.11.1-GTNH.jar | 1 | 未取得可确认的素材许可 | 尚未确认素材授权 | 1.11.1-GTNH（版本标签）；未取得有效许可文本 |
| binnie-mods-2.6.51.jar | 110 | LGPL-3.0 | 查到项目许可，素材范围待补核 | 2.6.51（版本标签）；[LICENSE.txt](https://github.com/GTNewHorizons/Binnie/blob/2.6.51/LICENSE.txt) |
| buildcraft-7.1.65.jar | 55 | MMPL 1.0.1（API 另为 MIT） | 有特殊条件需处理 | 7.1.65（版本标签）；[LICENSE](https://github.com/GTNewHorizons/BuildCraft/blob/7.1.65/LICENSE) |
| catwalks-2.4.2-GTNH.jar | 6 | MMPL 2.0.3（上游 master） | 有特殊条件需处理 | master（未精确对应版本）；[LICENSE.md](https://github.com/thecodewarrior/Catwalk-Mod/blob/master/LICENSE.md) |
| chisel-2.17.34-GTNH.jar | 103 | LGPL-3.0 | 查到项目许可，素材范围待补核 | 2.17.34-GTNH（版本标签）；[LICENSE](https://github.com/GTNewHorizons/Chisel/blob/2.17.34-GTNH/LICENSE) |
| cropsnh-2.0.140.jar | 2 | LGPL-3.0 | 查到项目许可，素材范围待补核 | 2.0.140（版本标签）；[LICENSE.txt](https://github.com/GTNewHorizons/CropsNH/blob/2.0.140/LICENSE.txt) |
| eternalsingularity-1.4.3.jar | 10 | 未取得可确认的素材许可 | 尚未确认素材授权 | 1.4.3（版本标签）；[README.md](https://github.com/GTNewHorizons/Eternal-Singularity/blob/1.4.3/README.md) |
| etfuturum-2.6.65-GTNH.jar | 107 | LGPL-3.0 | 查到项目许可，素材范围待补核 | 2.6.65-GTNH（版本标签）；[LICENSE](https://github.com/GTNewHorizons/Et-Futurum-Requiem/blob/2.6.65-GTNH/LICENSE) |
| extrautilities-1.2.12.jar | 113 | 未取得可确认的素材许可 | 尚未确认素材授权 | 无（未精确对应版本）；未取得有效许可文本 |
| fether-2.0.9.jar | 20 | LGPL-3.0 | 查到项目许可，素材范围待补核 | 2.0.9（版本标签）；[LICENSE](https://github.com/GTNewHorizons/Fether/blob/2.0.9/LICENSE) |
| gendustry-1.9.13-GTNH.jar | 35 | 未取得可确认的素材许可 | 尚未确认素材授权 | 1.9.13-GTNH（版本标签）；[README.md](https://github.com/GTNewHorizons/gendustry/blob/1.9.13-GTNH/README.md) |
| gregtech-5.09.54.265.jar | 14550 | LGPL-3.0 | 查到项目许可，素材范围待补核 | 5.09.54.265（版本标签）；[LICENSE.txt](https://github.com/GTNewHorizons/GT5-Unofficial/blob/5.09.54.265/LICENSE.txt) |
| harvestcraft-1.3.15-GTNH.jar | 160 | 未取得可确认的素材许可 | 尚未确认素材授权 | master（未精确对应版本）；[CREDITS-fml.txt](https://github.com/MatrexsVigil/harvestcraft/blob/master/CREDITS-fml.txt) |
| holoinventory-2.5.18-GTNH.jar | 1 | LGPL-3.0 | 查到项目许可，素材范围待补核 | 2.5.18-GTNH（版本标签）；[LICENSE.txt](https://github.com/GTNewHorizons/HoloInventory/blob/2.5.18-GTNH/LICENSE.txt) |
| industrialcraft-2-2.2.828-experimental.jar | 223 | 未取得可确认的素材许可 | 尚未确认素材授权 | 无（未精确对应版本）；未取得有效许可文本 |
| instance | 1 | CC BY-NC-SA 4.0；标志权利另核 | 有特殊条件需处理 | 2.9.0（版本标签）；[LICENSE](https://github.com/GTNewHorizons/GT-New-Horizons-Modpack/blob/2.9.0/LICENSE) |
| irontanks-1.4.7.jar | 23 | MIT | 查到项目许可，素材范围待补核 | 1.4.7（版本标签）；[LICENSE.txt](https://github.com/GTNewHorizons/Irontanks/blob/1.4.7/LICENSE.txt) |
| logisticspipes-1.5.39-GTNH.jar | 97 | MMPL 1.0.1 | 有特殊条件需处理 | 1.5.39-GTNH（版本标签）；[LICENSE.md](https://github.com/GTNewHorizons/LogisticsPipes/blob/1.5.39-GTNH/LICENSE.md) |
| magicbees-2.10.13-GTNH.jar | 36 | 自定义许可 / WTFPL | 查到项目许可，素材范围待补核 | 2.10.13-GTNH（版本标签）；[LICENSE](https://github.com/GTNewHorizons/MagicBees/blob/2.10.13-GTNH/LICENSE) |
| malisisdoors-1.19.13-GTNH.jar | 45 | MIT | 查到项目许可，素材范围待补核 | 1.19.13-GTNH（版本标签）；[LICENSE.txt](https://github.com/GTNewHorizons/MalisisDoors/blob/1.19.13-GTNH/LICENSE.txt) |
| openprinter-0.3.1-GTNH.jar | 4 | MIT | 查到项目许可，素材范围待补核 | 0.3.1-GTNH（版本标签）；[LICENSE](https://github.com/GTNewHorizons/OpenPrinter/blob/0.3.1-GTNH/LICENSE) |
| opensecurity-1.2.2-GTNH.jar | 14 | MIT | 查到项目许可，素材范围待补核 | 1.2.2-GTNH（版本标签）；[LICENSE](https://github.com/GTNewHorizons/OpenSecurity/blob/1.2.2-GTNH/LICENSE) |
| sleepingbag-0.3.1.jar | 1 | LGPL-3.0 | 查到项目许可，素材范围待补核 | 0.3.1（版本标签）；[LICENSE.txt](https://github.com/GTNewHorizons/SleepingBags/blob/0.3.1/LICENSE.txt) |
| structurelib-1.4.47.jar | 1 | GPL-3.0 / LGPL-3.0 | 查到项目许可，素材范围待补核 | 1.4.47（版本标签）；[LICENSE](https://github.com/GTNewHorizons/StructureLib/blob/1.4.47/LICENSE) |
| supersolarpanel-1.1.5.jar | 9 | 未取得可确认的素材许可 | 尚未确认素材授权 | 1.1.5（版本标签）；未取得有效许可文本 |
| thaumicenergistics-1.7.68-GTNH.jar | 11 | GPL-3.0 / LGPL-3.0 / 原版许可 + GTNH 修改 LGPL-3.0-or-later | 查到项目许可，素材范围待补核 | 1.7.68-GTNH（版本标签）；[LICENSE](https://github.com/GTNewHorizons/ThaumicEnergistics/blob/1.7.68-GTNH/LICENSE) |
| tinkersdefense-1.3.4.jar | 3 | GPL-3.0 | 查到项目许可，素材范围待补核 | 1.3.4（版本标签）；[LICENSE](https://github.com/GTNewHorizons/Tinkers-Defense/blob/1.3.4/LICENSE) |
| witchery-1.7.10-0.24.1.jar | 39 | 未取得可确认的素材许可 | 尚未确认素材授权 | 无（未精确对应版本）；未取得有效许可文本 |

## 后续处理依据

1. 对限制明确的素材取得覆盖独立游戏、SVG 衍生图及 EXE 再分发的许可，或替换为自制素材；无需向 Minecraft 部分延伸本次调查。
2. 对 CC 类素材按来源保留作者、原作链接、具体版本许可及修改说明；只对适用的素材／改编部分采用其条件，不把不同许可强行合并。
3. 对 GPL/LGPL/MIT/MPL 类来源确认素材范围，保留适用版权与许可，核对原始可编辑素材及修改所需的对应来源义务。不能只提供 SVG 或仓库链接就一概声称满足全部条件，也不能不加判断地宣称整个独立游戏必须按某一种许可发布。
4. Botania 的项目 Copyleft 条款、Blood Magic 的 EE2 借用部分、GT 的第三方美术、GTNH 标志需要单独保留为处理项。

结构化记录及各来源图标键见 [asset-license-audit.json](licensing/asset-license-audit.json)。证据记录包含网址、实际标签／分支、文本 SHA-256；完整抓取缓存位于本地 `.local/license-audit/`，不作为本项目的授权文件。
