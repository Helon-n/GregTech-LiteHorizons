"""Expand source-backed bootstrap helpers for biological processing.

Incubation keeps tick probability and catalyst loss as independent runtime
events. It never replaces probabilistic consumption with an expected cost.
"""
import hashlib
import importlib.util
import json
import math
import zipfile
import re


def generate(imp, root, numeric):
    spec=importlib.util.spec_from_file_location('vanilla_sources',root/'scripts/gtnh-vanilla-sources.py')
    vanilla_sources=importlib.util.module_from_spec(spec);spec.loader.exec_module(vanilla_sources)
    imp.paths.update(vanilla_sources.acquire(root))
    def read(label, path=None):
        path=path or imp.source/label
        imp.paths[label]=hashlib.sha256(path.read_bytes()).hexdigest()
        imp.active_file=label
        return path.read_text(encoding='utf-8')
    label='bartworks/common/loaders/recipes/Autoclave.java'
    text=read(label)
    if not all(s in re.sub(r'\s+','',text) for s in ['used.getGas(10L)!=null?used.getGas(8L):used.getFluid(16L)','duration(5*SECONDS)','eut(TierEU.RECIPE_LV)']):
        raise ValueError('changed sterile vessel helper')
    materials=re.search(r'Materials\[\] sterilizers\s*=\s*\{([^}]+)',text)[1]
    for material in re.findall(r'Materials\.(\w+)',materials):
        # This pinned material set has ammonia/chlorine gas and liquid
        # alcohols. Refuse a changed set instead of guessing a fluid state.
        if material not in ('Ammonia','Chlorine','Ethanol','Methanol'):raise ValueError(material)
        fluid=imp.material(material,'fluid')
        for source,target in [('ItemList.Circuit_Parts_PetriDish.get(1)','ItemList.EmptyPetriDish.get(1)'),('new ItemStack(Items.glass_bottle,1)','ItemList.EmptyDNAFlask.get(1)')]:
            a=imp.stack(source)[0];b=imp.stack(target)[0]
            imp.emit_recipe('autoclave',{a:1,fluid:8 if material in ('Ammonia','Chlorine') else 16},{b:1},100,30,21,{}, {},[],None)
    source=root/'.local/gtnh-technology/Binnie-2.6.51/src/main/java/binnie'
    def binnie(file):return read('Binnie-2.6.51/'+file,source/file)
    enums=binnie('genetics/item/GeneticsItems.java')
    genetics_meta={name:index for index,name in enumerate(re.findall(r'^    (\w+)\("',enums,re.M))}
    binnie('genetics/machine/LaboratoryMachine.java')
    machine_text=binnie('genetics/machine/ModuleMachine.java')
    item_text=binnie('genetics/item/ModuleItem.java')
    items={}
    for key,meta,title,texture in [('casing',0,'实验室外壳','items/casingIron'),('medium',4,'培养基','items/growthMedium')]:
        id=imp.stack(f'getModItem(Genetics.ID,"misc",1,{meta})')[0]
        imp.items[id]['name']=title;imp.items[id]['nativeItem']['texture']='assets/genetics/textures/'+texture+'.png'
        items[key]=id
    items['controller']=imp.stack('getModItem(Genetics.ID,"labMachine",1,2)')[0]
    imp.items[items['controller']]['name']='培养箱'
    imp.items[items['controller']]['nativeItem']['texture']='assets/genetics/textures/tile/Incubator.png'
    def craft(inputs,output,grid,label,line):
        imp.active_file='Binnie-2.6.51/'+label
        r=imp.emit_recipe('craft',inputs,{output:1},1,0,line,{}, {},[],None)
        if r:r.update(grid=grid,stage=1,craftingSource='shaped',durationAdapted=True)
    # Explicit literal crafting definitions, with the actual physical casing,
    # Forestry circuit and sturdy-machine inputs retained.
    iron=imp.material('Iron','ingot');bronze=imp.material('Bronze','gearGt')
    sturdy=imp.stack('getModItem(Forestry.ID,"sturdyMachine",1)')[0]
    craft({iron:8,sturdy:1},items['casing'],[iron]*4+[sturdy]+[iron]*4,'genetics/item/ModuleItem.java',82)
    pane=imp.stack('new ItemStack(Blocks.glass_pane,1)')[0]
    furnace=imp.stack('new ItemStack(Blocks.furnace,1)')[0]
    circuit=imp.stack('getModItem(Forestry.ID,"chipsets",1,1)')[0]
    craft({pane:2,furnace:1,circuit:2,items['casing']:1,iron:2,bronze:1},items['controller'],[pane,furnace,pane,circuit,items['casing'],circuit,iron,bronze,iron],'genetics/machine/ModuleMachine.java',77)
    bone=imp.stack('new ItemStack(Items.dye,1,15)')[0];sugar=imp.stack('new ItemStack(Items.sugar,1)')[0]
    imp.active_file='Binnie-2.6.51/genetics/item/ModuleItem.java'
    r=imp.emit_recipe('craft',{bone:1,sugar:1},{items['medium']:2},1,0,96,{}, {},[],None)
    if r:r.update(stage=1,craftingSource='shapeless',durationAdapted=True)
    text=binnie('genetics/machine/incubator/Incubator.java')
    logic=binnie('genetics/machine/incubator/IncubatorComponentLogic.java')
    energy=binnie('core/machines/power/PowerSystem.java')
    binnie('core/machines/power/ComponentProcessIndefinate.java')
    binnie('genetics/machine/incubator/IncubatorRecipe.java')
    if 'rand.nextInt(20) == 0' not in logic or not all(s in energy for s in ('RF(10.0)','EU(40.0)')):raise ValueError('changed incubator power/probability')
    watts=numeric(re.search(r'ENERGY_PER_TICK = ([^;]+)',text)[1].removesuffix('f'))/4
    def fluid(key):return imp.stack('FluidRegistry.getFluidStack("binnie.'+key+'",1)')[0]
    fluids={key:fluid(key) for key in ('growthmedium','bacteria','bacteriapoly','bacteriavector')}
    wheat=imp.stack('new ItemStack(Items.wheat,1)')[0]
    imp.active_file='Binnie-2.6.51/genetics/machine/incubator/Incubator.java'
    # Parse all literal base recipes; bee larvae require an NBT-aware breeding
    # system and are reported separately rather than inventing a generic bee.
    def args_at(source,start):
        depth=1;end=start;quote=False
        while depth:
            c=source[end]
            if c=='"':quote=not quote
            if not quote:depth+=(c=='(')-(c==')')
            end+=1
        body=source[start:end-1];parts=[];level=0;last=0
        for i,c in enumerate(body):
            level+=(c in '([{')-(c in ')]}')
            if c==',' and level==0:parts.append(body[last:i].strip());last=i+1
        parts.append(body[last:].strip());return parts,end
    def genetic_stack(expr):
        m=re.fullmatch(r'GeneticsItems\.(\w+)\.get\((\d+)\)',expr)
        if m:
            meta=genetics_meta[m[1]]
            return imp.stack(f'getModItem(Genetics.ID,"misc",{m[2]},{meta})')
        m=re.fullmatch(r'GeneticLiquid\.(\w+)\.get\((\d+)\)',expr)
        if m:return fluids[{'GrowthMedium':'growthmedium','Bacteria':'bacteria','BacteriaPoly':'bacteriapoly','BacteriaVector':'bacteriavector'}[m[1]]],int(m[2])
        m=re.fullmatch(r'Binnie\.Liquid\.getLiquidStack\("water",\s*(\d+)\)',expr)
        if m:return 'water',int(m[1])
        return imp.stack(expr)
    literal_count=0
    for match in re.finditer(r'new IncubatorRecipe\(',text):
        args,end=args_at(text,match.end())
        if len(args) not in (4,5):raise ValueError('changed incubator recipe')
        tool,_=genetic_stack(args[0]);liquid,n=genetic_stack(args[1]);outputs={}
        if args[2]!='null':
            out,amount=genetic_stack(args[2]);outputs[out]=amount
        else:
            m=re.match(r'\s*\.setOutputStack\(',text[end:])
            if not m:raise ValueError('missing incubator item output')
            out_args,_=args_at(text,end+m.end());out,amount=genetic_stack(out_args[0]);outputs[out]=amount
        loss=float(args[3].removesuffix('f'));task=.05*(float(args[4].removesuffix('f')) if len(args)==5 else 1)
        line=text.count('\n',0,match.start())+1
        r=imp.emit_recipe('incubate',{liquid:n} if n else {},outputs,20,watts,line,{tool:1},{},[],None)
        if r:r.update(incubation={'catalyst':tool,'lossChance':loss,'taskChance':task,'seedFluid':liquid},fixedRuntime=True)
        literal_count+=1
    if literal_count!=8:raise ValueError('changed base incubation recipe count')
    # The installed pack disables Botania defaults. BotanicHorizons explicitly
    # provides this technological alternative, avoiding a fabricated mana route.
    bh='Botanic-horizons-1.12.10-GTNH/src/main/java/net/fuzzycraft/botanichorizons/patches/CraftingPatches.java'
    bh_text=read('BotanicHorizons/'+bh,root/'.local/gtnh-technology'/bh)
    alternate=bh_text[bh_text.index('// Alternate non-magic Tiny Planet Block Recipe'):]
    alternate=alternate[:alternate.index('ModCraftingRecipes.recipeTinyPlanetBlock')]
    if not all(s in alternate for s in ('new ItemStack(ModBlocks.tinyPlanet)','"SSS", "SPS", "SSS"',"'S', \"stone\"","'P', ItemList.Field_Generator_IV.get(1)")):raise ValueError('changed technological tiny planet recipe')
    field=imp.named('Field_Generator_IV');stone=imp.stack('new ItemStack(Blocks.stone,1)')[0]
    planet=imp.stack('getModItem(Botania.ID,"tinyPlanetBlock",1,0)')[0]
    imp.active_file='BotanicHorizons/'+bh
    r=imp.emit_recipe('craft',{stone:8,field:1},{planet:1},1,0,bh_text.count('\n',0,bh_text.index('// Alternate non-magic'))+2,{}, {},[],None)
    if r:r.update(grid=[stone,stone,stone,stone,field,stone,stone,stone,stone],craftingSource='shaped',durationAdapted=True)
    # AE2's packaged recipes produce NBT-backed initial seeds. The pinned
    # autoclave source uses these same progress values, not generic crystals.
    aejar=next((imp.instance/'.minecraft/mods').glob('appliedenergistics2-*.jar'))
    imp.paths['mods/'+aejar.name]=hashlib.sha256(aejar.read_bytes()).hexdigest()
    with zipfile.ZipFile(aejar) as archive:
        seed_recipe=archive.read('assets/appliedenergistics2/recipes/misc/seeds.recipe').decode()
    imp.active_file='AE2/assets/appliedenergistics2/recipes/misc/seeds.recipe'
    imp.paths[imp.active_file]=hashlib.sha256(seed_recipe.encode()).hexdigest()
    for m in re.finditer(r'^shapeless= oredictionary:sand oredictionary:dust(\w+)\s*-> 2 ae2:ItemCrystalSeed\.(\w+)',seed_recipe,re.M):
        material,variant=m.groups();meta={'Certus':0,'Nether':600,'Fluix':1200}[variant]
        seed=imp.stack(f'getModItem(AppliedEnergistics2.ID,"item.ItemCrystalSeed",1,{meta})')[0]
        imp.items[seed]['nativeItem']['nbt']={'progress':meta}
        imp.items[seed]['name']={'Certus':'赛特斯石英种子','Nether':'下界石英种子','Fluix':'福鲁伊克斯种子'}[variant]
        r=imp.emit_recipe('craft',{'sand':1,imp.material(material,'dust'):1},{seed:2},20,0,seed_recipe.count('\n',0,m.start())+1,{}, {},[],None)
        if r:r.update(craftingSource='shapeless',durationAdapted=True,stage=1)
    # Dynamic ore-prefix transformations are actual chemical baths, not
    # manual hammer routes for late-game metals.
    label='gregtech/loaders/oreprocessing/ProcessingTransforming.java'
    transforming=read(label)
    if not all(x in transforming for x in ('case "Iron"','case "CastIron"','case "Steel"','250L','225L','200L')):raise ValueError('changed fiery steel conversion')
    blood=imp.material('FierySteel','fluid')
    for source,amount in [('Iron',250),('CastIron',225),('Steel',200)]:
        for prefix,volume in [('dust',1),('ingot',1),('plate',1),('plateDouble',2),('plateDense',9),('stick',.5),('stickLong',1),('bolt',.125),('screw',1/9),('ring',.25),('nugget',1/9)]:
            # Expand the verified dust route and already-referenced forms;
            # no arbitrary new tool or enchanted item subtypes are generated.
            base_id=imp.material(source,prefix)
            target=imp.material('FierySteel',prefix)
            if prefix!='dust' and target not in {id for r in imp.recipes for id in (*r['inputs'],*r['outputs'])}:continue
            imp.active_file=label
            imp.emit_recipe('chemicalBath',{base_id:1,blood:max(1,math.ceil(amount*volume))},{target:1},100,7,transforming.count('\n',0,transforming.index('case "'+source+'"'))+1,{}, {},[],None)
    loader=read('gregtech/loaders/preload/LoaderGTBlockFluid.java')
    backend=read('gregtech/api/recipe/maps/FluidCannerBackend.java')
    if 'Materials.FierySteel.getFluid(250)' not in loader or 'Math.max(drainedFluid.amount / 64, 16)' not in backend:raise ValueError('changed fiery blood container')
    imp.active_file='gregtech/api/recipe/maps/FluidCannerBackend.java'
    vial=imp.stack('ItemList.TF_Vial_FieryBlood.get(1)')[0];bottle=imp.stack('ItemList.Bottle_Empty.get(1)')[0]
    imp.emit_recipe('canner',{vial:1},{bottle:1,blood:250},16,1,50,{}, {},[],None)
    # Vanilla 1.7.10 dye mixing, read from the source mirror kept alongside
    # the pinned mod sources. Only literal dye-to-dye recipes are expanded;
    # neither arbitrary flower metadata nor magic resources are fabricated.
    label='Minecraft1.7.10-source-mirror/RecipesDyes.java'
    vanilla=read(label,root/'.local/vanilla-reference/RecipesDyes.java')
    for m in re.finditer(r'\.addShapelessRecipe\(',vanilla):
        args,_=args_at(vanilla,m.end())
        if len(args)!=2 or not re.fullmatch(r'new ItemStack\(Items.dye, \d+, \d+\)',args[0]):continue
        array=re.fullmatch(r'new Object\[\] \{(.*)\}',args[1])
        if not array:continue
        stacks=re.findall(r'new ItemStack\(Items.dye, \d+, \d+\)',array[1])
        if not stacks or re.sub(r'new ItemStack\(Items.dye, \d+, \d+\)|[,\s]','',array[1]):continue
        inputs={}
        for operand in stacks:
            id,n=imp.stack(operand);inputs[id]=inputs.get(id,0)+n
        out,n=imp.stack(args[0]);imp.active_file=label
        r=imp.emit_recipe('craft',inputs,{out:n},20,0,vanilla.count('\n',0,m.start())+1,{}, {},[],None)
        if r:r.update(stage=0,craftingSource='shapeless',durationAdapted=True)
    label='Minecraft1.7.10-source-mirror/FurnaceRecipes.java'
    furnace=read(label,root/'.local/vanilla-reference/FurnaceRecipes.java')
    if 'this.addSmelting(Blocks.cactus, new ItemStack(Items.dye, 1, 2), 0.2F)' not in furnace:raise ValueError('changed cactus smelting')
    cactus=imp.stack('new ItemStack(Blocks.cactus,1)')[0];green=imp.stack('new ItemStack(Items.dye,1,2)')[0]
    imp.active_file=label
    r=imp.emit_recipe('electricSmelt',{cactus:1},{green:1},128,4,furnace.count('\n',0,furnace.index('this.addSmelting(Blocks.cactus'))+1,{}, {},[],None)
    if r:r.update(stage=1,furnaceRegistry=True)
    # ProcessingDye's dynamic loop is registered by these two loaders.
    mix=read('gregtech/loaders/postload/recipes/MixerRecipes.java')
    chem=read('gregtech/loaders/postload/recipes/ChemicalRecipes.java')
    if 'new OreDictItemStack(dye.name(), 1)' not in mix or 'Materials.SulfuricAcid.getFluid(432)' not in chem:raise ValueError('changed dye recipes')
    dyes=read('gregtech/api/enums/Dyes.java')
    for color in re.findall(r'^\s*(dye\w+)\(\s*\d+,\s*0x',dyes,re.M):
        solid=imp.stack('new OreDictItemStack("'+color+'",1)')[0]
        for mode,process,inputs,ticks,power,circuit in [
            ('watermixed','mix',{solid:1,'distilledWater':288},16,4,1),
            ('chemical','chemistry',{solid:1,imp.material('Salt','dust'):2,imp.material('SulfuricAcid','fluid'):432},600,48,None)]:
            out=imp.stack('FluidRegistry.getFluidStack("dye.'+mode+'.'+color.lower()+'",288)')[0]
            label='gregtech/loaders/postload/recipes/'+('MixerRecipes.java' if mode=='watermixed' else 'ChemicalRecipes.java')
            imp.active_file=label;raw=mix if mode=='watermixed' else chem
            imp.emit_recipe(process,inputs,{out:288},ticks,power,raw.count('\n',0,raw.index('for (Dyes dye : Dyes.VALUES)'))+1,{}, {},[],circuit)
    reference={**items,'power':watts,'adaptations':['EU input uses Binnie PowerSystem conversion (1 EU = 4 RF). Tick task probability and independent catalyst loss are preserved. Warehouse items represent the incubator slot; no free fluid seed is supplied.']}
    (root/'src/data/incubator-reference.js').write_text('// Generated by scripts/gtnh-progression-sources.py.\nexport const INCUBATOR_REFERENCE='+json.dumps(reference,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    return set(items.values())|set(fluids.values())
