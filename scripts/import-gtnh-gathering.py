"""Import verified non-ore drops; encounter timing is an idle adaptation."""
import hashlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
INSTANCE=Path('D:/PrismLauncher/instances/GT_New_Horizons_2.9.0_Java_17-26/.minecraft')
path=INSTANCE/'config/mobsinfo/MobRecipeLoader.cache'
data=json.loads(path.read_text(encoding='utf-8'))
pearl=next(d for d in data['moblist']['Enderman'] if d['reconstructableStack']['itemIdentifier']=={'modId':'minecraft','name':'ender_pearl'})
assert pearl['chance']==5000 and pearl['reconstructableStack']['size']==1 and not pearl['variableChance']
result={'pack':'GTNH 2.9.0','origin':'config/mobsinfo/MobRecipeLoader.cache','sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
        'nodes':[{'id':'endermanHunt','name':'末影人狩猎','output':'enderPearlGem','stage':2,'requires':'flintPick','amount':1,'seconds':8,
                  'description':'寻找末影人，狩猎有机会掉落末影珍珠','cost':{'ironPlate':12,'motor':2},'dropRanges':{'enderPearlGem':{'min':0,'max':1}}}],
        'adaptations':['Encounter click count and collector deployment are idle abstractions. The unenchanted pearl drop remains 0–1 at 50%, from the installed pack loot cache.']}
blaze=next(d for d in data['moblist']['SpecialMobs.SpecialBlaze'] if d['reconstructableStack']['itemIdentifier']=={'modId':'minecraft','name':'blaze_rod'})
assert blaze['chance']==5000 and blaze['reconstructableStack']['size']==1 and not blaze['variableChance']
result['nodes'].append({'id':'blazeHunt','name':'烈焰人狩猎','output':'blazeRod','stage':2,'requires':'flintPick','amount':1,'seconds':8,
                        'description':'寻找烈焰人，狩猎有机会掉落烈焰棒','cost':{'ironPlate':12,'motor':2},'dropRanges':{'blazeRod':{'min':0,'max':1}}})
boar=next(d for d in data['moblist']['TwilightForest.Wild Boar'] if d['reconstructableStack']['itemIdentifier']=={'modId':'minecraft','name':'porkchop'})
assert boar['chance']==10000 and boar['reconstructableStack']['size']==2
result['nodes'].append({'id':'boarHunt','name':'野猪狩猎','output':'porkchop','stage':2,'requires':'flintPick','amount':2,'seconds':8,
                        'description':'寻找野猪，收集生猪排','cost':{'ironPlate':12,'motor':2}})
result['adaptations'].append('Boar encounters use the existing idle drop range (1–3), centered on the installed loot cache yield of 2 porkchops.')
result['nodes'].append({'id':'pineForest','name':'松树林','output':'pineLog','stage':3,'requires':'flintPick','amount':2,'seconds':4,
                        'description':'采伐松木，供给松油和矿物浮选产线','cost':{'ironPlate':12,'motor':2}})
result['adaptations'].append('The pine grove is an idle gathering location with a 1–3 log yield. The physical pine log is GT++ BOPBlockRegistrator.log_Pine, not interchangeable with an oak log in pine oil recipes.')
loot=ROOT/'.local/gtnh-technology/NewHorizonsCoreMod-2.9.99/src/main/java/com/dreammaster/TwilightForest/TF_Loot_Chests.java'
loot_text=loot.read_text(encoding='utf-8')
assert 'TFTreasure.tower_library.common.add(GTOreDictUnificator.get(OrePrefixes.dust, Materials.Void, 2L), 6)' in loot_text
result['sources']=[{'file':'NewHorizonsCoreMod/com/dreammaster/TwilightForest/TF_Loot_Chests.java','sha256':hashlib.sha256(loot.read_bytes()).hexdigest()}]
result['nodes'].append({'id':'twilightLibrary','name':'暮色高塔遗迹','output':'voidDust','stage':3,'requires':'flintPick','amount':2,'seconds':12,
                        'description':'搜寻高塔图书馆，回收虚空金属粉','cost':{'ironPlate':12,'motor':2}})
result['adaptations'].append('Library expeditions expose the existing tower-library Void dust loot as a repeatable idle resource (1–3 dust, centered on the source stack of 2); encounter timing and yield distribution are adaptations, not the complete weighted chest table.')
result['nodes'].append({'id':'grassland','name':'草地','output':'wheat_seeds','stage':2,'requires':'flintPick','amount':1,'seconds':4,
                        'description':'采集草籽，供给种子油产线','cost':{'ironPlate':12,'motor':2}})
result['adaptations'].append('Grass seed gathering is an idle adaptation of the vanilla wheat-seed resource. Its 1–2 yield and click timing are authored gameplay values; the fluid extractor recipe retains the pinned GT yield and energy.')
shards=ROOT/'.local/gtnh-technology/ThaumicTinkerer-2.12.34/src/main/java/thaumic/tinkerer/common/core/handler/kami/DimensionalShardDropHandler.java'
assert 'Math.random() <= 1D / 16D' in shards.read_text(encoding='utf-8')
result['sources'].append({'file':'ThaumicTinkerer-2.12.34/DimensionalShardDropHandler.java','sha256':hashlib.sha256(shards.read_bytes()).hexdigest()})
result['nodes'].append({'id':'netherShardHunt','name':'下界猪人狩猎','output':'modItem_ThaumicTinkerer_kamiResource_6','stage':7,'requires':'flintPick','amount':1,'seconds':10,
    'description':'在下界狩猎猪人，6.25% 概率获得下界碎片','cost':{'tungstensteelPlate':12,'motor':2},
    'dropRanges':{'modItem_ThaumicTinkerer_kamiResource_6':{'min':0,'max':1}},'dropProbabilities':{'modItem_ThaumicTinkerer_kamiResource_6':1/16}})
world=INSTANCE/'config/etfuturum/world.cfg'
assert 'I:debrisMax=3' in world.read_text(encoding='utf-8')
result['sources'].append({'file':'config/etfuturum/world.cfg','sha256':hashlib.sha256(world.read_bytes()).hexdigest()})
result['nodes'].append({'id':'ancientDebrisMine','name':'下界远古残骸','output':'modItem_EtFuturumRequiem_ancientdebris_0','stage':8,'requires':'flintPick','amount':1,'seconds':12,
    'description':'开采远古残骸，送入锻造锤处理','cost':{'tungstensteelPlate':12,'motor':2},'dropRanges':{'modItem_EtFuturumRequiem_ancientdebris_0':{'min':1,'max':1}}})
intake=ROOT/'.local/gtnh-energy/GT5-Unofficial-5.09.54.265/src/main/java/gtPlusPlus/xmod/gregtech/api/metatileentity/implementations/MTEHatchAirIntake.java'
assert 'return Materials.NetherAir.mFluid' in intake.read_text(encoding='utf-8')
result['sources'].append({'file':'gtPlusPlus/MTEHatchAirIntake.java','sha256':hashlib.sha256(intake.read_bytes()).hexdigest()})
result['nodes'].append({'id':'netherAtmosphere','name':'下界空气','output':'netherAir','stage':6,'requires':'flintPick','amount':1000,'seconds':6,
    'description':'收集下界空气，需要实体流体容器','cost':{'titaniumPlate':12,'pump':2}})
result['nodes'].append({'id':'tcetiSeaweed','name':'鲸鱼座 τ e 海藻','output':'modItem_GalaxySpace_tcetiedandelions_0','stage':8,'requires':'advancedRocket','amount':2,'seconds':12,
    'description':'远征鲸鱼座 τ e，采集海藻并提取萃取物','cost':{'tungstensteelPlate':12,'motor':2}})
harvest=INSTANCE/'config/harvestcraft.cfg'
assert 'B:seaweedseeddropfromgrass=false' in harvest.read_text(encoding='utf-8')
result['sources'].append({'file':'config/harvestcraft.cfg','sha256':hashlib.sha256(harvest.read_bytes()).hexdigest()})
result['nodes'].append({'id':'coastalSeaweed','name':'近海海藻','output':'modItem_PamsHarvestCraft_seaweedItem_0','stage':2,'requires':'flintPick','amount':2,'seconds':6,
    'description':'收集海藻，烧制海藻灰后提取碘','cost':{'ironPlate':12,'motor':2}})
result['adaptations'].append('Coastal seaweed gathering exposes the existing HarvestCraft crop to the idle game. Location, chapter, 1–3 yield and timing are adaptations; seeds do not drop from grass in this instance. The original GTNH seaweed-to-ash and iodine recipes are retained.')
mixes=ROOT/'.local/gtnh-energy/GT5-Unofficial-5.09.54.265/src/main/java/gregtech/api/enums/OreMixes.java'
assert '.secondary(WerkstoffLoader.Fayalit)' in mixes.read_text(encoding='utf-8')
result['sources'].append({'file':'gregtech/api/enums/OreMixes.java','sha256':hashlib.sha256(mixes.read_bytes()).hexdigest()})
result['nodes'].append({'id':'fayaliteMine','name':'铁橄榄石矿','output':'werkstoffLoader_FayalitRawOre','stage':7,'requires':'advancedRocket','amount':2,'seconds':10,
    'description':'远征采集铁橄榄石原矿，锤炼后加工为光学透镜','cost':{'tungstensteelPlate':12,'motor':2}})
result['adaptations'].append('The Fayalite OreMixes resource is exposed as raw ore with a rocket gate. Location, chapter and 1–3 yield are idle adaptations. RawOreLoader still requires hammer processing before gems can be used.')
result['nodes'].append({'id':'barnardaForest','name':'巴纳德 C 林地','output':'modItem_GalaxySpace_barnardaClog_0','stage':8,'requires':'advancedRocket','amount':2,'seconds':10,
    'description':'采伐巴纳德 C 原木，供给拉多克斯产线','cost':{'tungstensteelPlate':12,'motor':2}})
result['adaptations'].append('Barnarda C log gathering exposes GalaxySpace barnardaClog for Core BacteriaRegistry pyrolysis. Rocket requirements, chapter, encounter timing and 1–3 yield are idle adaptations; pyrolysis keeps its original inputs, duration and energy.')
result['sources'].append({'file':'NewHorizonsCoreMod/ExtractorRecipes.java','sha256':hashlib.sha256((ROOT/'.local/gtnh-technology/NewHorizonsCoreMod-2.9.99/src/main/java/com/dreammaster/gthandler/recipes/ExtractorRecipes.java').read_bytes()).hexdigest()})
result['adaptations'].extend([
    'Nether-shard hunts retain the pinned player-killed Nether pig-zombie drop probability of 1/16. Encounter timing, chapter and collector costs are idle adaptations.',
    'Ancient-debris mining exposes the installed Nether worldgen resource as an idle location at ZPM; one block per round is an adaptation, not the original vein-search distribution. Pickaxe tiers and world coordinates are abstracted.',
    'Nether atmosphere collection replaces a spatial Nether air-intake hatch with a paid collection site. Its 1000 mB per 6 s is an idle rate; fluid identity and subsequent machine recipes retain their source rules.',
    'TCeti E seaweed collection abstracts the existing deep-space plant resource into a rocket-gated site at ZPM. Gathering yield is adapted; the Core extractor still consumes 64 plants per extract at its registered EU/t and duration.'
])
(ROOT/'src/data/gathering-reference.js').write_text('// Generated by scripts/import-gtnh-gathering.py.\nexport const GATHERING_REFERENCE='+json.dumps(result,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
