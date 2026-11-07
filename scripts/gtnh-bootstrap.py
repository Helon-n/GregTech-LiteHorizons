"""Source-backed routes needed before the first electric circuit."""
import hashlib
import re


def generate(imp, numeric, mass):
    directory='gregtech/loaders/oreprocessing/'
    # Vanilla raw meats carry one unit of MeatRaw and 1/9 unit of Bone in
    # LoaderGTItemData. GTRecipeRegistrator recycles both, with mass duration.
    file='gregtech/loaders/preload/LoaderGTItemData.java'
    source=(imp.source/file).read_text(encoding='utf-8')
    if not re.search(r'new ItemData\(Materials.MeatRaw, 3628800L, new MaterialStack\(Materials.Bone, 403200L\)\)',source):raise ValueError('changed raw meat item data')
    imp.paths[file]=hashlib.sha256((imp.source/file).read_bytes()).hexdigest()
    file='gregtech/api/util/GTRecipeRegistrator.java';imp.active_file=file
    imp.paths[file]=hashlib.sha256((imp.source/file).read_bytes()).hexdigest()
    for food in ['porkchop','beef','chicken','fish']:
        item=imp.stack('new ItemStack(Items.'+food+',1)')[0]
        ticks=max(16,mass('MeatRaw')+mass('Bone')//9)
        imp.emit_recipe('grind',{item:1},{imp.material('MeatRaw','dust'):1,imp.material('Bone','dustTiny'):1},ticks,4,459,{}, {},[],None)
    def emit(file, inputs, outputs, line, tools=None, grid=None, slots=None):
        imp.active_file=directory+file+'.java'
        imp.paths[imp.active_file]=hashlib.sha256((imp.source/imp.active_file).read_bytes()).hexdigest()
        r=imp.emit_recipe('craft',inputs,outputs,1,0,line,tools or {},{},[],None)
        if r:
            r.update(stage=1,craftingSource='shaped' if grid else 'shapeless',durationAdapted=True)
            if grid:r['grid']=grid
            if slots:r['gridTools']=slots
    # Scope this expansion to bootstrap conductors. Later materials must not
    # acquire generic hand routes simply because a form appears in a recipe.
    for name in ('Copper','Tin','Iron','Steel','RedAlloy','Rubber'):
        m=imp.materials[name]
        if m['processingEU']>=8192:continue
        f=lambda prefix:imp.material(name,prefix)
        plate=f('plate')
        if 'NO_SMASHING' not in m['tags']:
            ingot=f('ingot')
            emit('ProcessingPlate',{ingot:2},{plate:1},144,{'hammer':1},[None,None,None,ingot,None,None,ingot,None,None],{'0':'hammer'})
            emit('ProcessingPlate',{plate:1},{f('foil'):2},127,{'hammer':1},[None,plate,None,None,None,None,None,None,None],{'0':'hammer'})
            emit('ProcessingPlate',{plate:1},{f('itemCasing'):1},412,{'hammer':1},[None,None,plate,None,None,None,None,None,None],{'0':'hammer'})
        if 'NO_WORKING' not in m['tags']:
            ingot=f('ingot');rod=f('stick')
            emit('ProcessingStick',{ingot:1},{rod:1},134,{'file':1},[None,None,None,None,ingot,None,None,None,None],{'0':'file'})
            emit('ProcessingBolt',{rod:1},{f('bolt'):2},39,{'saw':1},[None,None,None,None,rod,None,None,None,None],{'0':'saw'})
            foil=f('foil')
            emit('ProcessingFineWire',{foil:1},{f('wireFine'):1},26,{'wireCutter':1},[foil,None,None,None,None,None,None,None,None],{'1':'wireCutter'})
            emit('ProcessingWire',{plate:1},{f('wireGt01'):1},99,{'wireCutter':1},[plate,None,None,None,None,None,None,None,None],{'1':'wireCutter'})
        if name in ('Tin','RedAlloy'):
            emit('ProcessingWire',{f('wireGt01'):1,imp.material('Rubber','plate'):1},{f('cableGt01'):1},241)
    # The first pump needs a hand-crafted bronze pipe, before extruders.
    plate=imp.material('Bronze','plate')
    emit('ProcessingPipe',{plate:6},{imp.material('Bronze','pipeMedium'):2},100,{'hammer':1,'wrench':1},[plate,plate,plate,None,None,None,plate,plate,plate],{'3':'wrench','5':'hammer'})
    # Pearl plates are cut from compressed storage blocks; NO_SMASHING
    # explicitly excludes a forged/hand-hammered pearl plate.
    file='gregtech/loaders/preload/LoaderGTBlockFluid.java'
    text=(imp.source/file).read_text(encoding='utf-8')
    if not re.search(r'sBlockGem1 = new BlockMetal\([^;]+Materials.EnderPearl',text,re.S):raise ValueError('missing pearl storage block')
    imp.paths[file]=hashlib.sha256((imp.source/file).read_bytes()).hexdigest()
    for name in ['EnderPearl','EnderEye']:
        gem=imp.material(name,'gem');block=imp.material(name,'block');plate=imp.material(name,'plate')
        imp.active_file=directory+'ProcessingGem.java'
        imp.paths[imp.active_file]=hashlib.sha256((imp.source/imp.active_file).read_bytes()).hexdigest()
        imp.emit_recipe('electricCompress',{gem:9},{block:1},300,2,72,{}, {},[],None)
        imp.active_file=directory+'ProcessingBlock.java'
        imp.paths[imp.active_file]=hashlib.sha256((imp.source/imp.active_file).read_bytes()).hexdigest()
        value=mass(name)
        if value is None:raise ValueError('unresolved pearl mass')
        for fluid,minimum,maximum,divisor,ratio in [('Water',4,1000,320,2),('DistilledWater',3,750,426,2),('Lubricant',1,250,1280,1)]:
            liquid='distilledWater' if fluid=='DistilledWater' else imp.material(fluid)
            amount=max(minimum,min(maximum,value*10*30//divisor))
            imp.emit_recipe('cut',{block:1,liquid:amount},{plate:9},max(1,value*10)*ratio,30 if fluid=='Water' else 16,224,{}, {},[],None)
    # BartWorks registers blockBorosilicateGlass to its physical glass block.
    imp.active_file=directory+'ProcessingBlock.java'
    tool=imp.named('Shape_Mold_Block');value=mass('BorosilicateGlass')
    if value is None:raise ValueError('unresolved borosilicate mass')
    imp.emit_recipe('solidify',{imp.material('BorosilicateGlass','molten'):1296},{imp.material('BorosilicateGlass','block'):1},value*9,8,299,{tool:1}, {},[],None)
    # The original alloy loader uses a MaterialStack[][] loop rather than
    # literal builders. Only registered dust/ingot forms are expanded.
    # Early brass uses Overworld sphalerite -> zinc, registered by
    # ProcessingOre's direct furnace-smelting branch (one stone-host ore).
    name='Sphalerite';m=imp.materials[name]
    if m['smelting']!='Zinc' or m['blast']:raise ValueError('changed sphalerite smelting rule')
    file=directory+'ProcessingOre.java';imp.active_file=file
    imp.paths[file]=hashlib.sha256((imp.source/file).read_bytes()).hexdigest()
    r=imp.emit_recipe('electricSmelt',{imp.material(name,'ore'):1},{imp.material('Zinc','ingot'):1},128,4,150,{}, {},[],None)
    if r:r.update(stage=1,furnaceRegistry=True)
    file='gregtech/loaders/postload/recipes/AlloySmelterRecipes.java'
    imp.active_file=file
    path=imp.source/file;text=path.read_text(encoding='utf-8')
    imp.paths[file]=hashlib.sha256(path.read_bytes()).hexdigest()
    pattern=r'\{\s*new MaterialStack\(Materials\.(\w+),\s*(\d+)L\),\s*new MaterialStack\(Materials\.(\w+),\s*(\d+)L\),\s*new MaterialStack\(Materials\.(\w+),\s*(\d+)L\)\s*}'
    for match in re.finditer(pattern,text):
        a,na,b,nb,out,nout=match.groups();na=int(na);nb=int(nb);nout=int(nout)
        if not imp.materials[out]['metal']:continue
        for pa in ('dust','ingot'):
            for pb in ('dust','ingot'):
                if pa=='ingot' and not imp.materials[a]['metal'] or pb=='ingot' and not imp.materials[b]['metal']:continue
                imp.emit_recipe('alloy',{imp.material(a,pa):na,imp.material(b,pb):nb},{imp.material(out,'ingot'):nout},nout*50,15,text.count('\n',0,match.start())+1,{}, {},[],None)
