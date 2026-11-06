"""Pinned acid and rocket fuel registrations and small generator profiles."""
import hashlib
import json
import re


def generate(imp,root,split_args,matching,numeric):
    sources={};machines=[];used=set()
    def read(label):
        path=imp.source/label
        sources[label]=hashlib.sha256(path.read_bytes()).hexdigest()
        return path.read_text(encoding='utf-8')
    def fuel(family,expression,value,label,line):
        id=imp.stack(expression)[0]
        if imp.items[id]['kind']!='fluid':raise ValueError('nonfluid special fuel '+expression)
        used.add(id)
        if not any(f['id']==id and f['family']==family for f in imp.extra_fuels):
            imp.extra_fuels.append({'id':id,'family':family,'eu':value,'origin':{'file':label,'line':line}})
    acid_label='bartworks/system/material/processingLoaders/AdditionalRecipes.java'
    acid=read(acid_label)
    for table in ('liquidFuels','liquidOtherFuels'):
        block=re.search(r'\b'+table+r'\s*=\s*Arrays.asList\((.*?)\);',acid,re.S)
        if not block:raise ValueError('missing acid fuel registration '+table)
        for m in re.finditer(r'ImmutablePair.of\(',block[1]):
            end=matching(block[1],m.end()-1);expr,value=split_args(block[1][m.end():end]);expr=re.sub(r'\s+','',expr)
            if expr.endswith('.getBridgeMaterial()'):expr=expr.removesuffix('.getBridgeMaterial()')+'.getFluidOrGas(1)'
            elif expr.endswith('.mStandardMoltenFluid'):expr=expr.removesuffix('.mStandardMoltenFluid')+'.getMolten(1)'
            elif expr.startswith('Materials.'):expr+='.getFluid(1)'
            else:expr='new FluidStack('+expr+',1)'
            fuel('Acid',expr,numeric(value),acid_label,acid.count('\n',0,block.start(1)+m.start())+1)
    rocket_label='gtPlusPlus/core/item/chemistry/RecipeLoaderRocketFuels.java'
    rocket=read(rocket_label)
    for m in re.finditer(r'addFuelRecipe\((GTPPFluids\.\w+),\s*(\d+)\)',rocket):
        fuel('Rocket','new FluidStack('+m[1]+',1)',int(m[2]),rocket_label,rocket.count('\n',0,m.start())+1)
    read('gregtech/api/metatileentity/implementations/MTEBasicGenerator.java')
    acid_source=read('bartworks/common/tileentities/tiered/MTEAcidGenerator.java')
    if 'return efficiency;' not in acid_source:raise ValueError('acid generator efficiency implementation changed')
    label='bartworks/common/loaders/ItemRegistry.java';registrations=read(label)
    ids=dict(re.findall(r'^\s*(\w+)\(([\d_]+)\)',read('gregtech/api/enums/MetaTileEntityIDs.java'),re.M))
    for m in re.finditer(r'new MTEAcidGenerator\(',registrations):
        end=matching(registrations,m.end()-1);args=split_args(registrations[m.end():end])
        if len(args)!=5:continue
        tier=numeric(args[3]);efficiency=numeric(args[4]);meta=numeric(ids[args[0].removesuffix('.ID')])
        native={'name':'酸液发电机','registry':'gregtech:gt.blockmachines','meta':meta,'texture':'assets/gregtech/textures/blocks/iconsets/MACHINE_CASING_ACIDHAZARD.png'}
        imp.external_item_metadata[(native['registry'],meta)]=native
        item=imp.stack('getModItem(GregTech.ID,"gt.blockmachines",1,'+str(meta)+')')[0];used.add(item)
        machines.append({'id':'acidGenerator'+str(tier),'name':'酸液发电机','tier':tier,'efficiency':efficiency,'family':'Acid','item':item})
    rocket_source=read('gtPlusPlus/xmod/gregtech/common/tileentities/generators/MTERocketFuelGenerator.java')
    formula=re.search(r'int getEfficiency\(\)\s*\{\s*return\s+([^;]+);',rocket_source)
    if not formula:raise ValueError('rocket generator efficiency implementation missing')
    label='gtPlusPlus/xmod/gregtech/registration/gregtech/GregtechRocketFuelGenerator.java';registrations=read(label)
    for m in re.finditer(r'GregtechItemList\.(\w+)\.set\(\s*new MTERocketFuelGenerator\(',registrations):
        end=matching(registrations,m.end()-1);args=split_args(registrations[m.end():end]);tier=numeric(args[3])
        efficiency=numeric(formula[1].replace('this.mTier',str(tier)))
        item=imp.stack('GregtechItemList.'+m[1]+'.get(1)')[0];used.add(item)
        machines.append({'id':'rocketGenerator'+str(tier),'name':'火箭燃料发电机','tier':tier,'efficiency':efficiency,'family':'Rocket','item':item})
    expected={('Acid',tier) for tier in range(1,6)}|{('Rocket',tier) for tier in range(4,7)}
    if {(m['family'],m['tier']) for m in machines}!=expected:raise ValueError('unexpected acid/rocket generator registrations')
    # The acid machines are registered in a counted crafting loop, which the
    # generic importer deliberately refuses. Expand this exact source table,
    # retaining the source's battery-hull choices (not the machine's tier).
    label='bartworks/common/loaders/recipes/CraftingRecipes.java'
    crafting=read(label)
    crafting=re.sub(r'/\*.*?\*/|//[^\n]*',lambda m:'\n'*m[0].count('\n'),crafting,flags=re.S)
    arrays={}
    for key in ('cables','bats','chreac'):
        table=re.search(r'\b'+key+r'\s*=\s*\{([^}]+)\}',crafting,re.S)
        if not table:raise ValueError('missing acid crafting table '+key)
        arrays[key]=split_args(table[1])
    hull_source=read('gregtech/api/enums/ItemList.java')
    hull_table=re.search(r'\bMACHINE_HULLS\s*=\s*\{([^}]+)\}',hull_source,re.S)
    if not hull_table:raise ValueError('missing machine hull table')
    hulls=split_args(hull_table[1])
    for call in re.finditer(r'GTModHandler.addCraftingRecipe\(\s*ItemRegistry.acidGens(LV|\[i\])\s*,',crafting):
        start=crafting.index('(',call.start());end=matching(crafting,start)
        args=split_args(crafting[start+1:end]);body=re.fullmatch(r'new\s+Object\[\]\s*\{(.*)\}',args[-1],re.S)
        if not body:raise ValueError('dynamic acid crafting array')
        operands=split_args(body[1]);rows=[json.loads(r) for r in operands[:3]]
        mapping={key[1:-1]:value for key,value in zip(operands[3::2],operands[4::2])}
        for tier in ([1] if call[1]=='LV' else range(2,6)):
            g=next(g for g in machines if g['family']=='Acid' and g['tier']==tier)
            imp.active_file=label;imp.constants={}
            replacements={'bats[i]':arrays['bats'][tier-2],'chreac[i]':arrays['chreac'][tier-2],
                'machinehull':'ItemList.'+hulls[tier]+'.get(1)','cable':arrays['cables'][tier]}
            grid=[];inputs={}
            for row in rows:
                if len(row)!=3:raise ValueError('invalid acid crafting row')
                for symbol in row:
                    if symbol==' ':grid.append(None);continue
                    expression=mapping[symbol]
                    if call[1]!='LV':
                        for key,value in replacements.items():expression=re.sub(r'(?<![\w.])'+re.escape(key)+r'(?!\w)',lambda m:value,expression)
                    id,n=imp.stack(expression);grid.append(id);inputs[id]=inputs.get(id,0)+1
            line=crafting.count('\n',0,call.start())+1
            r=imp.emit_recipe('craft',inputs,{g['item']:1},1,0,line,{}, {},[],None)
            if r:r.update(stage=tier+1,grid=grid,craftingSource='shaped',durationAdapted=True)
    imp.paths.update(sources)
    data={'machines':machines,'sourceFiles':sources}
    (root/'src/data/fuel-generators-reference.js').write_text('// Generated by scripts/gtnh-special-fuels.py.\nexport const FUEL_GENERATORS_REFERENCE='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    return used
