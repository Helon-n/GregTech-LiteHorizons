"""Import literal Core casting registrations, including consumed mold forms.

Tinkers molten metals share the corresponding GT material in this 2D port;
this is explicit fluid compatibility, not a conversion yielding extra fluid.
Melting is implemented separately; world structure is an idle adaptation.
"""
import hashlib
import json
import re


def generate(imp,root,split_args,matching,numeric,scopes_at):
    sources={};unresolved=[];count=0;used=set()
    def source(path,label):
        sources[label]=hashlib.sha256(path.read_bytes()).hexdigest()
        return path.read_text(encoding='utf-8')
    directory=root/'.local/gtnh-technology/TConstruct-1.14.123/tconstruct/smeltery'
    smeltery=source(directory/'TinkerSmeltery.java','TConstruct-1.14.123/TinkerSmeltery.java')
    source(directory/'blocks/SearedBlock.java','TConstruct-1.14.123/SearedBlock.java')
    jar=imp.instance/'.minecraft/mods/TConstruct-1.14.123-GTNH.jar'
    sources['instance/mods/'+jar.name]=hashlib.sha256(jar.read_bytes()).hexdigest()
    devices={}
    for key,meta,texture,title in [('table',0,'castingtable_top','浇铸台'),('basin',2,'blockcast_top','浇铸盆')]:
        native={'name':title,'registry':imp.mod_ids['TinkerConstruct']+':SearedBlock','meta':meta,'texture':'assets/tinker/textures/blocks/'+texture+'.png'}
        imp.external_item_metadata[(native['registry'],meta)]=native
        devices[key]=imp.stack(f'getModItem(TinkerConstruct.ID,"SearedBlock",1,{meta})')[0];used.add(devices[key])
    cfg=imp.instance/'.minecraft/config/TinkersConstruct.cfg'
    config=source(cfg,'instance/config/TinkersConstruct.cfg')
    pattern_source=imp.core/'com/dreammaster/tinkersConstruct/SmelteryFluidTypes.java'
    pattern_types=source(pattern_source,'NewHorizonsCoreMod/com/dreammaster/tinkersConstruct/SmelteryFluidTypes.java')
    pattern_type=re.search(r'S:"Metal cast FluidType"=(\w+)',config)
    pattern_registry=re.search(r'String getMoltenPatternFluidName\(\)\s*\{\s*return "([^\"]+)";',pattern_types)
    if not pattern_type or pattern_type[1]!='Brass' or not pattern_registry:raise ValueError('unresolved pattern fluid configuration')
    # TConstruct's own default registration is not a Core addCastingRecipe
    # call. It is the bootstrap source for Core's consumed GT mold forms.
    blank=re.search(r'tableCasting.addCastingRecipe\(new ItemStack\(TinkerTools.blankPattern, 1, 1\), new FluidStack\(TinkerSmeltery.metalPatternFluidType.fluid, (\d+)\), (\d+)\);',smeltery)
    if not blank:raise ValueError('missing native blank metal pattern casting')
    imp.active_file='TConstruct-1.14.123/TinkerSmeltery.java';imp.constants={}
    out=imp.stack('getModItem(TinkerConstruct.ID,"blankPattern",1,1)')[0]
    imp.items[out]['nativeItem'].update(texture='assets/tinker/textures/items/materials/blank_cast.png')
    brass=imp.stack('FluidRegistry.getFluidStack("'+pattern_registry[1]+'",1)')[0]
    recipe=imp.emit_recipe('tableCast',{brass:int(blank[1])},{out:1},int(blank[2]),0,smeltery.count('\n',0,blank.start())+1,{}, {},[],None)
    if recipe:
        recipe.update(stage=1,casting={'vessel':'table','consumed':False,'fluidCompatibilityAdapted':True});count+=1
    for path in sorted((imp.core/'com/dreammaster').rglob('*.java')):
        raw=path.read_text(encoding='utf-8')
        if '.addCastingRecipe(' not in raw:continue
        label='NewHorizonsCoreMod/'+str(path.relative_to(imp.core)).replace('\\','/')
        source(path,label)
        text=re.sub(r'/\*.*?\*/|//[^\n]*',lambda m:'\n'*m[0].count('\n'),raw,flags=re.S)
        calls=list(re.finditer(r'TConstructRegistry\.get(Table|Basin)Casting\(\)\.addCastingRecipe\(',text))
        scopes=scopes_at(text,[m.start() for m in calls])
        for m in calls:
            line=text.count('\n',0,m.start())+1
            try:
                for start in scopes[m.start()]:
                    header=text[max(0,start-400):start]
                    control=re.search(r'\b(if|for|while|switch)\s*(\([^{}]*\))\s*$',header)
                    if control and not (control[1]=='if' and re.fullmatch(r'\(\s*TinkerConstruct.isModLoaded\(\)\s*\)',control[2])):
                        raise ValueError('conditional casting registration needs expansion')
                imp.active_file=label;imp.constants={}
                end=matching(text,m.end()-1);args=split_args(text[m.end():end])
                if len(args) not in (3,4,5):raise ValueError('unsupported casting overload')
                out=imp.stack(args[0]);fluid_expression=args[1]
                fluid_expression=fluid_expression.replace('SmelteryFluidTypes.getMoltenPatternFluidName()',json.dumps(pattern_registry[1]))
                native_fluid=re.fullmatch(r'FluidRegistry.getFluidStack\("([\w]+)\.molten",\s*(.+)\)',fluid_expression,re.S)
                if native_fluid:
                    name={'aluminum':'aluminium'}.get(native_fluid[1],native_fluid[1])
                    key=next((k for k,v in imp.materials.items() if v['registry'].lower()==name.lower() or k.lower()==name.lower()),None)
                    if not key:raise ValueError('unresolved TConstruct molten material '+native_fluid[1])
                    fluid=(imp.material(key,'molten'),numeric(native_fluid[2]))
                else:fluid=imp.stack(fluid_expression)
                if not fluid or imp.items[fluid[0]]['kind']!='fluid' or not out or imp.items[out[0]]['kind']=='fluid':raise ValueError('invalid casting operands')
                if 'bucket' in imp.items[out[0]].get('nativeItem',{}).get('registry','').lower():raise ValueError('filled casting bucket requires container contents')
                cast=imp.stack(args[2]) if len(args)>3 and args[2].strip()!='null' else None
                consumed=args[3].strip() if len(args)==5 else 'false'
                if consumed not in ('true','false'):raise ValueError('dynamic casting consumption')
                inputs={fluid[0]:fluid[1]};tools={}
                if cast:
                    if imp.items[cast[0]]['kind']=='fluid':raise ValueError('nonphysical casting form')
                    (inputs if consumed=='true' else tools)[cast[0]]=cast[1]
                ticks=numeric(args[-1])
                r=imp.emit_recipe('tableCast' if m[1]=='Table' else 'basinCast',inputs,{out[0]:out[1]},ticks,0,line,tools,{},[],None)
                if r:
                    r.update(stage=1,casting={'vessel':m[1].lower(),'consumed':consumed=='true','fluidCompatibilityAdapted':bool(native_fluid)})
                    count+=1
            except (ValueError,KeyError,SyntaxError,TypeError,IndexError) as error:
                unresolved.append({'file':label,'line':line,'reason':str(error)[:220]})
    imp.paths.update(sources)
    data={'devices':devices,'recipes':count,'unresolved':unresolved,'sourceFiles':sources}
    (root/'src/data/casting-reference.js').write_text('// Generated by scripts/gtnh-casting.py.\nexport const CASTING_REFERENCE='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    return used
