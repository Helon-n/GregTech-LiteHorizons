"""Expand EOH dimension mining from the pinned ore tables and EOH algorithms.

The idle machine has one operation in flight. Wireless credit is replaced by
physical energy charging and a separately metered return to a battery box.
"""
from collections import defaultdict, deque
import hashlib
import json
import re


def generate(imp, root, split, matching, numeric):
    used=set(); hashes={}
    def read(label):
        text=(imp.source/label).read_text(encoding='utf-8')
        hashes[label]=imp.paths[label]=hashlib.sha256(text.encode()).hexdigest()
        return re.sub(r'/\*.*?\*/|//[^\n]*',lambda m:'\n'*m[0].count('\n'),text,flags=re.S)
    ore=read('gregtech/api/enums/OreMixes.java');small=read('gregtech/api/enums/SmallOres.java')
    dim=read('galacticgreg/api/enums/DimensionDef.java')
    helper=read('gtneioreplugin/util/DimensionHelper.java')
    recipe=read('tectech/recipe/EyeOfHarmonyRecipe.java')
    read('tectech/recipe/EyeOfHarmonyRecipeStorage.java')
    read('tectech/thing/metaTileEntity/multi/MTEEyeOfHarmony.java')
    aliases=dict(re.findall(r'\b(\w+)\(new ModDimensionDef\(\s*DimNames\.(\w+)',dim))
    def canon(s):
        s=s.strip().removeprefix('DimensionDef.').removeprefix('DimNames.')
        return aliases.get(s,s)
    def mat(expr):
        if expr.startswith('Materials.'):return expr.split('.')[-1]
        if expr in imp.addon_materials:return imp.addon_materials[expr]
        if expr in imp.gtpp_materials:return imp.gtpp_materials[expr]
        raise ValueError('unknown EOH ore '+expr)
    veins=defaultdict(list);spots=defaultdict(list)
    for source,builder,target in [(ore,'OreMixBuilder',veins),(small,'SmallOreBuilder',spots)]:
        for m in re.finditer(r'^    \w+\(new '+builder+r'\(\)',source,re.M):
            end=source.find(')),',m.start())
            if end<0:end=source.find('));',m.start())
            body=source[m.start():end+1]
            dims=[canon(v) for ds in re.findall(r'\.enableInDim\((.*?)\)',body,re.S) for v in split(ds)]
            weight=re.search(r'\.'+('weight' if builder=='OreMixBuilder' else 'amount')+r'\((\d+)\)',body)
            if not weight:raise ValueError('missing EOH ore weight')
            materials=[mat(re.search(r'\.'+field+r'\(\s*([\w.]+)\s*\)',body)[1]) for field in (['primary','secondary','inBetween','sporadic'] if builder=='OreMixBuilder' else ['ore'])]
            for name in dims:target[name].append((int(weight[1]),materials))

    def direct(key):return imp.materials[key]['smelting']
    def solid(key):return imp.gtpp_states.get(key,'SOLID').removeprefix('MaterialState.') not in ('GAS','LIQUID','PURE_GAS','PURE_LIQUID','PLASMA')
    def process(out,key,scale):
        m=imp.materials[key]
        def add(k,n):out[k]+=scale*n
        if key.startswith('GTPP_'):
            add(key,2)
            pending=deque([key]);leaves=[];limit=0
            while pending and limit<1000:
                k=pending.popleft();limit+=1;components=imp.materials[k]['components']
                if components:pending.extend(c for c,n in components)
                else:leaves.append(k)
            while len(leaves)<3:leaves.append(key)
            bonuses=[k for k in leaves if solid(k)][:2]
            components=[k for k,n in m['components']]
            if len(bonuses)<2:
                a=components[0] if components else key
                b=next((k for k in components[1:5] if solid(k)),key)
                bonuses=[a,b]
            for k,n in zip(bonuses,[2*(2/9+.1),2/9]):add(k if solid(k) else 'Stone',n)
            return
        add(direct(key),m['oreMultiplier']*2)
        for tag,material in [('ELECTROMAGNETIC_SEPERATION_GOLD','Gold'),('ELECTROMAGNETIC_SEPERATION_IRON','Iron'),('ELECTROMAGNETIC_SEPERATION_NEODYMIUM','Neodymium')]:
            if tag in m['tags']:add(material,2*(.4/4+.2/9))
        def wash(k):
            tags=imp.materials[k]['tags']
            return .99 if 'WASHING_MERCURY_99_PERCENT' in tags else .7 if {'WASHING_MERCURY','WASHING_SODIUMPERSULFATE'}&set(tags) else 0
        add(direct(key),wash(key)*2*(2 if not m['byproducts'] else 1))
        index=0
        for by in m['byproducts']:
            if index<3:add(direct(by),[.1+1/9,1/9,.1][index]*2)
            if by==key:continue
            if wash(by) or index>=3:add(direct(by),(wash(by) or .7)*2)
            index+=1
        for i in range(index,3):
            by=m['byproducts'][min(i,len(m['byproducts'])-1)] if m['byproducts'] else m['macerating']
            add(direct(by),[.1+1/9,1/9,.1][i]*2)

    imp.constants={};controller=imp.stack('CustomItemList.Machine_Multi_EyeOfHarmony.get(1)')[0]
    structure={controller:1}
    for key,n in [('EOH_Reinforced_Spatial_Casing',896),('EOH_Reinforced_Temporal_Casing',534),('EOH_Infinite_Energy_Casing',31)]:
        structure[imp.stack('CustomItemList.'+key+'.get(1)')[0]]=n
    fields={}
    for kind,prefix,count in [('time','TimeAccelerationFieldGeneratorTier',168),('space','SpacetimeCompressionFieldGeneratorTier',138),('stability','StabilisationFieldGeneratorTier',48)]:
        fields[kind]={'count':count,'items':[imp.stack('CustomItemList.'+prefix+str(n)+'.get(1)')[0] for n in range(9)]}
    valid=set(re.findall(r'Materials\.(\w+)',recipe[recipe.index('VALID_PLASMAS = Stream'):recipe.index('.toList()',recipe.index('VALID_PLASMAS = Stream'))]))
    fuel={f['id']:f['eu'] for f in [*imp.existing['fuels'],*imp.extra_fuels] if f['family']=='Plasma'}
    for f in imp.fuels if hasattr(imp,'fuels') else []:
        if f.get('family')=='Plasma':fuel.setdefault(f['id'],f['eu'])
    # All EOH plasma costs use the registered FuelLoader value, including its
    # deliberate 3.85 multiplication both before and after summation.
    for m in re.finditer(r'new FluidStackLong\(Materials\.(\w+)\.getMolten\(([\d_]+)\)',recipe):used.add(imp.material(m[1],'molten'))
    dimensions=[]
    specials=[('WhiteDwarfMatter',1152),('WhiteDwarfMatter',1152),('WhiteDwarfMatter',4608),('WhiteDwarfMatter',18432),('BlackDwarfMatter',1152),('BlackDwarfMatter',4608),('BlackDwarfMatter',18432),('Universium',1152),('Universium',4608),('Universium',18432)]
    for internal,abbr,tier in re.findall(r'register\(\s*"[^"]+",\s*(\w+),\s*"[^"]+",\s*"([^"]+)",\s*T(\d+),',helper):
        tier=int(tier)
        deep=internal=='DEEPDARK'
        if deep:tier=9
        if not deep and not veins[internal] and not spots[internal]:continue
        seconds=int(18000*1.4**tier);required=min(8,max(1,tier)-1);rt=9 if deep else max(1,tier)-1
        mined=defaultdict(float)
        if deep:
            known={k for source in (veins,spots) for records in source.values() for w,materials in records for k in materials}|{k for k,m in imp.materials.items() if m['ore']}
            gt=[k for k in known if not k.startswith('GTPP_')];gtpp=[k for k in known if k.startswith('GTPP_')]
            for k in [*gt,*gtpp]:process(mined,k,int(18000*1.4**10)*384/len(gt))
        for source in (() if deep else (veins[internal],spots[internal])):
            total=sum(w for w,mats in source)
            for weight,mats in source:
                for i,k in enumerate(mats):process(mined,k,seconds*384*weight/total/(8 if i>=2 else 1))
        outputs={}
        for k,n in mined.items():
            if imp.materials[k]['dust']:
                id=imp.material(k,'dust');outputs[id]=outputs.get(id,0)+int(n)
        count=sum(outputs.values())
        stone={'Ne':'Netherrack','ED':'Endstone','EA':'Endstone'}.get(abbr,'Stone')
        stone_native=next((m[2] for m in re.finditer(r'case ([^;]+?) -> getModItem\(NewHorizonsCoreMod.ID, "([^"]+)"',recipe) if '"'+abbr+'"' in m[1]),None)
        stone_item=imp.stack('getModItem(NewHorizonsCoreMod.ID,"'+stone_native+'",1)')[0] if stone_native else imp.material(stone,'dust');outputs[stone_item]=outputs.get(stone_item,0)+count*3
        plasmas={imp.material(k,'plasma'):(required+1)*8000000 for k in (valid if deep else mined) if k in valid}
        outputs.update(plasmas);outputs[imp.material('RawStarMatter','fluid')]=(required+1)*100000
        sk,amount=specials[0 if rt==0 else 9 if rt==9 else rt+1];outputs[imp.material(sk,'molten')]=amount
        plasma_eu=int(sum(int(fuel[id]*3.85)*n for id,n in plasmas.items())*3.85)
        start=plasma_eu+seconds*2**19*20+100000000000*20*seconds
        trigger='eohDimension_'+abbr
        imp.items[trigger]={'id':trigger,'name':abbr+' 维度显示方块','kind':'item','category':'维度',
           'nativeItem':{'registry':'gtneioreplugin:blockDimensionDisplay_'+abbr,'meta':0,'texture':'assets/gtneioreplugin/textures/blocks/'+abbr+'_front.png'}}
        imp.active_file='tectech/recipe/EyeOfHarmonyRecipeStorage.java'
        r=imp.emit_recipe('eyeOfHarmony',{'hydrogen':1000000000*(tier+1),'helium':1000000000*(tier+1)},outputs,seconds*20,0,86,{trigger:1},{'eohSpace':required},[],None)
        if r:
            r.update(name=abbr+' 维度演化',eoh={'rocketTier':rt,'chance':1-.05*tier,'inputEU':str(start),'outputEU':str(int(start*(.6+tier/10)))},fixedRuntime=True)
        used.add(trigger);dimensions.append({'id':trigger,'abbr':abbr,'tier':tier})
    used.add(imp.material('SpaceTime','molten'))
    result={'controller':controller,'structure':structure,'fields':fields,'dimensions':dimensions,'hashes':hashes,
            'adaptation':'One operation at a time; exact-dose gas input; physical energy charged before startup and returned through a metered battery output. Spatial routing and wireless EU are not simulated.'}
    used|=set(structure)|{id for f in fields.values() for id in f['items']}
    (root/'src/data/eoh-reference.js').write_text('// Generated by scripts/gtnh-eoh.py.\nexport const EOH_REFERENCE='+json.dumps(result,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    return used
