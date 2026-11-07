"""World samples checked against the installed jars, never dimension triggers.

Only exact registry/meta pairs present in the imported recipe catalog are
exposed. Remote access, deployment and yields remain explicit idle adaptations.
"""
import hashlib
import json
import re


def generate(root, instance, result):
    catalog=json.loads((root/'src/data/technology-import.js').read_text(encoding='utf-8').split('=',1)[1].rstrip(';\n'))
    identities={(v.get('nativeItem',{}).get('registry'),v.get('nativeItem',{}).get('meta',0)):k for k,v in catalog['items'].items()}
    seen={n['output'] for n in result['nodes']}
    def read(path):
        result['sources'].append({'file':str(path.relative_to(root/'.local/gtnh-technology')).replace('\\','/'),
            'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
        return path.read_text(encoding='utf-8')
    def node(registry,meta,place):
        id=identities.get((registry,meta))
        if not id or id in seen:return
        seen.add(id)
        result['nodes'].append({'id':'worldSample_'+id,'name':place+' · 地表样本 '+str(meta),
            'output':id,'stage':8,'requires':'advancedRocket','amount':2,'seconds':12,
            'description':'远征收集实体样本，用于材料加工或维度环境构建',
            'cost':{'tungstensteelPlate':12,'motor':2},'dropRanges':{id:{'min':1,'max':3}}})
    for name in ('GalaxySpace-1.1.144-GTNH.jar','AmunRa-GC-0.8.14.jar'):
        path=instance/'mods'/name
        if not path.exists():
            matches=list((instance/'mods').glob('AmunRa*')) if name.startswith('AmunRa') else []
            if len(matches)!=1:raise ValueError('missing world source jar '+name)
            path=matches[0]
        result['sources'].append({'file':'mods/'+path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    gs=root/'.local/gtnh-technology/GalaxySpace-1.1.144/galaxyspace'
    blocks={}
    for label in ('core/register/GSBlocks.java','BarnardsSystem/BRBlocks.java','VegaSystem/VegaBlocks.java','TCetiSystem/TCetiBlocks.java','ACentauriSystem/ACBlocks.java'):
        path=gs/label;text=read(path)
        for field,registry in re.findall(r'GameRegistry\.registerBlock\(\(Block\)(\w+),[^;]*?\(String\)"([^"]+)"\)',text):
            blocks[path.stem+'.'+field]='GalaxySpace:'+registry
    for path in sorted(gs.rglob('ChunkProvider*.java')):
        text=read(path)
        for field,meta in re.findall(r'return new BlockMetaPair\(((?:GSBlocks|BRBlocks|VegaBlocks|TCetiBlocks|ACBlocks)\.\w+), (\d+)\);',text):
            if field not in blocks:raise ValueError('unknown world block '+field)
            node(blocks[field],int(meta),path.stem.removeprefix('ChunkProvider'))
    # Pluto's biome top layers are 0/1/2/3 and filler 4; dungeon brick 6
    # is deliberately excluded from natural surface gathering.
    text=read(gs/'SolarSystem/planets/pluto/world/BiomeGenPluto.java')
    if not all(s in text for s in ('this.field_76752_A = GSBlocks.PlutoBlocks','this.field_76753_B = GSBlocks.PlutoBlocks','this.fillerMeta = (byte)4','PLUTO_2.topMeta = 1','PLUTO_3.topMeta = (byte)2','PLUTO_4.topMeta = (byte)3')):
        raise ValueError('changed Pluto biome layers')
    for meta in range(5):node('GalaxySpace:plutoblocks',meta,'Pluto')
    ar=root/'.local/gtnh-technology/AmunRa-GC-0.8.14/de/katzenpapst/amunra'
    text=read(ar/'block/ARBlocks.java');decorator=read(ar/'world/maahes/MaahesBiomeDecorator.java');tree=read(ar/'block/bush/PodSapling.java')
    if not all(s in text for s in ('new BlockBasicMeta("wood1"','blockPodLeaf = metaBlockNonRotational.addSubBlock(1','setLeaves(blockPodLeaf)')) or 'WorldGenTreeBySapling(false, 5, ARBlocks.blockPodSapling)' not in decorator or 'this.leaves.getMetadata()' not in tree:
        raise ValueError('changed Maahes lumipod world source')
    node('GalacticraftAmunRa:tile.wood1',1,'Maahes 光荚林')
    result['adaptations'].append('Planet samples use exact installed GalaxySpace terrain registry/meta pairs and Maahes lumipod leaves from AmunRa world generation. Access uses the idle advanced rocket; deployment, 12-second duration and 1–3 sample yields are adaptations. These sites never grant dimension display blocks, research data, finished materials or unverified decorative subtypes. Pluto dungeon bricks are not surface samples.')
