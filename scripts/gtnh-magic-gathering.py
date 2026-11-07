"""Checked world/encounter resources for the industrial magical dependencies."""
import hashlib
import json
import zipfile


def generate(root,instance,result):
    magic=json.loads((root/'src/data/magic-reference.js').read_text(encoding='utf-8').split('=',1)[1].rstrip(';\n'))
    r=magic['resources'];research=magic['research']
    bootstrap=json.loads((root/'src/data/bootstrap-reference.js').read_text(encoding='utf-8').split('=',1)[1].rstrip(';\n'))
    def node(id,name,output,seconds=12,requires='flintPick',extra=None):
        row={'id':id,'name':name,'output':output,'stage':7,'requires':requires,'amount':1,'seconds':seconds,
             'description':name+'，收集实体材料','cost':{'tungstensteelPlate':12,'motor':2},'dropRanges':{output:{'min':1,'max':1}}}
        row.update(extra or {});result['nodes'].append(row);return row
    node('endShardHunt','末地碎片狩猎',r['endShard'],10,extra={'requiresAll':['advancedRocket'],'dropRanges':{r['endShard']:{'min':0,'max':1}},'dropProbabilities':{r['endShard']:1/32}})
    node('netherSoulSand','下界灵魂沙',r['soulSand'])
    node('lunarCheeseOre','月球奶酪矿',r['cheeseOre'],8,'rocket')
    node('netherSinExpedition','下界罪孽收集',r['prideShard'],60,extra={
        'requiresAll':[research['demon'],research['eldritch']],
        'dropRanges':{r[key]:{'min':0,'max':1} for key in ('prideShard','lustShard','gluttonyShard')},
        'exclusiveDrops':[{'chance':1/3,'items':{r[key]:1}} for key in ('prideShard','lustShard','gluttonyShard')]})
    node('endstoneQuarry','末地石矿场',bootstrap['endstone'],8,'advancedRocket')
    node('purpleSlimeIsland','紫色史莱姆岛',bootstrap['purpleGel'],12,extra={'requiresAll':['advancedRocket']})
    for cls in ('tconstruct/TConstruct.class','tconstruct/world/gen/SlimeIslandGen.class','tconstruct/world/TinkerWorld.class'):
        jar=next((instance/'mods').glob('TConstruct-*.jar'))
        with zipfile.ZipFile(jar) as z:digest=hashlib.sha256(z.read(cls)).hexdigest()
        result['sources'].append({'file':'TConstruct-1.14.123/'+cls,'sha256':digest})
    result['adaptations'].append('Endstone is collected in the End. Purple slime gel is TConstruct slime-island worldgen metadata 2, not a blood block. Rocket gates, collection rates and deployment costs are idle adaptations.')
    node('taintExpedition','污秽生物远征',r['taint'],20)
    node('orderShardMine','秩序水晶矿',r['orderShard'])
    node('eldritchGuardianHunt','邪术守卫狩猎',r['eldritchEye'],20,extra={'requiresAll':[research['infusion']],'dropRanges':{r['eldritchEye']:{'min':0,'max':1}},'dropProbabilities':{r['eldritchEye']:.025}})
    loot=json.loads((instance/'config/mobsinfo/MobRecipeLoader.cache').read_text(encoding='utf-8'))
    pearl=next(d for d in loot['moblist']['Thaumcraft.EldritchWarden'] if d['reconstructableStack']['itemIdentifier']=={'modId':'Thaumcraft','name':'ItemEldritchObject'} and d['reconstructableStack']['meta']==3)
    assert pearl['chance']==10000 and pearl['reconstructableStack']['size']==1
    node('eldritchWardenExpedition','邪术监护者远征',r['pearl'],60,extra={'requiresAll':[research['eldritch'],'advancedRocket']})
    cls='WayofTime/alchemicalWizardry/common/demonVillage/demonHoard/demon/EntityMinorDemonGrunt.class'
    with zipfile.ZipFile(instance/'mods/BloodMagic-1.9.16.jar') as z:digest=hashlib.sha256(z.read(cls)).hexdigest()
    if digest!='6da5cb945c2355ebabc2661c1fb676b905e848a7ff031fc7ce8543bf045bcb2f':raise ValueError('changed demon grunt drops')
    result['sources'].append({'file':'BloodMagic-1.9.16/'+cls,'sha256':digest})
    node('demonGruntExpedition','恶魔卫兵远征',r['lifeShard'],60,extra={
        'requiresAll':[research['demon']],'dropRanges':{r['lifeShard']:{'min':0,'max':1},r['soulShard']:{'min':0,'max':1}},
        'exclusiveDrops':[{'chance':.3,'items':{r['lifeShard']:1}},{'chance':.3,'items':{r['soulShard']:1}}]})
    node('elementalDemonExpedition','元素恶魔远征',r['demonBloodShard'],60,extra={'requiresAll':['bloodAltar5'],'dropRanges':{r['demonBloodShard']:{'min':0,'max':1}},'dropProbabilities':{r['demonBloodShard']:.5}})
    node('bloodSacrifice','祭坛献祭',magic['lifeEssence'],10,extra={'requiresAll':['bloodAltar5'],'dropRanges':{magic['lifeEssence']:{'min':1000,'max':1000}},'description':'祭坛采集生命本质，需要实体储罐'})
    # Canonical DE source, gated by a finished core and remote access; the
    # entire boss fight is represented by one repeatable expedition.
    source=root/'.local/gtnh-technology/Draconic-Evolution-1.5.35-GTNH/src/main/java/com/brandon3055/draconicevolution/common/blocks/ChaosCrystal.java'
    raw=source.read_text(encoding='utf-8')
    if 'guardianDefeated' not in raw or 'return ModItems.chaosShard;' not in raw or 'return 5;' not in raw:raise ValueError('changed chaos crystal')
    result['sources'].append({'file':'Draconic-Evolution-1.5.35-GTNH/ChaosCrystal.java','sha256':hashlib.sha256(source.read_bytes()).hexdigest()})
    catalog=json.loads((root/'src/data/technology-import.js').read_text(encoding='utf-8').split('=',1)[1].rstrip(';\n'))
    def registered(name):
        return next(id for id,i in catalog['items'].items() if i.get('nativeItem',{}).get('registry')=='DraconicEvolution:'+name and i['nativeItem'].get('meta',0)==0)
    shard=registered('chaosShard');core=registered('draconicCore')
    node('chaosGuardianExpedition','混沌守卫远征',shard,120,'advancedRocket',{'requiresAll':[core],'dropRanges':{shard:{'min':5,'max':5}}})
    result['adaptations'].extend([
      'End-shard hunts retain TT Enderman-in-End 1/32 chance. Source handler is the same pinned DimensionalShardDropHandler recorded for Nether shards.',
      'Magical sites expose actual soul sand, tainted goo, order shards and boss drops. Access notes, deployment, timing, LP yield and elemental-demon 50% encounter yield are idle adaptations. Ritual structures, player-health and combat are not simulated.',
      'Demon grunt drops retain the installed no-Looting distribution: 30% life shard, 30% soul shard, 40% neither; the two shards are mutually exclusive per encounter. Demon study and a physical blood altar gate access.',
      'Chaos expeditions represent defeating the guardian and mining its crystal (5 chaos shards). A draconic core and advanced rocket gate the repeatable encounter; combat difficulty, coordinates and duration are adapted, and no chaotic cores are granted directly.'
    ])
