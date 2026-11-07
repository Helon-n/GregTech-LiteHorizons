"""Pinned space-mining and Botania bootstrap routes, with explicit idle scope."""
from collections import Counter
import hashlib
import json
import re


def generate(imp,root,split,matching,numeric):
    used=set()
    def read(label,path=None):
        path=path or imp.source/label
        imp.paths[label]=hashlib.sha256(path.read_bytes()).hexdigest();imp.active_file=label
        return path.read_text(encoding='utf-8')
    def item(expr):return imp.stack(expr)[0]
    def emit(process,ins,outs,ticks,power=0,tools=None,req=None):
        used.update(ins);used.update(outs);used.update(tools or {})
        return imp.emit_recipe(process,ins,outs,ticks,power,1,tools or {},req or {},[],None)
    imp.constants={}
    mining=read('gtnhintergalactic/recipe/SpaceMiningRecipes.java')
    miner=read('gtnhintergalactic/tile/multi/elevatormodules/TileEntityModuleMiner.java')
    helium=int(re.search(r'PLASMA_HELIUM_USAGE = (\d+)',miner)[1])
    plasma=imp.material('Helium','plasma')
    modules=[]
    for tier in range(1,4):
        controller=imp.named('SpaceElevatorModuleMinerT'+str(tier));used.add(controller)
        modules.append({'tier':tier,'controller':controller,'voltageTier':tier+7})
    imp.active_file='gtnhintergalactic/recipe/SpaceMiningRecipes.java'
    routes=[]
    for asteroid,drone,mat in [('lutetiumAsteroid','IV','TungstenSteel'),('draconicCoreRuin','UHV','NaquadahAlloy')]:
        start=mining.index('"'+asteroid+'"');begin=mining.rfind('addRecipesToDrones(',0,start)+len('addRecipesToDrones')
        args=split(mining[begin+1:matching(mining,begin)])
        weights=[numeric(v) for v in split(re.search(r'\{(.*)\}',args[3],re.S)[1])]
        offset=6 if asteroid=='lutetiumAsteroid' else 5
        spec=[numeric(v) for v in args[offset:offset+8]]
        minimum,maximum,near,far,cps,module,ticks,power=spec
        droneid=imp.named('MiningDrone'+drone)
        ins={imp.material(mat,'toolHeadDrill'):4,imp.material(mat,'stick'):4,plasma:helium}
        if asteroid=='lutetiumAsteroid':
            names=re.findall(r'Materials\.(\w+)',args[4]);outs=[imp.material(n,'ore') for n in names]
            count=64
        else:
            outs=[item('KubaItemList.DEFCDraconicSchematic.get(1)'),item('getModItem(DraconicEvolution.ID,"draconicCore",1,0)')]
            count=1
        # Keep only guaranteed minSize draws. Helium's extra-stack bonus and
        # the charged ZPM relic are deliberately not converted into free loot.
        r=emit('spaceMine',ins,{id:count*minimum for id in outs},ticks,power,{droneid:1},{'miningModule':module,'computation':cps,'lowGravity':True})
        if r:
            r['randomChoice']={'weights':dict(zip(outs,weights)),'count':count,'rolls':minimum}
            if len(outs)<len(weights):r['randomChoice']['noneWeight']=sum(weights[len(outs):])
            r.update(fixedRuntime=True,source='idle-adaptation');r['origin']['line']=mining.count('\n',0,start)+1
            r['spaceMining']={'asteroid':asteroid,'distance':[near,far],'maximum':maximum,'plasma':plasma,'plasmaAmount':helium}
            routes.append(r['id'])
    # ProcessingToolHead's real drill-head mould/extruder branches. This
    # helper must run before generic templates so their input forms expand.
    label='gregtech/loaders/oreprocessing/ProcessingToolHead.java';raw=read(label)
    if 'aMaterial.getMolten(4 * INGOTS)' not in raw:raise ValueError('changed drill-head shaping')
    drill_materials={'Steel','Titanium','TungstenSteel','NaquadahAlloy','Trinium','Iridium','Naquadah','Neutronium','CosmicNeutronium','Infinity'}
    drill_materials.update(i['native']['material'] for i in list(imp.items.values()) if i.get('native',{}).get('prefix')=='toolHeadDrill' and i['native']['material'] in imp.materials)
    for mat in sorted(drill_materials):
        m=imp.materials[mat]
        if 'NO_WORKING' in m.get('tags',[]):continue
        power=m.get('processingEU',0) or 120
        out=imp.material(mat,'toolHeadDrill')
        for process,ins,shape in [('solidify',{imp.material(mat,'molten'):576},'Shape_Mold_ToolHeadDrill'),('extrude',{imp.material(mat,'ingot'):4},'Shape_Extruder_ToolHeadDrill')]:
            r=emit(process,ins,{out:1},100,power,{imp.named(shape):1})
            if r:r['origin']['line']=raw.count('\n',0,raw.index('.itemInputs(ItemList.Shape_Mold_ToolHeadDrill.get(0))' if process=='solidify' else 'ItemList.Shape_Extruder_ToolHeadDrill.get(0)'))+1
    # Botania operations keep their actual material and mana costs. Compact
    # deployment and encounter durations are explicitly authored adaptations.
    bot=root/'.local/gtnh-technology/Botania-1.13.42-GTNH/src/main/java/vazkii/botania'
    def botread(path):return read('Botania-1.13.42-GTNH/'+path,bot/path)
    def mana(meta):return item('getModItem(Botania.ID,"manaResource",1,'+str(meta)+')')
    raw=botread('common/crafting/ModManaInfusionRecipes.java')
    for meta,source,cost in [(0,imp.material('Iron','ingot'),3000),(1,item('new ItemStack(Items.ender_pearl,1)'),6000),(2,imp.material('Diamond','gem'),10000)]:
        if not re.search(r'manaResource, 1, '+str(meta)+r'\).*?, '+str(cost)+r'\)',raw):raise ValueError('changed mana infusion')
        r=emit('manaInfuse',{source:1},{mana(meta):1},20,req={'mana':cost})
        if r:r.update(durationAdapted=True)
    raw=botread('common/block/tile/TileTerraPlate.java')
    if 'TilePool.MAX_MANA / 2' not in raw:raise ValueError('changed terrasteel mana')
    pool=botread('common/block/tile/mana/TilePool.java');capacity=int(re.search(r'MAX_MANA = (\d+)',pool)[1])
    flame=botread('common/block/subtile/generating/SubTileEndoflame.java')
    for text in ('return 3;','return 2;','Math.min(FUEL_CAP, burnTime) / 2'):
        if text not in flame:raise ValueError('changed endoflame')
    imp.active_file='Botania-1.13.42-GTNH/common/block/tile/TileTerraPlate.java'
    terra=mana(4);spirit=mana(5);gaia=imp.material('GaiaSpirit','ingot')
    r=emit('terraPlate',{mana(0):1,mana(1):1,mana(2):1},{terra:1},200,req={'mana':capacity//2})
    if r:r['durationAdapted']=True
    raw=botread('common/crafting/ModCraftingRecipes.java')
    if '" S ", "SIS", " S "' not in raw:raise ValueError('changed gaia ingot recipe')
    r=emit('craft',{spirit:4,terra:1},{gaia:1},20)
    if r:r.update(grid=[None,spirit,None,spirit,terra,spirit,None,spirit,None],durationAdapted=True)
    boss=botread('common/entity/EntityDoppleganger.java')
    if 'pl == 0 ? hard ? 16 : 8' not in boss:raise ValueError('changed Gaia loot')
    beacon=item('new ItemStack(Blocks.beacon,1)')
    r=emit('gaiaEncounter',{terra:1},{spirit:8},1200,tools={beacon:1})
    if r:r.update(source='idle-adaptation',durationAdapted=True)
    # Endstone and purple gel retain their actual registered identities.
    endstone=item('new ItemStack(Blocks.end_stone,1)')
    purple=item('getModItem(TinkerConstruct.ID,"slime.gel",1,2)')
    used.update([endstone,purple,terra,spirit,gaia])
    lapis=item('new ItemStack(Blocks.lapis_block,1)');used.add(lapis)
    raw=read('gregtech/loaders/oreprocessing/ProcessingGem.java')
    if '.duration(15 * SECONDS)' not in raw:raise ValueError('changed gem compression')
    emit('electricCompress',{imp.material('Lapis','gem'):9},{lapis:1},300,2)
    names=botread('common/lib/LibItemNames.java')
    sprites=re.findall(r'"(\w+)"',names.split('MANA_RESOURCE_NAMES = new String[] {',1)[1].split('};',1)[0])
    for meta,title in [(0,'魔力钢锭'),(1,'魔力珍珠'),(2,'魔力钻石'),(4,'泰拉钢锭'),(5,'盖亚之魂'),(14,'盖亚魂锭')]:
        entry=imp.items[mana(meta)];entry['name']=title
        entry['nativeItem']['texture']='assets/botania/textures/items/'+sprites[meta]+'.png'
    ref={'spaceModules':modules,'miningRecipes':routes,'endstone':endstone,'purpleGel':purple,'lapisBlock':lapis,
         'mana':{'capacity':capacity,'coalSeconds':40,'rate':30,'terra':terra,'spirit':spirit,'icon':mana(0)},
         'adaptations':['Space mining offers directed asteroid selection instead of the world asteroid search lottery. First supported drone tier only; helium plasma 825 per operation, reusable drone, four drill heads and rods, actual power, computation and module tier remain mandatory. Computation hardware is paid at installation, using the same CPU sizing as compact research stations.',
         'Asteroid oreEndstone drops use the catalog common ore identity, like existing planetary ore sites; stone substrate and the optional rich-End-ore multiplier are omitted, never used as a material bonus.',
         'Only guaranteed minimum ore stacks (64 each) are awarded. Helium bonus stacks are omitted. Draconic ruin retains 1% schematic / 1% core; the 98% charged-ZPM relic is discarded rather than converted into an uncharged item or free energy.',
         'Botania has a paid compact Endoflame/pool/platform installation. Coal burns for 40 seconds and yields 1200 mana; actual 3000/6000/10000 infusion and 500000 Terrasteel costs remain. Coordinates, spreaders, flower/pylon construction and combat are adapted, not a complete Botania simulation.',
         'A Gaia encounter consumes one Terrasteel ingot, requires a reusable beacon and gives the first-player normal-mode eight spirits. The one-minute encounter duration is adapted.']}
    (root/'src/data/bootstrap-reference.js').write_text('// Generated by scripts/gtnh-bootstrap-sources.py.\nexport const BOOTSTRAP_REFERENCE='+json.dumps(ref,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    return used
