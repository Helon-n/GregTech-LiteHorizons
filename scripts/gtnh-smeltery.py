"""Offline TConstruct melting registrations with Core removals/overrides.

The app models one working slot per prepared smeltery. Temperature increments
and fuel heat/time are kept independent of GT EU and electric extraction.
"""
import hashlib
import json
import math
import re


def generate(imp,root,split_args,matching,numeric):
    sources={};unresolved=[];melting={};used=set();fuels=[]
    def read(path,label):
        sources[label]=hashlib.sha256(path.read_bytes()).hexdigest()
        return path.read_text(encoding='utf-8')
    directory=root/'.local/gtnh-technology/TConstruct-1.14.123/tconstruct'
    native_label='TConstruct-1.14.123/TinkerSmeltery.java'
    native=read(directory/'smeltery/TinkerSmeltery.java',native_label)
    read(directory/'smeltery/logic/SmelteryLogic.java','TConstruct-1.14.123/SmelteryLogic.java')
    read(directory/'library/crafting/Smeltery.java','TConstruct-1.14.123/Smeltery.java')
    read(directory/'smeltery/blocks/SmelteryBlock.java','TConstruct-1.14.123/SmelteryBlock.java')
    tank_logic=read(directory/'smeltery/logic/LavaTankLogic.java','TConstruct-1.14.123/LavaTankLogic.java')
    read(directory/'smeltery/blocks/LavaTankBlock.java','TConstruct-1.14.123/LavaTankBlock.java')
    tank_capacity=re.search(r'new FluidTank\((\d+)\)',tank_logic)
    if not tank_capacity:raise ValueError('unresolved native smeltery fuel tank capacity')
    core_label='NewHorizonsCoreMod/com/dreammaster/scripts/ScriptTinkersConstruct.java'
    core=read(imp.core/'com/dreammaster/scripts/ScriptTinkersConstruct.java',core_label)
    read(imp.core/'com/dreammaster/tinkersConstruct/MeltingRecipeAdder.java','NewHorizonsCoreMod/MeltingRecipeAdder.java')
    types={}
    for m in re.finditer(r'FluidType.registerFluidType\("(\w+)",[^;]+?\);',native):
        args=split_args(m[0][m[0].index('(')+1:-2])
        if len(args)!=6:continue
        name=m[1]
        material={'Aluminum':'Aluminium'}.get(name,name)
        if material not in imp.materials:continue
        try:temperature=numeric(args[3])
        except (ValueError,SyntaxError):continue
        types[name]=(material,temperature)
    # Core replaces the pattern type with real GT brass and registers zinc.
    for name in ('Brass','Zinc'):types[name]=(name,350)
    def fluid(expression):
        s=re.sub(r'\s+','',expression)
        m=re.fullmatch(r'FluidRegistry.getFluidStack\("(\w+)\.molten",(.+)\)',s)
        if m:
            name={'aluminum':'Aluminium'}.get(m[1],next((k for k,v in imp.materials.items() if v['registry'].lower()==m[1].lower()),None))
            if not name:raise ValueError('unknown molten material '+m[1])
            return imp.material(name,'molten'),numeric(m[2])
        return imp.stack(s)
    def add(expression,out,temperature,label,line):
        item=imp.stack(expression)
        if not item or item[1]!=1 or imp.items[item[0]]['kind']=='fluid':raise ValueError('melting needs one registered physical input')
        if not out or imp.items[out[0]]['kind']!='fluid' or out[1]<=0 or temperature<=20:raise ValueError('invalid melting result or temperature')
        melting[item[0]]={'out':out,'temperature':temperature,'origin':{'file':label,'line':line}}
    exceptions={'Water','Stone','Emerald','Quartz','Ender','Glass','Slime','Obsidian'}
    imp.constants={}
    # Only existing GT forms are represented here. Ore and host-rock variants
    # need the Core helper's explicit yields; they are not guessed from names.
    for name,(material,temperature) in types.items():
        if name in exceptions:continue
        m=imp.materials[material]
        for prefix,offset,amount in [('nugget',-100,16),('ingot',-50,144),('dust',-75,144),('block',100,1296)]:
            if prefix=='dust' and not m['dust'] or prefix!='dust' and not m['metal']:continue
            marker='Smeltery.addDictionaryMelting("'+prefix+'" + fluidTypeName'
            line=native.count('\n',0,native.index(marker))+1
            add('GTOreDictUnificator.get(OrePrefixes.'+prefix+',Materials.'+material+',1)',(imp.material(material,'molten'),amount),temperature+offset,native_label,line)
    # Apply the pack script in source order. A later registration replaces
    # the earlier one for the same stack, as Smeltery's maps do at runtime.
    stripped=re.sub(r'/\*.*?\*/|//[^\n]*',lambda m:'\n'*m[0].count('\n'),core,flags=re.S)
    ore_lists={}
    for material,var in re.findall(r'addOresForMaterial\(Materials\.(\w+),\s*(\w+)\)',stripped):
        ore_lists.setdefault(var,[]).extend('GTOreDictUnificator.get(OrePrefixes.'+p+',Materials.'+material+',1)' for p in ('rawOre','ore'))
    calls=re.finditer(r'TConstructHelper\.(removeMeltingRecipe|getMeltingAdder)\(|Smeltery\.addMelting\(',stripped)
    imp.active_file=core_label
    for call in calls:
        line=stripped.count('\n',0,call.start())+1
        try:
            end=matching(stripped,call.end()-1);args=split_args(stripped[call.end():end])
            if call[1]=='removeMeltingRecipe':
                item=imp.stack(args[0])
                if item:melting.pop(item[0],None)
            elif call[1]=='getMeltingAdder':
                if len(args)!=3:raise ValueError('unsupported melting helper overload')
                type_name=re.fullmatch(r'FluidType.getFluidType\("(\w+)"\)',re.sub(r'\s+','',args[0]))
                if not type_name and re.sub(r'\s+','',args[0])=='FluidType.getFluidType(getMoltenPatternFluidTypeName())':type_name=['','Brass']
                if not type_name or type_name[1] not in types:raise ValueError('unknown melting fluid type '+args[0])
                material,base_temp=types[type_name[1]];temp=base_temp+numeric(args[1]);amount=numeric(args[2])
                tail=stripped[end+1:stripped.index(';',end)]
                pos=0
                while pos<len(tail):
                    method=re.search(r'\.(add|withAmount|smelteryGroup)\s*\(',tail[pos:])
                    if not method:break
                    begin=pos+method.end()-1;stop=matching(tail,begin);operands=split_args(tail[begin+1:stop]);pos=stop+1
                    if method[1]=='withAmount':amount=numeric(operands[0])
                    elif method[1]=='add':
                        for operand in operands:
                            for expression in ore_lists.get(operand,[operand]):
                                try:add(expression,(imp.material(material,'molten'),amount),temp,core_label,line)
                                except (ValueError,KeyError,SyntaxError) as error:unresolved.append({'file':core_label,'line':line,'reason':str(error)[:220]})
            else:
                if len(args)!=5:raise ValueError('unsupported direct melting overload')
                add(args[0],fluid(args[-1]),numeric(args[-2]),core_label,line)
        except (ValueError,KeyError,SyntaxError,IndexError,TypeError) as error:
            unresolved.append({'file':core_label,'line':line,'reason':str(error)[:220]})
    lava=re.search(r'Smeltery.addSmelteryFuel\(FluidRegistry.LAVA, (\d+), (\d+)\)',native)
    if not lava:raise ValueError('missing smeltery lava fuel')
    fuels.append({'id':imp.stack('FluidRegistry.getFluidStack("lava",1)')[0],'temperature':int(lava[1]),'ticks':int(lava[2])})
    for m in re.finditer(r'Smeltery.addSmelteryFuel\(FluidRegistry.getFluid\("([^\"]+)"\),\s*(\d+),\s*(\d+)\)',core):
        fuels.append({'id':fluid('FluidRegistry.getFluidStack("'+m[1]+'",1)')[0],'temperature':int(m[2]),'ticks':int(m[3])})
    for fuel in fuels:used.add(fuel['id'])
    count=0
    for item,spec in melting.items():
        capable=next((f for f in fuels if f['temperature']>=spec['temperature']),None)
        if not capable:
            unresolved.append({**spec['origin'],'reason':'no registered fuel can reach '+str(spec['temperature'])});continue
        # One extra heating phase melts an already heated stack.
        ticks=4*(math.ceil((spec['temperature']*10-200)/(capable['temperature']//100))+1)
        imp.active_file=spec['origin']['file']
        recipe=imp.emit_recipe('smelteryMelt',{item:1},{spec['out'][0]:spec['out'][1]},ticks,0,spec['origin']['line'],{}, {},[],None)
        if recipe:recipe.update(stage=1,smeltery={'temperature':spec['temperature'],'referenceFuel':capable['id']});count+=1
    devices={}
    for key,registry,meta,texture in [('controller','Smeltery',0,'smeltery_inactive'),('brick','Smeltery',2,'searedbrick'),('drain','Smeltery',1,'drain_out'),('tank','LavaTank',0,'lavatank_side')]:
        native={'name':key,'registry':imp.mod_ids['TinkerConstruct']+':'+registry,'meta':meta,'texture':'assets/tinker/textures/blocks/'+texture+'.png'}
        imp.external_item_metadata[(native['registry'],meta)]=native
        item=imp.stack(f'getModItem(TinkerConstruct.ID,"{registry}",1,{meta})')[0]
        imp.items[item]['nativeItem']=native;devices[key]=item;used.add(item)
    imp.paths.update(sources)
    data={'devices':devices,'fuels':fuels,'fuelTankCapacity':int(tank_capacity[1]),'recipes':count,'unresolved':unresolved,'sourceFiles':sources,'adaptation':'One working slot per prepared 1x1 chamber; molten outputs use explicit external containers. Independent chambers provide parallelism.'}
    (root/'src/data/smeltery-reference.js').write_text('// Generated by scripts/gtnh-smeltery.py.\nexport const SMELTERY_REFERENCE='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    return used
