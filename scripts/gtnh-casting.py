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
    # These recipes are registered by TConstruct's ore-dictionary helpers,
    # not by Core's literal addCastingRecipe calls. Without the helpers the
    # imported casting recipes require casts that have no production source.
    native_label='TConstruct-1.14.123/TinkerSmeltery.java'
    helper=re.search(r'public static void addMetalPatternCastingTableRecipe\([^{}]+\)\s*\{(.*?)\n    \}',smeltery,re.S)
    brass_cast=re.search(r'new FluidStack\(TinkerSmeltery.metalPatternFluidType.fluid, (\d+)\), shape, delay',helper[1] if helper else '')
    gold_cast=re.search(r'new FluidStack\(moltenGoldFluid, (\d+)\), shape, delay',helper[1] if helper else '')
    gold_enabled=re.search(r'B:"Remove Gold Cast Recipes"=(true|false)',config)
    if not brass_cast or not gold_cast or not gold_enabled:raise ValueError('changed native metal cast helper/configuration')
    registered={
        {'Aluminum':'Aluminium'}.get(name,name)
        for name in re.findall(r'FluidType.registerFluidType\("(\w+)"',smeltery)
    }
    registered.update(re.findall(r'registerFluidType\("(\w+)"',pattern_types))
    registered.add(pattern_type[1])
    # Limit this expansion to the GT bootstrap metals. Other TConstruct
    # forms (notably raw aluminium) require their own item/override mapping.
    metals=registered.intersection({'Iron','Gold','Copper','Tin','Bronze','Steel','Brass','Zinc'})
    # Core removes some native casting outputs and replaces others with GT
    # stacks/delays. Do not restore the removed recipes or duplicate overrides.
    overridden={id for r in imp.recipes if r['process']=='tableCast' for id in r['outputs']}
    removed=set()
    for path in sorted((imp.core/'com/dreammaster').rglob('*.java')):
        text=path.read_text(encoding='utf-8')
        for match in re.finditer(r'TConstructHelper\.removeTableRecipe\(',text):
            end=matching(text,match.end()-1)
            item=imp.stack(text[match.end():end])
            if item:removed.add(item[0])
    imp.active_file=native_label;imp.constants={}
    for prefix,meta in [('ingot',0),('nugget',27)]:
        method=re.search(r'private void register'+prefix.title()+r'Casting\([^{}]+\)\s*\{(.*?)\n    \}',smeltery,re.S)
        registration=re.search(r'addMetalPatternCastingTableRecipe\(tableCasting, pattern, '+prefix+r', (\d+)\)',method[1] if method else '')
        product=re.search(r'tableCasting.addCastingRecipe\('+prefix+r', new FluidStack\(ft.fluid, (\d+)\), pattern, (\d+)\)',method[1] if method else '')
        if not registration or not product:raise ValueError('changed native dictionary casting helper '+prefix)
        cast=imp.stack(f'getModItem(TinkerConstruct.ID,"metalPattern",1,{meta})')[0]
        for material in sorted(metals):
            if material not in imp.materials or not imp.materials[material]['metal']:continue
            shape=imp.material(material,prefix)
            for fluid,amount in [(brass,int(brass_cast[1]))]+([(imp.material('Gold','molten'),int(gold_cast[1]))] if gold_enabled[1]=='false' else []):
                line=smeltery.count('\n',0,helper.start())+1
                r=imp.emit_recipe('tableCast',{fluid:amount},{cast:1},int(registration[1]),0,line,{shape:1},{},[],None)
                if r:
                    r.update(stage=1,casting={'vessel':'table','consumed':False,'fluidCompatibilityAdapted':True});count+=1
            if shape not in overridden and shape not in removed:
                line=smeltery.count('\n',0,method.start())+1
                r=imp.emit_recipe('tableCast',{imp.material(material,'molten'):int(product[1])},{shape:1},int(product[2]),0,line,{cast:1},{},[],None)
                if r:
                    r.update(stage=1,casting={'vessel':'table','consumed':False,'fluidCompatibilityAdapted':True});count+=1
    imp.paths.update(sources)
    data={'devices':devices,'recipes':count,'unresolved':unresolved,'sourceFiles':sources}
    (root/'src/data/casting-reference.js').write_text('// Generated by scripts/gtnh-casting.py.\nexport const CASTING_REFERENCE='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    return used
