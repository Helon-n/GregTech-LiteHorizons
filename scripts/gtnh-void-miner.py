"""Source-backed void miners; dimension access is never granted by chapter.

Host stone variants are collapsed to the catalog's ore representative. This is
not a final registry snapshot; additional runtime drop registrations stay out.
"""
from collections import Counter, defaultdict
import hashlib
import json
import re


def generate(imp, root, split, numeric):
    used=set();hashes={}
    def read(label):
        path=imp.source/label;raw=path.read_text(encoding='utf-8')
        hashes[label]=imp.paths[label]=hashlib.sha256(path.read_bytes()).hexdigest()
        return re.sub(r'/\*.*?\*/|//[^\n]*',lambda m:'\n'*m[0].count('\n'),raw,flags=re.S)
    source='bwcrossmod/galacticgreg/'
    logic=read(source+'MTEVoidMinerBase.java');structure=read(source+'MTEVoidMiners.java')
    utility=read(source+'VoidMinerUtility.java');read(source+'VoidMinerLoader.java')
    for adapter in ('GT','BW','GTPP'):read('gregtech/common/ores/'+adapter+'OreAdapter.java')
    read('bartworks/common/configs/Configuration.java')
    read('gregtech/common/config/Gregtech.java')
    config=imp.instance/'.minecraft/config/GregTech/GregTech.cfg'
    cfg=config.read_text(encoding='utf-8');hashes['instance/config/GregTech/GregTech.cfg']=imp.paths['instance/config/GregTech/GregTech.cfg']=hashlib.sha256(config.read_bytes()).hexdigest()
    weights={}
    for family in ('GT','BW','GT++'):
        match=re.search(r'S:"Deep Dark '+re.escape(family)+r' Ore Weights"\s*<([^>]+)>',cfg)
        if match is None:raise ValueError('missing void miner weight config '+family)
        weights[family]={}
        for line in match[1].splitlines():
            line=line.strip()
            if not line:continue
            key,value=line.rsplit(':',1);weights[family][key.strip()]=float(value.strip())
    bw=imp.instance/'.minecraft/config/bartworks.cfg'
    raw=bw.read_text(encoding='utf-8');hashes['instance/config/bartworks.cfg']=imp.paths['instance/config/bartworks.cfg']=hashlib.sha256(bw.read_bytes()).hexdigest()
    blacklist=re.search(r'S:voidMinerBlacklist\s*<([^>]+)>',raw)
    if blacklist and blacklist[1].strip():raise ValueError('nonempty void miner blacklist needs exact host-stone mapping')
    if not all(s in logic for s in ('RECIPE_DURATION_TICKS = 10','BATCH_MULTIPLIER = 16','MIN_TIER_OFFSET = 5')):raise ValueError('changed void miner algorithm')
    dim=read('galacticgreg/api/enums/DimensionDef.java');mix=read('gregtech/api/enums/OreMixes.java');small=read('gregtech/api/enums/SmallOres.java')
    aliases={};disabled=set()
    declarations=list(re.finditer(r'^    (\w+)\(new ModDimensionDef\(\s*DimNames\.(\w+)',dim,re.M))
    for i,m in enumerate(declarations):
        aliases[m[1]]=m[2]
        if '.disableVoidMining()' in dim[m.start():declarations[i+1].start() if i+1<len(declarations) else len(dim)]:disabled.add(m[2])
    def canon(s):return aliases.get(s.strip().split('.')[-1],s.strip().split('.')[-1])
    def material(s):
        if s.startswith('Materials.'):return s.split('.')[-1]
        return imp.addon_materials.get(s) or imp.gtpp_materials.get(s)
    drops=defaultdict(lambda:defaultdict(float))
    for text,builder,fields,weight in [(mix,'OreMixBuilder',['primary','secondary','inBetween','sporadic'],'weight'),(small,'SmallOreBuilder',['ore'],'amount')]:
        for m in re.finditer(r'^    \w+\(new '+builder+r'\(\)',text,re.M):
            end=text.find(')),',m.start())
            if end<0:end=text.find('));',m.start())
            body=text[m.start():end+1]
            worlds=[canon(v) for args in re.findall(r'\.enableInDim\((.*?)\)',body,re.S) for v in split(args)]
            w=float(re.search(r'\.'+weight+r'\((\d+)\)',body)[1])
            for i,field in enumerate(fields):
                key=material(re.search(r'\.'+field+r'\(\s*([\w.]+)\s*\)',body)[1])
                if not key:raise ValueError('unknown void ore '+body[:80])
                id=imp.material(key,'ore')
                for world in worlds:
                    if world not in disabled:drops[world][id]+=w/(8 if i>=2 else 1)
    for key,m in imp.materials.items():
        if not m['ore']:continue
        family='GT++' if key.startswith('GTPP_') else 'BW' if key in imp.addon_materials.values() else 'GT'
        names=[key,m['registry'],re.sub(r'[^A-Za-z0-9]','',m['name'])]
        w=next((weights[family][n] for n in names if n in weights[family]),1)
        if w>0:drops['DEEPDARK'][imp.material(key,'ore')]+=w
    for world,key,weight in re.findall(r'addMaterialToDimensionList\(DimNames\.(\w+), Materials\.(\w+), ([\d.]+)f\)',utility):
        drops[world][imp.material(key,'ore')]+=float(weight)
    imp.constants={}
    casings=read('gregtech/api/casing/Casings.java')
    bw_reference=read('bartworks/system/material/BWGTMaterialReference.java')
    bw_loader=read('bartworks/system/material/WerkstoffLoader.java')
    casing_loader=read('bartworks/system/material/werkstoff_loaders/recipe/CasingLoader.java')
    read('bartworks/client/textures/PrefixTextureLinker.java')
    bw_materials={int(numeric(expr)):name for name,expr in re.findall(r'new Werkstoff\(\s*Materials\.(\w+),\s*ADD_CASINGS_ONLY,\s*Werkstoff.Types.\w+,\s*([^\)]+)\)',bw_reference)}
    bw_registries={key:value for key,value in re.findall(r'GameRegistry.registerBlock\(\s*WerkstoffLoader\.(BWBlockCasings(?:Advanced)?),\s*BWItemMetaGeneratedBlock.class,\s*"([^"]+)"',bw_loader)}
    casing_recipes=set()
    def casing(key):
        bw=re.search(r'\b'+key+r'\s*\(\(\) -> WerkstoffLoader\.BWBlockCasings(Advanced)?,\s*(\d+),',casings)
        if bw:
            meta=int(bw[2]);material=imp.addon_meta.get(meta) or bw_materials[meta]
            advanced=bool(bw[1]);id=imp.material(material,'blockCasingAdvanced' if advanced else 'blockCasing')
            registry=bw_registries['BWBlockCasings'+('Advanced' if advanced else '')]
            prefix='blockCasingAdvanced' if advanced else 'blockCasing';mat=imp.materials[material]
            imp.items[id]['nativeItem']={'registry':imp.mod_ids['BartWorks']+':'+registry,'meta':meta,
                'texture':'assets/gregtech/textures/blocks/materialicons/'+mat['texture']+'/'+prefix+'.png','color':mat['color']}
            if id not in casing_recipes:
                casing_recipes.add(id)
                plate=imp.material(material,'plateDouble' if advanced else 'plate');screw=imp.material(material,'screw');gear=imp.material(material,'gearGt' if advanced else 'gearGtSmall')
                imp.active_file='bartworks/system/material/werkstoff_loaders/recipe/CasingLoader.java'
                line=casing_loader.count('\n',0,casing_loader.index('werkstoff.get(blockCasingAdvanced)' if advanced else 'werkstoff.get(blockCasing),'))+1
                r=imp.emit_recipe('craft',{plate:6,screw:2,gear:1},{id:1},1,0,line,{}, {},[],None)
                if r:r.update(grid=[plate,screw,plate,plate,gear,plate,plate,screw,plate],craftingSource='shaped',durationAdapted=True)
            return id
        m=re.search(r'\b'+key+r'\s*\(\(\) -> GregTechAPI\.sBlockCasings(\d+),\s*(\d+),',casings)
        if not m:raise ValueError('unknown void miner casing '+key)
        registry='gregtech:gt.blockcasings'+m[1];meta=int(m[2])
        item=next((k for k,v in imp.itemlist.items() if v['registry']==registry and v['meta']==meta),None)
        if not item:raise ValueError('unregistered void miner casing '+key)
        return imp.named(item)
    machines=[]
    for i,cls in enumerate(('VMLUV','VMZPM','VMUV'),1):
        start=structure.index('public static class '+cls)
        end=structure.find('public static class ',start+1);body=structure[start:end if end>=0 else len(structure)]
        shape=body[body.index('new String[][]'):body.index('.addElement')]
        counts=Counter(''.join(re.findall(r'"([ A-F~]+)"',shape)))
        cost={imp.stack('LanthItemList.VoidMiner'+str(i-1)+'.get(1)')[0]:1}
        for letter,key in re.findall(r"\.addElement\('([A-F])', Casings\.(\w+)\.asElement\(\)\)",body):
            id=casing(key);cost[id]=cost.get(id,0)+counts[letter]
        for letter,key in re.findall(r"\.addElement\('([A-F])', ofFrame\(Materials\.(\w+)\)\)",body):
            id=imp.material(key,'frameGt');cost[id]=cost.get(id,0)+counts[letter]
        hatch=re.search(r"\.addElement\(\s*'([A-F])',\s*buildHatchAdder.*?buildAndChain\(Casings\.(\w+)\.asElement",body,re.S)
        if not hatch:raise ValueError('missing void miner hatch structure')
        id=casing(hatch[2]);cost[id]=cost.get(id,0)+counts[hatch[1]]-5
        code=('LuV','ZPM','UV')[i-1]
        for key in ('Hatch_Energy_'+code,'Hatch_Input_'+code,'Hatch_Output_Bus_'+code,'Hatch_Input_Bus_'+code,'Hatch_Maintenance'):
            id=imp.named(key);cost[id]=cost.get(id,0)+1
        machines.append({'tier':i,'code':code,'cost':cost,'controller':next(iter(cost))})
        used.update(cost)
    gases=[(None,1)]+[(imp.stack('WerkstoffLoader.'+key+'.getFluidOrGas(1)')[0],boost) for key,boost in [('Neon',4),('Krypton',8),('Xenon',16),('Oganesson',64)]]
    # This is the pre-existing idle game's deployment vehicle, not a claimed
    # native Galacticraft rocket identity or a free dimension unlock.
    imp.items.setdefault('advancedRocket',{'id':'advancedRocket','name':'深空火箭','kind':'item','category':'元件','icon':'advancedRocket'})
    portal=imp.stack('getModItem(ExtraUtilities.ID,"dark_portal",1,0)')[0];used.add(portal)
    for world,pool in sorted(drops.items()):
        if not pool:continue
        tools={portal:1} if world=='DEEPDARK' else {} if world in ('OW','NETHER','THE_END','TWILIGHT_FOREST','EVERGLADES') else {'advancedRocket':1}
        for m in machines:
            tier=m['tier'];power=[30720,122880,491520][tier-1]
            for gas,boost in gases:
                for batch in (1,16):
                    imp.active_file=source+'MTEVoidMinerBase.java'
                    outputs={id:tier*boost*batch for id in pool}
                    r=imp.emit_recipe('voidMine'+str(tier),{gas:batch} if gas else {},outputs,10*batch,power,150,tools,{},[],None)
                    if r:
                        r.update(name=world+' · '+m['code']+' 虚空采矿'+(' · '+imp.items[gas]['name'] if gas else '')+(' · 16 批' if batch>1 else ''),fixedRuntime=True,randomChoice={'weights':dict(pool),'count':tier*boost,'rolls':batch},voidMining=True)
    result={'machines':machines,'hashes':hashes,'deepDarkPortal':portal,'dimensions':sorted(drops),
      'adaptation':'Recipes select deployment world and gas explicitly. Nonlocal worlds require an advanced rocket; Deep Dark requires its real portal, whose Thaumcraft research/infusion is not yet implemented. Host-stone ores use catalog representatives. No coordinate deployment, maintenance failures, input-bus whitelist/blacklist, or runtime extra drop registrations. A missing selected gas pauses; select the no-gas recipe to run without boost.'}
    (root/'src/data/void-miner-reference.js').write_text('// Generated by scripts/gtnh-void-miner.py.\nexport const VOID_MINER_REFERENCE='+json.dumps(result,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    return used
