"""Read Exo-Foundry structure and module construction bills, not fake recipes."""
import hashlib
import json
import re
from collections import Counter


def generate(imp, root, split_args, matching, numeric):
    def read(label):
        p=imp.source/label
        imp.paths[label]=hashlib.sha256(p.read_bytes()).hexdigest()
        return p.read_text(encoding='utf-8')
    directory='gregtech/common/tileentities/machines/multi/foundry/'
    text=read(directory+'MTEExoFoundry.java')
    module_text=read(directory+'FoundryModule.java')
    stats=read(directory+'FoundryData.java')
    label='gregtech/loaders/postload/FoundryFakeModuleCostLoader.java'
    costs=read(label)
    costs=re.sub(r'//[^\n]*|/\*.*?\*/','',costs,flags=re.S)
    imp.constants={};imp.active_file=label
    modules=[]
    titles={'EXTRA_CASTING_BASINS':'额外铸造盆','UNIVERSAL_COLLAPSER':'通用坍缩器','POWER_EFFICIENT_SUBSYSTEMS':'节能子系统','EFFICIENT_OC':'高效超频','STREAMLINED_CASTERS':'流线型铸造器','HELIOCAST_REINFORCEMENT':'日铸强化','HYPERCOOLER':'超级冷却器'}
    chassis=[imp.stack(f'ItemList.Magnetic_Chassis_T{n}_ExoFoundry.get(1)')[0] for n in range(1,4)]
    for match in re.finditer(r'GTValues\.RA\.stdBuilder\(\)',costs):
        end=costs.index('.addTo(RecipeMaps.foundryFakeModuleCostRecipes)',match.end())
        body=costs[match.end():end]
        key=re.search(r'FoundryModule\.(\w+)',body)[1]
        start=body.index('.itemInputs(')+len('.itemInputs(')
        expressions=split_args(body[start:matching(body,start-1)])
        bill={};chassis_count=0
        for expr in expressions:
            if 'exoFoundryCasingChassis' in expr:
                chassis_count=int(re.search(r',\s*(\d+)',expr)[1]);continue
            id,n=imp.stack(expr);bill[id]=bill.get(id,0)+n
        start=body.index('.itemOutputs(')+len('.itemOutputs(')
        icon=imp.stack(body[start:matching(body,start-1)])[0]
        modules.append({'code':key,'name':titles[key],'icon':icon,'cost':bill,'chassis':chassis_count,'unique':key in ('HYPERCOOLER','UNIVERSAL_COLLAPSER','EFFICIENT_OC')})
    if len(modules)!=7:raise ValueError('changed foundry module count')
    sheet=read('gregtech/common/blocks/BlockSheetMetal.java')
    casing=read('bartworks/system/material/werkstoff_loaders/recipe/CasingLoader.java')
    if not all(s in sheet for s in ('OrePrefixes.plate, 2','getIntegratedCircuit(11)','TierEU.RECIPE_LV','.duration(10)')):raise ValueError('changed sheetmetal recipe')
    if not all(s in casing for s in ('"PSP", "PGP", "PSP"','werkstoff.get(plate)','addCasingRecipes(werkstoff, plateDouble)')):raise ValueError('changed bolted casing recipe')
    for id,item in list(imp.items.items()):
        native=item.get('native',{});form=native.get('prefix');material=native.get('material')
        if form=='sheetmetal':
            imp.active_file='gregtech/common/blocks/BlockSheetMetal.java'
            imp.emit_recipe('bend',{imp.material(material,'plate'):2},{id:1},10,30,160,{}, {},[],11)
        elif form in ('blockCasing','blockCasingAdvanced') and material in imp.addon_meta.values():
            advanced=form=='blockCasingAdvanced';plate=imp.material(material,'plateDouble' if advanced else 'plate');screw=imp.material(material,'screw');gear=imp.material(material,'gearGt' if advanced else 'gearGtSmall')
            imp.active_file='bartworks/system/material/werkstoff_loaders/recipe/CasingLoader.java'
            r=imp.emit_recipe('craft',{plate:6,screw:2,gear:1},{id:1},1,0,66 if advanced else 53,{}, {},[],None)
            if r:r.update(grid=[plate,screw,plate,plate,gear,plate,plate,screw,plate],craftingSource='shaped',durationAdapted=True)
    shape=text[text.index('new String[][]'):text.index(".addElement('A'")]
    counts=Counter(''.join(re.findall(r'"([ AB CDEFGH~]+)"',shape)))
    if counts['H']!=488:raise ValueError('changed main foundry shape')
    mapping={'A':'Glass_ExoFoundry','B':'Casing_HeatingCoil_UEV','C':'Central_Casing_ExoFoundry','E':'Secondary_Casing_ExoFoundry','H':'Primary_Casing_ExoFoundry'}
    # Resolve the actual sBlockCasings11:7 item instead of assuming its name.
    casing_text=read('gregtech/common/blocks/BlockCasings11.java')
    m=re.search(r'register\(7, ItemList\.(\w+)\)',casing_text)
    if not m:raise ValueError('missing foundry heating casing registration')
    mapping['B']=m[1]
    main={imp.stack(f'ItemList.{key}.get(1)')[0]:counts[char]-(5 if char=='H' else 0) for char,key in mapping.items()}
    main[imp.material('Netherite','frameGt')]=counts['D']
    controller=imp.stack('ItemList.Machine_Multi_ExoFoundry.get(1)')[0];main[controller]=1
    for key in ['Hatch_Input_LV','Hatch_Input_Bus_LV','Hatch_Output_Bus_LV','Hatch_Maintenance']:
        main[imp.stack('ItemList.'+key+'.get(1)')[0]]=1
    coolants=[]
    for material,oc,amount in re.findall(r'new CoolingFluid\(Materials\.(\w+), (\d+), (\d+)\)',text):
        coolants.append({'item':imp.material(material,'fluid' if material=='SuperCoolant' else 'molten'),'oc':int(oc),'amount':int(amount)})
    if len(coolants)!=3:raise ValueError('changed foundry coolants')
    result={'controller':controller,'main':main,'chassis':chassis,'chassisCount':counts['F'],'modules':modules,'coolants':coolants,
        'parallel':numeric(re.search(r'parallelScaleBase = ([^;]+)',stats)[1]),'speed':numeric(re.search(r'speedModifierBase = ([^;]+)',stats)[1]),
        'adaptations':['Module cost recipes are display-only in GTNH: this game consumes their full physical structure bill when installing a module; they are never craftable conversions. The main structure uses four LV I/O/maintenance hatches and a separately paid 64A energy feed. Random Heliocast bonuses are sampled per batch; spatial structure checks and intermediate 30-second rerolls are abstracted.']}
    (root/'src/data/foundry-reference.js').write_text('// Generated by scripts/gtnh-foundry.py.\nexport const FOUNDRY_REFERENCE='+json.dumps(result,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    return set(main)|set(chassis)|{c['item'] for c in coolants}|{id for m in modules for id in [m['icon'],*m['cost']]}
