"""Source-backed dynamic routes at the late-game dependency boundaries.

Solar recipes use the declared wafer tier/count without bonus multiplication;
the ordinary wafer remains a consumed input, as in adjustRecipe().
"""
from collections import Counter
import hashlib
import itertools
import json
import re
import zipfile


def generate(imp, root, split, matching, numeric):
    used=set()
    def read(label,path=None):
        path=path or imp.source/label
        imp.paths[label]=hashlib.sha256(path.read_bytes()).hexdigest()
        imp.active_file=label
        return path.read_text(encoding='utf-8')
    def stack(expr):return imp.stack(expr)[0]
    imp.constants={}
    label='gregtech/api/recipe/maps/FluidCannerBackend.java'
    raw=read(label)
    if 'Math.max(fluidToTake.amount / 64, 16)' not in raw or '.eut(1)' not in raw:raise ValueError('changed fluid canner')
    for fluid in ('water','lava'):
        bucket=stack('new ItemStack(Items.'+fluid+'_bucket,1)')
        empty=stack('new ItemStack(Items.bucket,1)')
        imp.items[bucket].update(name='水桶' if fluid=='water' else '熔岩桶',nativeVanilla='bucket_'+fluid)
        for ins,outs in [({empty:1,fluid:1000},{bucket:1}),({bucket:1},{empty:1,fluid:1000})]:
            imp.emit_recipe('canner',ins,outs,16,1,raw.count('\n',0,raw.index('.eut(1)'))+1,{}, {},[],None)
    label='Minecraft1.7.10-source-mirror/RecipesCrafting.java'
    raw=read(label,root/'.local/vanilla-reference/RecipesCrafting.java')
    beacon=stack('new ItemStack(Blocks.beacon,1)')
    if not re.search(r'Blocks.beacon.*?"GGG".*?"GSG".*?"OOO"',raw,re.S):raise ValueError('changed beacon recipe')
    glass=stack('new ItemStack(Blocks.glass,1)');star=stack('new ItemStack(Items.nether_star,1)');obsidian=stack('new ItemStack(Blocks.obsidian,1)')
    r=imp.emit_recipe('craft',{glass:5,star:1,obsidian:3},{beacon:1},1,0,raw.count('\n',0,raw.index('Blocks.beacon'))+1,{}, {},[],None)
    if r:r.update(grid=[glass,glass,glass,glass,star,glass,obsidian,obsidian,obsidian],craftingSource='shaped',durationAdapted=True)
    # IC2's installed compressor registry: nine obsidian plates -> dense
    # obsidian plate. Preserve its 300 tick / 2 EU/t compressor operation.
    jar=next((imp.instance/'.minecraft/mods').glob('industrialcraft-2-2.2.828*.jar'))
    with zipfile.ZipFile(jar) as z:
        recipe=z.read('assets/ic2/config/compressor.ini')
        bytecode=z.read('ic2/core/block/machine/tileentity/TileEntityCompressor.class')
    label='IC2-2.2.828/assets/ic2/config/compressor.ini'
    imp.paths[label]=hashlib.sha256(recipe).hexdigest()
    imp.paths['IC2-2.2.828/TileEntityCompressor.class']=hashlib.sha256(bytecode).hexdigest()
    if b'OreDict:plateObsidian@-1@9 = IC2:itemDensePlates@7' not in recipe:raise ValueError('changed dense obsidian plate')
    imp.active_file=label
    dense=stack('getModItem(IndustrialCraft2.ID,"itemDensePlates",1,7)')
    imp.items[dense]['name']='致密黑曜石板'
    imp.items[dense]['nativeItem']['texture']='assets/ic2/textures/items/resources/itemDensePlateObsidian.png'
    imp.emit_recipe('electricCompress',{imp.material('Obsidian','plate'):9},{dense:1},300,2,recipe[:recipe.index(b'OreDict:plateObsidian')].count(b'\n')+1,{}, {},[],None)

    label='gregtech/common/tileentities/machines/multi/MTESolarFactory.java'
    machine=read(label)
    counts=[]
    for n in range(1,4):
        start=machine.index('STRUCTURE_TIER_'+str(n)+',',machine.index('.addShape('))
        end=machine.find('.addShape(',start)
        if end<0:end=machine.index('// Clean stainless steel',start)
        counts.append(Counter(''.join(re.findall(r'"([ A-HGP~]+)"',machine[start:end]))))
    imp.constants={}
    controller=imp.named('SolarFactory')
    shared={'G':stack('new ItemStack(Blocks.glass,1)'),
            'E':imp.material('DamascusSteel','frameGt'),'F':imp.material('Tungsten','frameGt'),
            'H':stack('new ItemStack(GregTechAPI.sBlockCasings11,1,7)'),
            'P':stack('ItemRefer.Precise_Electronic_Unit_T1.get(1)')}
    casings=[stack('new ItemStack(GregTechAPI.sBlockCasings4,1,1)'),stack('new ItemStack(GregTechAPI.sBlockCasings4,1,0)'),stack('new ItemStack(GregTechAPI.sBlockCasings8,1,7)')]
    machines=[]
    for tier,c in enumerate(counts,1):
        cost={controller:1}
        for char,count in c.items():
            if char in shared:cost[shared[char]]=cost.get(shared[char],0)+count
            elif char in 'ABC':cost[casings[tier-1]]=count
        machines.append({'tier':tier,'controller':controller,'cost':cost})
        used.update(cost)
    label='NewHorizonsCoreMod/com/dreammaster/gthandler/recipes/SolarFactoryRecipes.java'
    raw=read(label,imp.core/'com/dreammaster/gthandler/recipes/SolarFactoryRecipes.java')
    text=re.sub(r'/\*.*?\*/|//[^\n]*',lambda m:'\n'*m[0].count('\n'),raw,flags=re.S)
    start=text.index('public GTRecipeBuilder[] SolarFactoryRawRecipes')
    begin=text.index('{',start);end=text.index('};',begin)
    rows=split(text[begin+1:end]);imp.constants={}
    for row in rows:
        if not row.strip():continue
        line=text.count('\n',0,text.index(row,begin))+1
        if 'ItemList.SolarSail.get(' in row:
            imp.skipped.append({'file':label,'line':line,'reason':'SolarSail registration is outside this source expansion'})
            continue
        calls={}
        for call in re.finditer(r'\.(itemInputs|itemOutputs|fluidInputs|duration|eut|metadata)\(',row):
            calls[call[1]]=row[call.end():matching(row,call.end()-1)]
        wafer=0;tier=1
        if 'metadata' in calls:
            data=re.fullmatch(r'data,\s*new SolarFactoryRecipeData\(([^)]+)\)',calls['metadata'])
            if not data:raise ValueError('changed solar recipe metadata')
            values=[numeric(v) for v in split(data[1])]
            wafer=values[0];tier=values[2] if len(values)==3 and wafer else 1
        variants=[imp.variants(arg) for arg in split(calls['itemInputs'])+split(calls.get('fluidInputs','')) if arg.strip()]
        outputs=dict(imp.stack(arg) for arg in split(calls['itemOutputs']))
        for chosen in itertools.product(*variants):
            ins={};tools={}
            for id,n in chosen:
                target=tools if n==0 else ins
                target[id]=target.get(id,0)+(1 if n==0 else n)
            imp.active_file=label
            imp.emit_recipe('solarFactory',ins,outputs,numeric(calls['duration']),numeric(calls['eut']),line,tools,{'solarTier':tier},[],None)
    # GoodGenerator registers wiremill recipes in a parameterised helper.
    label='goodgenerator/util/CrackRecipeAdder.java';raw=read(label)
    start=raw.index('public static void registerWire(')
    body=raw[start:];imp.constants={}
    loaders=read('goodgenerator/loader/Loaders.java')
    for material,cover in re.findall(r'CrackRecipeAdder.registerWire\([^,]+,\s*(GGMaterial\.\w+),\s*\d+,\s*\d+,\s*\d+,\s*(true|false)\)',loaders):
        imp.constants={'material':material};imp.active_file=label
        for call in re.finditer(r'GTValues.RA.stdBuilder\(\)',body):
            end=body.index(';',call.end())
            imp.parse_builder(body[call.end():end],raw.count('\n',0,start+call.start())+1,label)
        if cover=='true':
            name=imp.addon_materials[material]
            for width in (1,2,4,8,12,16):
                wire=imp.material(name,'wireGt'+str(width).zfill(2));cable=imp.material(name,'cableGt'+str(width).zfill(2))
                cost=width//4+1
                for rubber,amount in [('RubberSilicone',72),('StyreneButadieneRubber',72)]:
                    imp.active_file='gregtech/loaders/oreprocessing/ProcessingWire.java'
                    imp.paths[imp.active_file]=hashlib.sha256((imp.source/imp.active_file).read_bytes()).hexdigest()
                    imp.emit_recipe('assemble',{wire:1,imp.material('PolyphenyleneSulfide','foil'):cost,imp.material(rubber,'molten'):amount*cost},{cable:1},100,8,498,{}, {},[],24)
    imp.constants={}
    label='kubatech/tileentity/gregtech/multiblock/MTEDEFusionCrafter.java';raw=read(label)
    shape=raw[raw.index('.addShape('):raw.index('.addElement(')]
    counts=Counter(''.join(re.findall(r'"([ NnFfR~]+)"',shape)))
    controller=stack('KubaItemList.DraconicEvolutionFusionCrafter.get(1)')
    defc=[]
    for tier in range(1,6):
        cost={controller:1,stack('KubaItemList.DEFCCasingBase.get(1)'):counts['N']+counts['n']-6,
              stack('KubaItemList.DEFCCasingT'+str(tier)+'.get(1)'):counts['R'],
              stack('new ItemStack(GregTechAPI.sBlockCasings4,1,'+('8' if tier>3 else '6')+')'):counts['F'],
              stack('new ItemStack(GregTechAPI.sBlockCasings4,1,7)'):counts['f']}
        for key in ('Hatch_Input_Bus_IV','Hatch_Output_Bus_IV','Hatch_Input_IV','Hatch_Output_IV','Hatch_Maintenance','Hatch_Energy_UV'):cost[imp.named(key)]=1
        defc.append({'tier':tier,'controller':controller,'cost':cost});used.update(cost)
    (root/'src/data/source-closure-reference.js').write_text('// Generated by scripts/gtnh-source-closure.py.\nexport const SOURCE_CLOSURE_REFERENCE='+json.dumps({'solarFactories':machines,'draconicFusionCrafters':defc,'solarAdaptation':'Declared wafer inputs/counts, no wafer upgrade bonus or parallel multiplication.'},ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    return used
