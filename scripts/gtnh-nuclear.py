"""Extract actual IC2/GT reactor components, not the NEI display recipes.

Source is read offline. Layout, two-pass heat/pulse order, one-second reactor
steps and the installed nuclear multiplier are implemented by core/nuclear.js.
"""
import configparser
import hashlib
import json
import re


def generate(imp,root,split_args,matching,numeric):
    sources={};parts={};used=set()
    def read(path,label):
        sources[label]=hashlib.sha256(path.read_bytes()).hexdigest()
        return path.read_text(encoding='utf-8')
    directory=root/'.local/gtnh-technology/ic2-2.2.828/ic2/core'
    blocks=read(directory/'init/BlocksItems.java','IC2-2.2.828/BlocksItems.java')
    for name in ('Uranium','MOX','HeatStorage','Vent','VentSpread','HeatSwitch','Reflector','Plating','Condensator','LithiumCell'):
        read(directory/f'item/reactor/ItemReactor{name}.java',f'IC2-2.2.828/ItemReactor{name}.java')
    read(directory/'item/ItemGradual.java','IC2-2.2.828/ItemGradual.java')
    read(directory/'block/reactor/tileentity/TileEntityNuclearReactorElectric.java','IC2-2.2.828/TileEntityNuclearReactorElectric.java')
    def ic2(key):
        id=imp.stack('GTModHandler.getIC2Item("'+key+'",1)')[0];used.add(id);return id
    for m in re.finditer(r'Ic2Items\.(\w+)\s*=\s*new ItemStack\(\(Item\)new ItemReactor(\w+)\(',blocks):
        end=matching(blocks,m.end()-1);args=split_args(blocks[m.end():end])
        kind=m[2];id=ic2(m[1]);n=[numeric(a) for a in args[1:]]
        if kind in ('Uranium','MOX'):
            depleted=m[1].replace('reactor','reactorDepleted',1)
            spec={'kind':'fuel','cells':n[0],'capacity':10000 if kind=='MOX' else 20000,'energy':1,'heat':4,'mox':kind=='MOX','heatBonus':4,'depleted':ic2(depleted)}
        elif kind=='HeatStorage':spec={'kind':'storage','capacity':n[0]}
        elif kind=='Vent':spec={'kind':'vent','capacity':n[0],'selfVent':n[1],'reactorVent':n[2]}
        elif kind=='VentSpread':spec={'kind':'spread','sideVent':n[0]}
        elif kind=='HeatSwitch':spec={'kind':'exchanger','capacity':n[0],'side':n[1],'reactor':n[2]}
        elif kind=='Reflector':spec={'kind':'reflector','capacity':n[0]}
        elif kind=='Plating':spec={'kind':'plating','heatAdd':n[0],'effectModifier':n[1]}
        elif kind=='Condensator':spec={'kind':'condensator','capacity':n[0]+1}
        elif kind=='LithiumCell':spec={'kind':'breeder','capacity':10000,'step':3000,'multiplier':1,'deflector':True,'depleted':ic2('TritiumCell')}
        else:raise ValueError('Unknown nuclear component '+kind)
        parts[id]=spec
    label='gregtech/loaders/preload/LoaderGTBlockFluid.java'
    text=read(imp.source/label,label)
    for m in re.finditer(r'ItemList\.(\w+)\s*\.set\(\s*new (ItemRadioactiveCellIC|ItemCoolantCellIC|ItemBreederCell|ItemNeutronReflector)\(',text):
        end=matching(text,m.end()-1);args=split_args(text[m.end():end]);id=imp.named(m[1]);used.add(id)
        if m[2]=='ItemRadioactiveCellIC':
            depleted=imp.stack(args[7])[0];used.add(depleted)
            parts[id]={'kind':'fuel','cells':numeric(args[2]),'capacity':numeric(args[3]),'energy':numeric(args[4]),'heat':numeric(args[6]),'depleted':depleted,'mox':args[8]=='true','heatBonus':numeric(args[9])}
        elif m[2]=='ItemCoolantCellIC':parts[id]={'kind':'storage','capacity':numeric(args[2]),'gtCoolant':True}
        elif m[2]=='ItemNeutronReflector':parts[id]={'kind':'reflector'}
        else:
            product=args[6].split('->',1)[1].strip();depleted=imp.stack(product)[0];used.add(depleted)
            parts[id]={'kind':'breeder','step':numeric(args[3]),'multiplier':numeric(args[4]),'capacity':numeric(args[5]),'depleted':depleted,'deflector':'.setDeflector()' in text[end:end+100].split(';')[0]}
    for name in ('ItemRadioactiveCellIC','ItemCoolantCellIC','ItemBreederCell'):
        label=f'gregtech/api/items/{name}.java';read(imp.source/label,label)
    label='gregtech/common/items/ItemNeutronReflector.java';read(imp.source/label,label)
    def block(registry,meta,texture):
        id=imp.stack(f'getModItem(IndustrialCraft2.ID,"{registry}",1,{meta})')[0]
        imp.items[id]['nativeItem']['texture']='assets/ic2/textures/blocks/'+texture+'.png';used.add(id);return id
    controller=block('blockGenerator',5,'generator/blockNuclearReactor')
    chamber=block('blockReactorChamber',0,'reactor/blockReactorChamber')
    vessel=block('blockreactorvessel',0,'reactor/blockreactorvessel')
    port=block('blockReactorFluidPort',0,'reactor/blockReactorFluidPort')
    hatch=block('blockReactorAccessHatch',0,'reactor/blockReactorAccessHatch')
    redstone=block('blockReactorRedstonePort',0,'reactor/blockReactorRedstonePort')
    cold=imp.stack('GTModHandler.getIC2Coolant(1)')[0];hot=imp.stack('GTModHandler.getHotCoolant(1)')[0];used|={cold,hot}
    repair_label='NewHorizonsCoreMod/com/dreammaster/scripts/ScriptIndustrialCraft.java'
    repair_text=read(imp.core/'com/dreammaster/scripts/ScriptIndustrialCraft.java',repair_label)
    repairs={}
    for key,material in [('reactorCondensator','RedAlloy'),('reactorCondensatorLap','Lapis')]:
        pattern=r'addShapelessRecipe\(\s*getModItem\(IndustrialCraft2.ID, "'+key+r'", 1, 1\),\s*getModItem\(IndustrialCraft2.ID, "'+key+r'", 1, wildcard\),((?:\s*"dust'+material+r'"\s*,?)+)\);'
        repair=re.search(pattern,repair_text)
        if not repair:raise ValueError('Missing original condenser repair: '+key)
        dust=imp.material(material,'dust');used.add(dust)
        repairs[ic2(key)]={dust:len(re.findall(r'"dust'+material+r'"',repair[1]))}
    config=imp.instance/'.minecraft/config/IC2.ini';settings=configparser.ConfigParser(interpolation=None,strict=False);settings.read(config,encoding='utf-8')
    sources['instance/config/IC2.ini']=hashlib.sha256(config.read_bytes()).hexdigest()
    data={'controller':controller,'chamber':chamber,'fluidStructure':{vessel:94,port:2,hatch:1,redstone:1},'cold':cold,'hot':hot,'repairs':repairs,'euMultiplier':5*settings.getfloat('balance / energy / generator','nuclear'),'huMultiplier':2*settings.getfloat('balance / energy / FluidReactor','outputModifier'),'generatorEnabled':settings.getfloat('balance / energy / generator','generator')>0,'rows':6,'baseColumns':3,'maxColumns':9,'baseHeat':10000,'tickSeconds':1,'tankCapacity':10000,'parts':parts,'sourceFiles':sources}
    # Depleted rods/breeder products remain removable physical objects in slots.
    for id in list(parts):
        if parts[id].get('depleted'):parts.setdefault(parts[id]['depleted'],{'kind':'spent'})
    imp.paths.update(sources)
    (root/'src/data/nuclear-reference.js').write_text('// Generated by scripts/gtnh-nuclear.py.\nexport const NUCLEAR_REFERENCE='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    return used
