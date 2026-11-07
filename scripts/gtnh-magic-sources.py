"""The small magical branch actually needed by the imported industrial chain.

Item/aspect quantities come from the pinned pack. Research samples, station
placement, aura recharge and encounters are explicit idle adaptations, not a
claim to implement Thaumcraft's minigame or Blood Magic's player health.
"""
from collections import Counter
import hashlib
import json
import re
import zipfile


def generate(imp, root, split, matching, numeric):
    used=set()
    def read(label):
        path=imp.core/label
        imp.paths['NewHorizonsCoreMod/'+label]=hashlib.sha256(path.read_bytes()).hexdigest()
        imp.active_file='NewHorizonsCoreMod/'+label
        return path.read_text(encoding='utf-8')
    def item(expr):return imp.stack(expr)[0]
    def mod(mod,name,meta=0):return item(f'getModItem({mod}.ID,"{name}",1,{meta})')
    def emit(process,ins,outs,ticks=200,tools=None,req=None):
        used.update(ins);used.update(outs);used.update(tools or {})
        r=imp.emit_recipe(process,ins,outs,ticks,0,1,tools or {},req or {},[],None)
        if r:r.update(durationAdapted=True,source='idle-adaptation')
        return r
    imp.constants={}
    # These explicit tags were transcribed from the installed class, not from
    # a different Thaumcraft version. Refuse regeneration with other bytecode.
    jar=next((imp.instance/'.minecraft/mods').glob('Thaumcraft-*-4.2.3.5.jar'))
    cls='thaumcraft/common/config/ConfigAspects.class'
    with zipfile.ZipFile(jar) as z:digest=hashlib.sha256(z.read(cls)).hexdigest()
    if digest!='70abd2869830526fe1e8608e6e4af321a855fd01cce663a6853df7e942959af3':raise ValueError('changed Thaumcraft aspect registry')
    imp.active_file='Thaumcraft-4.2.3.5/'+cls;imp.paths[imp.active_file]=digest
    essence={}
    titles={'MAN':'人类','FLESH':'肉体','LIGHT':'光明','SENSES':'感知','SOUL':'灵魂','EARTH':'地','TRAP':'束缚','ELDRITCH':'异域','MAGIC':'魔法','TRAVEL':'旅行','ORDER':'秩序','CRYSTAL':'水晶','METAL':'金属','TAINT':'污秽','SLIME':'粘液','ENTROPY':'混沌'}
    def aspect(key):
        id='essentia_'+key
        imp.items[id]={'id':id,'name':titles.get(key,key)+'源质','kind':'fluid','category':'源质','icon':'magicEssentiaJar'}
        essence[key]=id;used.add(id);return id
    raw_sources=[
        (item('new ItemStack(Items.rotten_flesh,1)'),{'MAN':1,'FLESH':2}),
        (imp.material('Glowstone','dust'),{'LIGHT':2,'SENSES':1}),
        (item('new ItemStack(Blocks.soul_sand,1)'),{'EARTH':1,'TRAP':1,'SOUL':1}),
        (item('new ItemStack(Items.ender_pearl,1)'),{'ELDRITCH':4,'MAGIC':2,'TRAVEL':4}),
        (mod('Thaumcraft','ItemShard',4),{'MAGIC':1,'ORDER':2,'CRYSTAL':1}),
        (item('new ItemStack(Items.iron_ingot,1)'),{'METAL':4}),
        (mod('Thaumcraft','ItemResource',11),{'TAINT':3,'SLIME':1}),
    ]
    for source,tags in raw_sources:
        emit('essentiaDistill',{source:1,'coal':1},{aspect(k):v for k,v in tags.items()},200)
    jarid=mod('Thaumcraft','blockJar')
    imp.items['magicEssentiaJar']={'id':'magicEssentiaJar','name':'源质罐','kind':'item','category':'流体容器','icon':jarid}
    used.update(['magicEssentiaJar',jarid])
    # Jar placement follows the rest of the idle game's physical containers.
    emit('craft',{'glass':7,imp.material('Wood','plate'):1},{'magicEssentiaJar':1},20)
    nether=mod('ThaumicTinkerer','kamiResource',6);end=mod('ThaumicTinkerer','kamiResource',7)
    ichor=mod('ThaumicTinkerer','kamiResource',0)
    soulSand=item('new ItemStack(Blocks.soul_sand,1)');taint=mod('Thaumcraft','ItemResource',11)
    raw=read('com/dreammaster/scripts/ScriptThaumicTinkerer.java')
    # Keep research as physical, reusable notes. The study samples/time replace
    # the research-point puzzle; they never substitute for production aspects.
    def study(code,title,samples,parent=None):
        id='magicResearch_'+code
        imp.items[id]={'id':id,'name':title+'研究笔记','kind':'item','category':'研究','icon':jarid}
        parents=parent if isinstance(parent,list) else [parent] if parent else []
        emit('thaumicStudy',{'paperPlate':8,**samples},{id:1},1200,{p:1 for p in parents})
        return id
    infusion=study('INFUSION','注魔',{'enderPearlGem':1,'infusedOrderGem':4})
    dimensions=study('DIMENSIONSHARDS','维度碎片',{nether:1,end:1},infusion)
    ichorResearch=study('ICHOR','灵宝',{nether:1,end:1,item('new ItemStack(Items.nether_star,1)'):1},dimensions)
    ichoriumResearch=study('ICHORIUM','灵宝金属',{ichor:1,imp.material('Osmiridium','ingot'):1},ichorResearch)
    # Parse the exact infusion, including its center item and instability.
    call=re.search(r'TCHelper.addInfusionCraftingRecipe\(\s*"ICHOR",',raw)
    endcall=matching(raw,raw.index('(',call.start()))
    args=split(raw[raw.index('(',call.start())+1:endcall])
    if len(args)!=9:raise ValueError('changed ICHOR infusion')
    ins=Counter()
    for expr in args[4:]:
        if 'OrePrefixes.gemFlawless.get(Materials.Diamond)' in expr:expr='GTOreDictUnificator.get(OrePrefixes.gemFlawless,Materials.Diamond,1)'
        id,n=imp.stack(expr);ins[id]+=n
    for key,n in re.findall(r'\.add\(Aspect\.(\w+),\s*(\d+)\)',args[3]):ins[aspect(key)]+=int(n)
    out,n=imp.stack(args[1])
    r=emit('thaumicInfusion',dict(ins),{out:n},600,{ichorResearch:1},{'instability':numeric(args[2])})
    if r:r['origin']['line']=raw.count('\n',0,call.start())+1
    # The arcane Ichorium grid is literally in the Core script.
    call=re.search(r'ThaumcraftApi.addArcaneCraftingRecipe\(\s*"ICHORIUM",',raw)
    begin=raw.index('(',call.start());args=split(raw[begin+1:matching(raw,begin)])
    rows=[json.loads(x.strip()) for x in args[3:6]]
    operands={args[k].strip().strip("'"):args[k+1] for k in range(6,len(args),2)}
    aliases={'ingotVoid':('Void','ingot'),'ingotOsmiridium':('Osmiridium','ingot'),'gemFlawlessDiamond':('Diamond','gemFlawless')}
    grid=[]
    for key in ''.join(rows):
        expr=operands[key];dictionary=expr.strip().strip('"')
        grid.append(imp.material(*aliases[dictionary]) if dictionary in aliases else item(expr))
    amounts=[int(n) for n in re.findall(r'\.add\(Aspect\.\w+,\s*(\d+)\)',args[2])]
    if amounts!=[125]*6:raise ValueError('changed Ichorium vis cost')
    out,n=imp.stack(args[1]);r=emit('arcaneCraft',dict(Counter(grid)),{out:n},200,{ichoriumResearch:1},{'vis':125})
    if r:r.update(grid=grid,origin={'file':imp.active_file,'line':raw.count('\n',0,call.start())+1})
    # Blood altar: real T5 / 50,000 LP / 20 LP per tick processing.
    blood=read('com/dreammaster/scripts/ScriptBloodMagic.java')
    call=re.search(r'AltarRecipeRegistry.registerAltarRecipe\(\s*BlockList.BloodyIchorium.get\(\)',blood)
    begin=blood.index('(',call.start());args=split(blood[begin+1:matching(blood,begin)])
    if [numeric(x) for x in args[2:6]]!=[5,50000,20,20]:raise ValueError('changed bloody Ichorium altar')
    inp,amount=imp.stack(args[1]);out,n=imp.stack(args[0]);lp=imp.material('LifeEssence','fluid')
    r=emit('bloodAltar',{inp:amount,lp:50000},{out:n},2500,req={'bloodAltarTier':5})
    if r:r.update(durationAdapted=False,origin={'file':imp.active_file,'line':blood.count('\n',0,call.start())+1})
    # Suffering is represented as a paid repeatable encounter, with LP stored
    # in real fluid containers. No LP is granted when the app is closed.
    demon=study('DEMON','恶魔召唤',{lp:100000,mod('BloodMagic','demonBloodShard'):1})
    eldritch=study('ELDRITCH','邪术远征',{mod('Thaumcraft','ItemEldritchObject',0):4},infusion)
    # Deep Dark is the original bootstrap for Deep Dark Iron and Pumice.
    # Keep the actual portal infusion, not a free world-unlock switch.
    titles.update(VOID='虚空',TEMPUS='时间',LUST='欲望',GLUTTONY='饕餮',PRIDE='傲慢',NETHER='下界',ULTRA_DEATH='终焉')
    forbidden=imp.instance/'.minecraft/mods/Forbidden.Magic-0.9.18-GTNH.jar'
    cls='fox/spiteful/forbidden/DarkAspects.class'
    with zipfile.ZipFile(forbidden) as z:digest=hashlib.sha256(z.read(cls)).hexdigest()
    if digest!='10c681e5a00f1b67c0cbce7fa7beb6de8cf54c7dba4496c0e218d34e17e5fd27':raise ValueError('changed sin-shard aspects')
    cfg=imp.instance/'.minecraft/config/ForbiddenMagic.cfg';config=cfg.read_text(encoding='utf-8')
    if re.search(r'B:[^\n]*[Ll]ust[^\n]*=true',config):raise ValueError('Lust disabled in installed pack')
    imp.paths['instance/config/ForbiddenMagic.cfg']=hashlib.sha256(cfg.read_bytes()).hexdigest()
    imp.active_file='ForbiddenMagic-0.9.18/'+cls;imp.paths[imp.active_file]=digest
    sins={}
    for key,registry,meta in [('PRIDE','NetherShard',3),('LUST','NetherShard',4),('GLUTTONY','GluttonyShard',0)]:
        sins[key]=mod('ForbiddenMagic',registry,meta)
        imp.items[sins[key]]['nativeItem']['texture']='assets/forbidden/textures/items/'+key.lower()+'shard.png'
        emit('essentiaDistill',{sins[key]:1,'coal':1},{aspect('NETHER'):1,aspect(key):2,aspect('CRYSTAL'):1})
    # Checked minimum: the bowl's added VOID tag. Other inferred crafting
    # tags are discarded rather than fabricated by an aspect calculator.
    imp.active_file='Thaumcraft-4.2.3.5/thaumcraft/common/config/ConfigAspects.class'
    emit('essentiaDistill',{item('new ItemStack(Items.bowl,1)'):1,'coal':1},{aspect('VOID'):1})
    tags=read('com/dreammaster/scripts/ScriptGregtechPlusPlus.java')
    helper=read('com/dreammaster/thaumcraft/TCMaterialAspectHelper.java')
    if 'registerMaterialAspects("Rhugnor", Lucrum.ULTRA_DEATH, (Aspect) MagicBeesAPI.thaumcraftAspectTempus)' not in tags or 'RULES.put("dust"' not in helper:raise ValueError('changed Rhugnor aspects')
    emit('essentiaDistill',{imp.material('GTPP_Rhugnor','dust'):1,'coal':1},{aspect('ULTRA_DEATH'):2,aspect('TEMPUS'):1,aspect('ENTROPY'):1})
    raw=read('com/dreammaster/scripts/ScriptTCCoreMod.java')
    eminence=study('EMINENCESTONE','卓越之石',{imp.material('Thaumium','plate'):4,imp.material('EnderPearl','plate'):2},infusion)
    oculus=study('OCULUS','灵视',{mod('Thaumcraft','ItemEldritchObject',0):1},infusion)
    millennium=study('PORTALMILLENIUM','千年传送门',{aspect('ELDRITCH'):15,aspect('SENSES'):12,aspect('EARTH'):9},[eminence,oculus])
    deepdark=study('PORTALDEEPDARK','深暗之域',{aspect('VOID'):27,aspect('TEMPUS'):24,aspect('LUST'):21,aspect('GLUTTONY'):12,aspect('PRIDE'):9},[millennium,ichorResearch])
    imp.active_file='NewHorizonsCoreMod/com/dreammaster/scripts/ScriptTCCoreMod.java'
    call=re.search(r'TCHelper.addInfusionCraftingRecipe\(\s*"PORTALDEEPDARK",',raw)
    begin=raw.index('(',call.start());args=split(raw[begin+1:matching(raw,begin)])
    ins=Counter()
    for expr in args[4:]:
        id,n=imp.stack(expr);ins[id]+=n
    counts=re.findall(r'\.add\((?:Aspect\.|DarkAspects\.|Lucrum\.)(\w+),\s*(\d+)\)',args[3])
    counts.extend(('TEMPUS',n) for n in re.findall(r'\.add\(\(Aspect\) MagicBeesAPI.thaumcraftAspectTempus,\s*(\d+)\)',args[3]))
    if len(counts)!=7 or any(int(n)!=512 for key,n in counts) or numeric(args[2])!=32:raise ValueError('changed Deep Dark infusion')
    for key,n in counts:ins[aspect(key)]+=int(n)
    out,n=imp.stack(args[1]);portal=out
    r=emit('thaumicInfusion',dict(ins),{out:n},600,{deepdark:1},{'instability':32})
    if r:r['origin']['line']=raw.count('\n',0,call.start())+1
    # GC registers its lunar cheese ore under the same oreCheese dictionary.
    gc=root/'.local/gtnh-technology/Galacticraft-3.4.37/micdoodle8/mods/galacticraft/core/blocks/GCBlocks.java'
    gcraw=gc.read_text(encoding='utf-8')
    if '"oreCheese", (ItemStack)new ItemStack(blockMoon, 1, 2)' not in gcraw:raise ValueError('changed lunar cheese ore registration')
    imp.paths['Galacticraft-3.4.37/GCBlocks.java']=hashlib.sha256(gc.read_bytes()).hexdigest()
    cheese=imp.material('Cheese','ore');used.add(cheese)
    reference={'essentia':essence,'jar':jarid,'lifeEssence':lp,
      'research':{'infusion':infusion,'dimensions':dimensions,'ichor':ichorResearch,'ichorium':ichoriumResearch,'demon':demon,'eldritch':eldritch,'deepdark':deepdark},
      'resources':{'netherShard':nether,'endShard':end,'soulSand':soulSand,'taint':taint,
        'prideShard':sins['PRIDE'],'lustShard':sins['LUST'],'gluttonyShard':sins['GLUTTONY'],'cheeseOre':cheese,'deepdarkPortal':portal,
        'pearl':mod('Thaumcraft','ItemEldritchObject',3),'eldritchEye':mod('Thaumcraft','ItemEldritchObject',0),
        'demonBloodShard':mod('BloodMagic','demonBloodShard'),'lifeShard':mod('BloodMagic','bloodMagicBaseItems',28),'soulShard':mod('BloodMagic','bloodMagicBaseItems',29),
        'orderShard':mod('Thaumcraft','ItemShard',4)},
      'adaptations':['Research uses consumed physical samples and paper, with reusable parent notes, instead of the Thaumcraft research-point puzzle. ICHOR/ICHORIUM cannot skip these studies.',
        'Essentia distillation retains the checked item aspects; coal per item, 10-second duration and compact station costs are idle adaptations. One essence unit is represented as one container unit.',
        'The arcane station bundles a 150-vis aura interface for each primal aspect; each recharges at 0.5/s only while enabled. Ichorium spends 125 of every primal aspect once per batch. Wand types, aura coordinates and flux are not simulated.',
        'Blood altar T5 retains the real Ichorium block, tier, 50,000 LP and 20 LP/t. Altar deployment and repeatable LP encounters replace player-health and rune-world simulation; ritual summons and combat are adapted encounters, not the full demon invasion.',
        'Deep Dark portal retains compressed Bedrockium, four UIV field generators, four eternal singularities, seven aspects at 512 each and instability 32. Eminence/Oculus/Millennium/Deep Dark parent research uses compact paid sample notes, not the research puzzle or their separate production recipes. Instability is a displayed capacity condition, not a simulated flux/failure world.',
        'Sin collection is an authored encounter with equal exclusive Pride/Lust/Gluttony shard outcomes, gated by demon and eldritch study. Original situational Nether kill/food/weapon triggers are not simulated. Distillation keeps the exact installed shard aspects. Bowl distillation retains only its guaranteed added Void aspect; inferred recipe aspects are discarded.',
        'Lunar cheese mining normalizes Galacticraft moon ore metadata 2 (oreCheese) to the common GT ore identity for existing ore-processing recipes, with one collected ore and no fortune bonus.']}
    used.update(reference['resources'].values());used.update(reference['research'].values());used.add(lp)
    # These subtype resources register individual sprites rather than a
    # texture named after their registry. Preserve metadata and trace originals.
    visual=[(jarid,'源质罐','thaumcraft/blocks/jar_side'),(taint,'污秽黏液','thaumcraft/items/taint_slime'),
      (reference['resources']['eldritchEye'],'邪术之眼','thaumcraft/items/eldritch_object'),
      (reference['resources']['pearl'],'元始珍珠','thaumcraft/items/eldritch_object_3'),
      (reference['resources']['orderShard'],'秩序碎片','thaumcraft/items/shard'),
      (reference['resources']['demonBloodShard'],'恶魔血碎片','alchemicalwizardry/items/DemonBloodShard'),
      (reference['resources']['lifeShard'],'生命碎片','alchemicalwizardry/items/baseItemLifeShard'),
      (reference['resources']['soulShard'],'灵魂碎片','alchemicalwizardry/items/baseItemSoulShard'),
      (portal,'深暗之域传送门','extrautils/blocks/dark_portal')]
    for meta,(name,sprite) in enumerate([('灵宝','ichor'),('灵宝布','ichorCloth'),('灵宝金属锭','ichorium'),('灵宝粒','ichorNugget'),('灵宝杖端','ichorCap'),('灵宝布杖柄','ichorclothRod'),('下界维度碎片','netherShard'),('末地维度碎片','enderShard')]):
        visual.append((mod('ThaumicTinkerer','kamiResource',meta),name,'ttinkerer/items/'+sprite))
    for key,name in [('PRIDE','傲慢碎片'),('LUST','欲望碎片'),('GLUTTONY','饕餮碎片')]:imp.items[sins[key]]['name']=name
    for id in essence.values():imp.items[id]['icon']=jarid
    for id in list(imp.items):
        if id.startswith('magicResearch_'):
            imp.items[id].pop('icon',None)
            imp.items[id]['nativeItem']={'texture':'assets/thaumcraft/textures/items/researchnotes.png'}
    for id,name,sprite in visual:
        domain,relative=sprite.split('/',1)
        imp.items[id]['name']=name
        imp.items[id]['nativeItem']['texture']='assets/'+domain+'/textures/'+relative+'.png'
    # Fail on typos and keep the exact original icon bytes in provenance.
    textures={imp.items[id]['nativeItem']['texture'] for id,_,_ in visual}|{'assets/thaumcraft/textures/items/researchnotes.png'}
    for file in (imp.instance/'.minecraft/mods').glob('*.jar'):
        if not textures:break
        with zipfile.ZipFile(file) as archive:
            for texture in textures.intersection(archive.namelist()):
                imp.paths[file.name+'/'+texture]=hashlib.sha256(archive.read(texture)).hexdigest()
                textures.remove(texture)
    if textures:raise ValueError('missing magical item sprites: '+str(sorted(textures)))
    (root/'src/data/magic-reference.js').write_text('// Generated by scripts/gtnh-magic-sources.py.\nexport const MAGIC_REFERENCE='+json.dumps(reference,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    return used

