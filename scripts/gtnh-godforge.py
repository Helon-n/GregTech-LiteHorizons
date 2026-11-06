"""Pinned Godforge upgrades and bounded array recipe expansion."""
import hashlib
import json
import re
import zipfile
import importlib.util
from collections import Counter


def generate(imp, root, split_args, matching, numeric):
    source=imp.source
    label='tectech/loader/recipe/Godforge.java'
    raw=(source/label).read_text(encoding='utf-8')
    lang={}
    for jar in sorted((imp.instance/'.minecraft/mods').glob('*.jar')):
        with zipfile.ZipFile(jar) as z:
            for name in ('assets/tectech/lang/en_US.lang','assets/tectech/lang/zh_CN.lang'):
                if name in z.namelist():
                    for row in z.read(name).decode('utf-8').splitlines():
                        if '=' in row and not row.startswith('#'):k,v=row.split('=',1);lang[k]=v
    imp.active_file=label;imp.constants={}
    arrays={}
    for m in re.finditer(r'(?:ItemStack|FluidStack)\[\]\s+(\w+)\s*=\s*\{',raw):
        end=raw.index('};',m.end())
        arrays[m[1]]=split_args(raw[m.end():end])
    for m in re.finditer(r'FluidStack\[\]\s+(\w+)\s*=\s*convertToFluid\((\w+)\)',raw):
        arrays[m[1]]=[re.sub(r'\.getDust\(1\)$','.getMolten(144)',v) if v.startswith('Materials.') else re.sub(r'\.getDust\(1\)$','.getFluidStack(144)',v) for v in arrays[m[2]]]
    resolved=set()
    for loop in re.finditer(r'for\s*\(int (\w+) = 0; \1 < (\w+)\.length; \1\+\+\)\s*\{',raw):
        var,key=loop[1],loop[2]
        if key not in arrays:continue
        start=loop.end()-1;depth=1;end=start+1
        while depth:
            depth+=(raw[end]=='{')-(raw[end]=='}');end+=1
        for build in re.finditer(r'GTValues\.RA\.stdBuilder\(\)',raw[start:end]):
            pos=start+build.end();body=raw[pos:raw.index(';',pos)]
            line=raw.count('\n',0,start+build.start())+1
            before=len(imp.recipes)
            for i in range(len(arrays[key])):
                try:
                    part=re.sub(r'(\w+)\['+var+r'\]',lambda m:arrays[m[1]][i],body)
                    imp.parse_builder(part,line,label)
                except (KeyError,IndexError):pass
            if len(imp.recipes)>before:resolved.add(line)
    # A source-generated second map converts EBF item outputs to fluids.
    # The original deliberately removes probability for converted fluid slots.
    for r in list(imp.existing['recipes'])+list(imp.recipes):
        if 'electricBlast' not in [r['process'],*r.get('alsoProcesses',[])]:continue
        outs={};converted={}
        for id,n in r['outputs'].items():
            item=imp.items[id];native=item.get('native',{});name=native.get('material');prefix=native.get('prefix')
            mat=imp.materials.get(name,{})
            if item['kind']!='fluid' and name and prefix and mat:
                amount={'ingot':144,'ingotHot':144,'dust':144,'dustSmall':36,'dustTiny':16,'nugget':16,'plate':144,'gem':144}.get(prefix)
                if amount and ('SMELTING_TO_FLUID' in mat.get('tags',[]) or mat.get('fluid')):
                    target=imp.material(name,'molten' if 'SMELTING_TO_FLUID' in mat.get('tags',[]) else 'fluid')
                    converted[id]=target;outs[target]=outs.get(target,0)+(amount if imp.items[target].get('native',{}).get('prefix')=='molten' else 1000)*n
                    continue
            outs[id]=outs.get(id,0)+n
        imp.active_file=label
        rolls=[dict(slot) for slot in r.get('outputRolls',[]) if slot['id'] not in converted]
        rolls.extend({'id':id,'count':n,'chance':10000} for id,n in outs.items() if imp.items[id]['kind']=='fluid')
        copy=imp.emit_recipe('godforgeMolten',dict(r['inputs']),outs,int(round(r['seconds']*20)),r['power'],843,dict(r.get('tools',{})),dict(r.get('requirements',{})),rolls,r.get('circuit'))
        if copy:copy['derivedFrom']=r['id']
    upgrade_label='tectech/thing/metaTileEntity/multi/godforge/upgrade/ForgeOfGodsUpgrade.java'
    upgrade_raw=(source/upgrade_label).read_text(encoding='utf-8');upgrades=[];used=set()
    for ordinal,m in enumerate(re.finditer(r'\b(\w+)\.build\(b -> b(.*?)\);',upgrade_raw,re.S)):
        code,body=m[1],m[2]
        prereq=re.search(r'\.prereqs\(([^)]+)\)',body);cost=re.search(r'\.cost\((\d+)\)',body)
        extra={};unresolved=[]
        cost_call=re.search(r'ForgeOfGodsUpgrade\.'+code+r'\.addExtraCost\(',raw[:raw.index('public static void runDevEnvironmentRecipes')])
        if cost_call:
            end=matching(raw,cost_call.end()-1)
            for arg in split_args(raw[cost_call.end():end]):
                try:
                    pair=imp.stack(arg)
                    if not pair:raise ValueError('empty cost stack')
                    id,n=pair;extra[id]=extra.get(id,0)+n;used.add(id)
                except (ValueError,KeyError,SyntaxError) as err:unresolved.append(str(err))
        # Names in the language file use enum ordinals (build order differs).
        enum=re.search(r'public enum ForgeOfGodsUpgrade\s*\{(.*?);',upgrade_raw,re.S)[1]
        order=re.findall(r'\b([A-Z][A-Z0-9]+)\b',enum)
        index=order.index(code)
        upgrades.append({'code':code,'name':re.sub(r'§.','',lang.get('fog.upgrade.tt.'+str(index),code)),
          'description':re.sub(r'§.','',lang.get('fog.upgrade.text.'+str(index),'')),
          'prerequisites':split_args(prereq[1]) if prereq else [],'all':'.requireAllPrereqs()' in body,
          'shards':int(cost[1]) if cost else 0,'cost':extra,'unresolved':unresolved})
    startup=imp.stack('getModItem(Avaritia.ID,"Resource",1,8)')[0]
    fuels=[imp.material('DTR'),imp.material('RawStarMatter'),imp.material('MHDCSM','molten')]
    used.update([startup,*fuels])
    shard=imp.material('GravitonShard','gem');used.add(shard)
    for code in ['Machine_Multi_ForgeOfGods','Machine_Multi_SmeltingModule','Machine_Multi_MoltenModule','Machine_Multi_PlasmaModule']:
        used.add(imp.stack('CustomItemList.'+code+'.get(1)')[0])
    # Collapse the actual structure into material costs for the 2D placement.
    # Hatch positions use their source fallback casing; modules stay separate.
    costs={};glyphs=dict(zip('BCDEFGIK',['Godforge_SingularityShieldingCasing','Godforge_GuidanceCasing','Godforge_BoundlessStructureCasing','Godforge_MagneticConfinementCasing','Godforge_StellarEnergySiphonCasing','Godforge_GravitonFlowModulatorTier1','Godforge_GravitonFlowModulatorTier3','Godforge_GravitonFlowModulatorTier2']))
    for file,fields in [('ForgeOfGodsStructureString.java',['BEAM_SHAFT','FIRST_RING']),('ForgeOfGodsRingsStructureString.java',['SECOND_RING','THIRD_RING'])]:
        text=(source/'tectech/thing/metaTileEntity/multi/godforge/structure'/file).read_text(encoding='utf-8')
        for field in fields:
            start=text.index(' '+field+' =');end=text.index(';',start)
            chars=Counter(''.join(re.findall(r'"([ A-Z~]+)"',text[start:end])))
            cost={}
            for glyph,name in glyphs.items():
                n=chars[glyph]+(chars['J'] if glyph=='B' else chars['A'] if glyph=='E' else 0)
                if n:
                    id=imp.stack('CustomItemList.'+name+'.get(1)')[0];cost[id]=n;used.add(id)
            if chars['H']:
                id='godforgeLens';imp.items[id]={'id':id,'name':'空间超越引力透镜','kind':'item','category':'结构',
                  'nativeItem':{'registry':'tectech:spatiallyTranscendentGravitationalLens','meta':0,'texture':'assets/tectech/textures/blocks/blockSpatiallyTranscendentGravitationalLens.png'}}
                cost[id]=chars['H'];used.add(id)
            costs[field]=cost
    data={'startup':startup,'shard':shard,'fuels':fuels,'upgrades':upgrades,'structures':costs,'source':label,
      'hashes':{label:hashlib.sha256(raw.encode()).hexdigest(),upgrade_label:hashlib.sha256(upgrade_raw.encode()).hexdigest()}}
    exotic_spec=importlib.util.spec_from_file_location('exotic_data',root/'scripts/gtnh-exotic.py')
    exotic=importlib.util.module_from_spec(exotic_spec);exotic_spec.loader.exec_module(exotic)
    data['exotic']=exotic.extract(imp,raw,split_args,matching,numeric,used)
    for path in sorted((source/'tectech/thing/metaTileEntity/multi/godforge').rglob('*.java')):
        name=str(path.relative_to(source)).replace('\\','/');digest=hashlib.sha256(path.read_bytes()).hexdigest()
        data['hashes'][name]=digest;imp.paths[name]=digest
    (root/'src/data/godforge-reference.js').write_text('// Generated by scripts/gtnh-godforge.py.\nexport const GODFORGE_REFERENCE='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    imp.skipped=[row for row in imp.skipped if not (row.get('file')==label and row.get('line') in resolved)]
    return used
