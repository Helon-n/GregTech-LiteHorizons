"""Import verified non-ore drops; encounter timing is an idle adaptation."""
import hashlib
import json
import importlib.util
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
dragon=ROOT/'.local/gtnh-energy/GT5-Unofficial-5.09.54.265/src/main/java/gtPlusPlus/core/handler/events/EnderDragonDeathHandler.java'
dragon_text=dragon.read_text(encoding='utf-8')
assert 'MaterialsElements.STANDALONE.DRAGON_METAL.getNugget(aAmount)' in dragon_text and 'MathUtils.randInt(100, 250)' in dragon_text
result['sources'].append({'file':'gtPlusPlus/core/handler/events/EnderDragonDeathHandler.java','sha256':hashlib.sha256(dragon.read_bytes()).hexdigest()})
result['nodes'].append({'id':'dragonExpedition','name':'末影龙远征','output':'gTPP_DragonbloodNugget','stage':8,'requires':'advancedRocket','amount':2,'seconds':30,
    'description':'远征末地，取得龙血碎片并熔炼为龙血金属','cost':{'tungstensteelPlate':24,'motor':4},'dropRanges':{'gTPP_DragonbloodNugget':{'min':1,'max':3}}})
result['adaptations'].append('Dragonblood nugget identity and dragon-drop source come from EnderDragonDeathHandler. An expedition yields 1–3 nuggets per 30 s with a rocket and deployment cost; this is a scaled idle encounter, not a full boss kill or the source multi-stack drop distribution. No ingots, hypogen or research are granted directly.')
hydra=next(d for d in data['moblist']['TwilightForest.Hydra'] if d['reconstructableStack']['itemIdentifier']=={'modId':'TwilightForest','name':'item.fieryBlood'})
assert hydra['chance']>0
result['nodes'].append({'id':'hydraExpedition','name':'九头蛇远征','output':'modItem_TwilightForest_itemfieryBlood_0','stage':6,'requires':'flintPick','amount':2,'seconds':30,
    'description':'远征暮色森林，收集炽热血液用于炽铁和后期合金','cost':{'titaniumPlate':24,'motor':4},'dropRanges':{'modItem_TwilightForest_itemfieryBlood_0':{'min':1,'max':3}}})
result['adaptations'].append('Fiery blood is the checked Hydra boss drop. The repeatable 1–3 item expedition yield, deployment cost and thirty-second duration are idle adaptations, not the boss loot distribution.')
result['nodes'].append({'id':'twilightLibrary','name':'暮色高塔遗迹','output':'voidDust','stage':3,'requires':'flintPick','amount':2,'seconds':12,
                        'description':'搜寻高塔图书馆，回收虚空金属粉','cost':{'ironPlate':12,'motor':2}})
result['adaptations'].append('Library expeditions expose the existing tower-library Void dust loot as a repeatable idle resource (1–3 dust, centered on the source stack of 2); encounter timing and yield distribution are adaptations, not the complete weighted chest table.')
result['nodes'].append({'id':'grassland','name':'草地','output':'wheat_seeds','stage':2,'requires':'flintPick','amount':1,'seconds':4,
                        'description':'采集草籽，供给种子油产线','cost':{'ironPlate':12,'motor':2}})
result['adaptations'].append('Grass seed gathering is an idle adaptation of the vanilla wheat-seed resource. Its 1–2 yield and click timing are authored gameplay values; the fluid extractor recipe retains the pinned GT yield and energy.')
for id,title,output,description in [
    ('wheatField','麦田','wheat','收割成熟小麦，供给培养箱'),
    ('chickenCoop','鸡舍','egg','收集鸡蛋，供给生物实验'),
    ('sugarcaneBank','甘蔗地','reeds','采收甘蔗，研磨成糖'),
    ('treeNursery','苗圃','sapling','收集橡树树苗'),
    ('grassSod','草皮','grass','收集草方块，供给维度环境构建'),
    ('mushroomGrove','蘑菇林','brown_mushroom','采集棕蘑菇，供给发酵蜘蛛眼配方'),
    ('vineGrove','藤蔓林','vine','采集藤蔓，提取生物实验用洗涤剂'),
    ('poppyField','罂粟花田','red_flower','采集红花，提取红色染料'),
    ('cactusGrove','仙人掌地','cactus','收集仙人掌，烧制绿色染料'),
]:
    result['nodes'].append({'id':id,'name':title,'output':output,'stage':1,'requires':'flintPick','amount':1,'seconds':6,
        'description':description,'cost':{'ironPlate':12,'motor':2},'dropRanges':{output:{'min':1,'max':2}}})
result['adaptations'].append('Wheat, eggs, cane, oak saplings, grass blocks, brown mushrooms, vines, red poppies and cactus are physical vanilla resources exposed through repeatable idle gathering. Site cost, pickaxe requirement, 1–2 yield and six-second base duration are adaptations, not vanilla farming timings or GT machine recipes.')
skeleton=next(d for d in data['moblist']['SpecialMobs.NinjaSkeleton'] if d['reconstructableStack']['itemIdentifier']=={'modId':'minecraft','name':'bone'})
assert skeleton['chance']>0
result['nodes'].append({'id':'skeletonHunt','name':'骷髅狩猎','output':'bone','stage':1,'requires':'flintPick','amount':1,'seconds':8,
    'description':'狩猎骷髅，收集骨头并研磨为骨粉','cost':{'ironPlate':12,'motor':2},'dropRanges':{'bone':{'min':0,'max':2}}})
result['adaptations'].append('Skeleton bone identity is checked against the installed loot cache; the 0–2 encounter yield and timing are idle adaptations. No free bone meal or bacteria seed is supplied.')
for mob,resource,node,title in [('SpecialMobs.FireZombie','rotten_flesh','zombieHunt','僵尸狩猎'),
                              ('SpecialMobs.FlyingSpider','spider_eye','spiderHunt','蜘蛛狩猎')]:
    drop=next(d for d in data['moblist'][mob] if d['reconstructableStack']['itemIdentifier']=={'modId':'minecraft','name':resource})
    assert drop['reconstructableStack']['size']==1 and not drop['variableChance']
    result['nodes'].append({'id':node,'name':title,'output':resource,'stage':1,'requires':'flintPick','amount':1,'seconds':8,
        'description':'狩猎并收集生物实验原料','cost':{'ironPlate':12,'motor':2},
        'dropRanges':{resource:{'min':0,'max':1}},'dropProbabilities':{resource:drop['chance']/10000}})
result['adaptations'].append('Zombie and spider gathering retain the checked loot-cache one-item drop chance. Encounter rate and deployment cost are idle adaptations.')
underground=INSTANCE/'config/GregTech/UndergroundFluids.cfg'
underground_text=underground.read_text(encoding='utf-8')
assert 'S:Registry=unknowwater' in underground_text and 'S:Dimension=BarnardaE' in underground_text
result['sources'].append({'file':'config/GregTech/UndergroundFluids.cfg','sha256':hashlib.sha256(underground.read_bytes()).hexdigest()})
result['nodes'].append({'id':'alienFluidWell','name':'外星地下液体井','output':'unknownWater','stage':8,'requires':'advancedRocket','amount':1000,'seconds':10,
    'description':'远征采集未知液体，供给外星菌种分离；需要实体储罐','cost':{'tungstensteelPlate':12,'pump':2}})
result['adaptations'].append('Unknown-water deposits use the installed underground fluid registry. Rocket-gated access, 1000 mB per 10 seconds and well deployment are idle adaptations; original vein depletion, coordinates and drill tiers are not simulated.')
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
spec=importlib.util.spec_from_file_location('world_sources',ROOT/'scripts/gtnh-world-sources.py')
world_sources=importlib.util.module_from_spec(spec);spec.loader.exec_module(world_sources)
world_sources.generate(ROOT,INSTANCE,result)
spec=importlib.util.spec_from_file_location('magic_gathering',ROOT/'scripts/gtnh-magic-gathering.py')
magic_gathering=importlib.util.module_from_spec(spec);spec.loader.exec_module(magic_gathering)
magic_gathering.generate(ROOT,INSTANCE,result)
(ROOT/'src/data/gathering-reference.js').write_text('// Generated by scripts/import-gtnh-gathering.py.\nexport const GATHERING_REFERENCE='+json.dumps(result,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
