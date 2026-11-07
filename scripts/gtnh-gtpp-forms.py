"""GT++ material-generator recipes, using only resolved registrations.

Constructor metrics follow Material.java (including its unweighted averages
and original boilingPoint test when assigning neutrons). Unknown parameters
are recorded, never filled using an arbitrary mass, voltage or recipe.
"""
import hashlib
import math
import re


def generate(imp,needed,numeric,split_args,matching):
    directory='gtPlusPlus/xmod/gregtech/loaders/'
    def read(label):
        path=imp.source/label;imp.paths[label]=hashlib.sha256(path.read_bytes()).hexdigest()
        return path.read_text(encoding='utf-8')
    read('gtPlusPlus/core/material/Material.java')
    read('gtPlusPlus/core/material/MaterialGenerator.java')
    read('gtPlusPlus/core/util/minecraft/MaterialUtils.java')
    read('gtPlusPlus/core/material/MaterialStack.java')
    read('bartworks/system/material/gtenhancement/PlatinumSludgeOutputs.java')
    text=read('gregtech/loaders/materials/MaterialsInit.java')
    element_text=read('gregtech/api/enums/Element.java')
    elements={key:(int(p),int(n)) for key,p,n in re.findall(r'^\s*(\w+)\((\d+),\s*(\d+),',element_text,re.M)}
    definitions={imp.gtpp_materials[k]:v for k,v in imp.gtpp_definitions.items() if k in imp.gtpp_materials}
    cache={}
    def core(name,field,visited):
        m=imp.materials[name]
        body=re.search(r'private static Materials load'+re.escape(name)+r'\(\)\s*\{(.*?)(?=\n    private static|\Z)',text,re.S)
        if not body:raise ValueError('no core material definition: '+name)
        body=body[1]
        if field in ('melting','boiling'):
            value=re.search(r'\.set'+('Melting' if field=='melting' else 'Boiling')+r'Point\(([^)]+)\)',body)
            return numeric(value[1]) if value else 0
        if field=='blast':return m['blast']
        if field=='radiation':
            # MaterialUtils.generateMaterialFromGtENUM passes zero, and
            # creates no composite list. Do not infer isotope radiation.
            return 0
        index=0 if field=='protons' else 1
        if m['element'] in elements:return elements[m['element']][index]
        if not m['components']:return elements['Tc'][index]
        density=re.search(r'\.setDensity\(([^)]+)\)',body)
        if not m['defaultDensity'] and not density:raise ValueError('unknown density: '+name)
        numerator,denominator=map(numeric,split_args(density[1])) if density else (1,1)
        fixed=int(3628800*numerator/denominator)
        return int(fixed*sum(metric(k,field,visited)*n for k,n in m['components'])/(3628800*sum(n for k,n in m['components'])))
    def number(expr,visited):
        expr=re.sub(r'\s+','',expr)
        expr=re.sub(r'INSTANCE\.(\w+)\.(getMeltingPointC|getBoilingPointC|getProtons|getNeutrons)\(\)',
            lambda m:str(metric(imp.gtpp_materials['MaterialsElements.'+m[1]],{'getMeltingPointC':'melting','getBoilingPointC':'boiling','getProtons':'protons','getNeutrons':'neutrons'}[m[2]],visited)),expr)
        expr=re.sub(r'Materials\.(\w+)\.(getProtons\(\)|getNeutrons\(\)|mMeltingPoint|mBlastFurnaceTemp|mBlastFurnaceRequired)',
            lambda m:str(metric(m[1],{'getProtons()':'protons','getNeutrons()':'neutrons','mMeltingPoint':'melting','mBlastFurnaceTemp':'boiling','mBlastFurnaceRequired':'blast'}[m[2]],visited)).lower(),expr)
        if expr in ('true','false'):return expr=='true'
        return numeric(expr)
    def metric(name,field,visited=frozenset()):
        key=(name,field)
        if key in cache:return cache[key]
        if key in visited:raise ValueError('recursive material metric: '+name)
        visited=visited|{key}
        if name not in definitions:result=core(name,field,visited)
        else:
            args=definitions[name][0]
            # Every supported full constructor has color, followed by the
            # four numeric metrics. Keep unsupported overloads unresolved.
            blast_at=next((i for i,a in enumerate(args) if a in ('true','false') or a.endswith('.mBlastFurnaceRequired')),None)
            at=blast_at-5 if blast_at is not None else None
            if at is None or len(args)<=at+5:raise ValueError('unsupported material constructor: '+name)
            melt,boil,p,n=[number(a,visited) for a in args[at+1:at+5]]
            components=imp.materials[name]['components']
            def average(key):return int(sum(metric(k,key,visited) for k,n in components)/len(components)) if components else 0
            if field=='melting':result=melt if melt!=-1 else average(field)
            elif field=='boiling':result=boil if boil not in (-1,0) else melt*4 if boil==0 else average(field)
            elif field=='protons':result=p if p!=-1 else average(field)
            elif field=='neutrons':result=n if boil!=-1 else average(field)
            elif field=='blast':result=number(args[at+5],visited)
            elif field=='tier':result=0 if melt<1000 else int(math.floor(melt/500+.5)/2)
            elif field=='radiation':
                tail=args[at+6:];explicit=0
                if tail and not tail[0].startswith('new MaterialStack') and tail[0] not in ('true','false'):
                    # chemicalSymbol, optional radiationLevel
                    if len(tail)>1 and tail[1] not in ('true','false') and not tail[1].startswith('new MaterialStack'):explicit=number(tail[1],visited)
                result=explicit if explicit>0 else average(field)
            else:raise ValueError('unknown metric '+field)
        cache[key]=result;return result
    wire_label='gtPlusPlus/core/recipe/RecipesGeneral.java';wire_raw=read(wire_label)
    wire_materials={imp.gtpp_materials.get(ref.replace('MaterialsElements.getInstance().','MaterialsElements.')) for ref in re.findall(r'generateWireRecipes\(([\w.()]+)\)',wire_raw)}
    registrations={};extra_forms={}
    for path in (imp.source/'gtPlusPlus').rglob('*.java'):
        content=path.read_text(encoding='utf-8')
        if 'MaterialGenerator.generate' not in content:continue
        content=re.sub(r'/\*.*?\*/|//[^\n]*',lambda m:'\n'*m[0].count('\n'),content,flags=re.S)
        component_forms={'FOIL':'foil','FINEWIRE':'wireFine','BOLT':'bolt','GEAR':'gearGt','SMALLGEAR':'gearGtSmall','PLATESUPERDENSE':'plateSuperdense'}
        for match in re.finditer(r'MaterialUtils\s*\.generateComponentAndAssignToAMaterial\((\w+),\s*([\w.()]+)\)',content):
            ref=match[2].replace('MaterialsElements.getInstance().','MaterialsElements.')
            key=imp.gtpp_materials.get(ref)
            if key and match[1] in component_forms:extra_forms.setdefault(key,set()).add(component_forms[match[1]])
        for call in re.finditer(r'MaterialGenerator\.(generate|generateDusts|generateNuclearDusts|generateNuclearMaterial)\(',content):
            end=matching(content,call.end()-1);args=split_args(content[call.end():end])
            ref=re.sub(r'\s+','',args[0]).replace('MaterialsElements.getInstance().','MaterialsElements.')
            key=imp.gtpp_materials.get(ref)
            if not key or key not in definitions:continue
            if any(a not in ('true','false') for a in args[1:]):continue
            registrations[key]=(call[1],args[1:],str(path.relative_to(imp.source)).replace('\\','/'),content.count('\n',0,call.start())+1)
    sources={}
    def emit(template,process,ins,outs,ticks,power,marker,tools=None,conditions=None,circuit=None):
        label=directory+template+'.java'
        if label not in sources:sources[label]=read(label)
        imp.active_file=label
        line=sources[label].count('\n',0,sources[label].index(marker))+1
        return imp.emit_recipe(process,ins,outs,max(1,ticks),power,line,tools or {},conditions or {},[],circuit)
    for name,(kind,flags,path,line) in registrations.items():
        try:
            m=imp.materials[name];state=imp.gtpp_states[name].split('.')[-1]
            if state not in ('SOLID','LIQUID','GAS'):continue
            mass=metric(name,'protons')+metric(name,'neutrons');tier=metric(name,'tier');radioactive=metric(name,'radiation')>0;blast=metric(name,'blast')
            power=[16,30,120,480,1920,7680,30720,122880,491520,1966080,7864320,31457280,125829120,503316480,2013265920][tier] if 0<=tier<15 else 2147483647
        except (ValueError,SyntaxError,KeyError,StopIteration) as error:
            imp.skipped.append({'file':path,'line':line,'reason':'GT++ material generator: '+str(error)});continue
        imp.paths[path]=hashlib.sha256((imp.source/path).read_bytes()).hexdigest()
        everything=not flags or flags[0]=='true'
        blastsmelter=kind=='generate' and (len(flags)<2 or flags[1]=='true')
        optional=True;standalone=kind=='generateDusts';dehydrate=False
        templates={'RecipeGenAlloySmelter','RecipeGenAssembler','RecipeGenBlastSmelter','RecipeGenMetalRecipe','RecipeGenExtruder','RecipeGenFluids','RecipeGenPlates','RecipeGenDustGeneration','RecipeGenRecycling'}
        forms=set()
        if kind=='generate':
            forms={'dust','dustSmall','dustTiny'}
            if state in ('SOLID','LIQUID'):
                forms|={'ingot','nugget','plate','plateDouble'}
                if state=='SOLID' or everything:forms.add('block')
            if state=='SOLID' and everything:
                forms|={'stick','stickLong'}
                if radioactive:forms.discard('plateDouble')
                else:
                    forms|={'frameGt','bolt','ring','screw','rotor','gearGt','plateDense'}
                    if blast:forms.add('ingotHot')
        elif standalone:
            if state=='SOLID':forms={'dust','dustSmall','dustTiny'}
            templates={'RecipeGenFluids','RecipeGenDustGeneration'}
        else:
            # Nuclear overloads create a deliberately smaller form set and
            # disable optional mixing by default; do not inherit full-metal
            # templates simply because a consumer mentions a form.
            if kind=='generateNuclearDusts':
                options=[False,True,False,False,True,True]
                dehydrate=not flags or flags[0]=='true'
            elif len(flags)==1:options=[True,True,True,flags[0]=='true',True,True]
            elif len(flags)==6:options=[flag=='true' for flag in flags]
            else:
                imp.skipped.append({'file':path,'line':line,'reason':'unsupported nuclear material overload'});continue
            block,dust,ingot,plates,rods,disable=options;optional=not disable
            if block:forms.add('block')
            if dust:forms|={'dust','dustSmall','dustTiny'}
            if ingot:forms|={'ingot','nugget'}
            if plates:forms|={'plate','plateDouble'}
            if rods:forms|={'stick','stickLong'}
            templates={'RecipeGenRecycling','RecipeGenExtruder','RecipeGenFluids','RecipeGenMetalRecipe','RecipeGenDustGeneration'}
            if plates:templates|={'RecipeGenPlates','RecipeGenAssembler'}
        # External registrators can explicitly create extra forms. Merely
        # seeing a consumer reference does not prove a form was registered.
        forms|=extra_forms.get(name,set())
        f=lambda prefix:imp.material(name,'molten' if prefix=='fluid' and state=='SOLID' else prefix)
        for form in forms:f(form)
        if 'wireFine' in forms and 'ingot' in forms and name in wire_materials:
            label='gtPlusPlus/xmod/gregtech/registration/gregtech/GregtechConduits.java';raw=read(label);imp.active_file=label
            imp.emit_recipe('wire',{f('ingot'):1},{f('wireFine'):8},100,4,raw.count('\n',0,raw.index('if (ItemUtils.checkForInvalidItems(new ItemStack[] { aIngot, aFineWire }))'))+1,{}, {},[],3)
        def add(template,process,inputs,outputs,ticks=mass,eu=power,marker='private void generateRecipes',**kw):
            if template not in templates:return
            if any(prefix not in forms and prefix!='fluid' for prefix in [*inputs,*outputs]):return
            return emit(template,process,{f(p):n for p,n in inputs.items()},{f(p):n for p,n in outputs.items()},ticks,eu,marker,**kw)
        # Plates, rods and mechanical parts keep GT++'s own rates.
        add('RecipeGenPlates','forgeHammer',{'ingot':3},{'plate':2})
        add('RecipeGenPlates','bend',{'ingot':1},{'plate':1},circuit=1)
        add('RecipeGenPlates','bend',{'ingot':1},{'foil':4},mass*2,circuit=10,marker='if (ingotStackOne != null && foil_SingleFour != null)')
        add('RecipeGenPlates','bend',{'plate':1},{'foil':4},mass,circuit=1,marker='if (material.getPlate(1) != null && material.getFoil(1) != null)')
        add('RecipeGenPlates','alloy',{'ingot':2},{'plate':1},mass*2,tools={imp.named('Shape_Mold_Plate'):1})
        add('RecipeGenPlates','cut',{'block':1},{'plate':9},mass*10)
        for form,count in [('plateDouble',2),('plateDense',9)]:
            for raw in ('ingot','plate'):add('RecipeGenPlates','bend',{raw:count},{form:1},mass*2,max(120,power),circuit=count)
        add('RecipeGenMetalRecipe','electricCompress',{'ingot':9},{'block':1},300)
        add('RecipeGenMetalRecipe','lathe',{'ingot':1},{'stick':1,'dustSmall':2},max(1,mass//8))
        add('RecipeGenMetalRecipe','cut',{'stick':1},{'bolt':4},mass*2)
        add('RecipeGenMetalRecipe','forgeHammer',{'stick':2},{'stickLong':1},mass,15)
        add('RecipeGenMetalRecipe','cut',{'stickLong':1},{'stick':2},mass,4)
        add('RecipeGenMetalRecipe','lathe',{'bolt':1},{'screw':1},max(1,mass//8),4)
        for raw,count,out,n,shape,ticks in [('block',1,'ingot',9,'Ingot',mass*2),('ingot',9,'block',1,'Block',mass*2),('ingot',1,'plate',1,'Plate',10),('ingot',1,'stick',2,'Rod',mass*2),('ingot',5,'rotor',1,'Rotor',mass*5)]:
            add('RecipeGenExtruder','extrude',{raw:count},{out:n},ticks,tools={imp.named('Shape_Extruder_'+shape):1})
        if not radioactive:
            for form,count,size,mult in [('ring',4,'Ring',2),('gearGt',1,'Gear',5),('bolt',8,'Bolt',2)]:
                add('RecipeGenExtruder','extrude',{'ingot':4 if form=='gearGt' else 1},{form:count},mass*mult,tools={imp.named('Shape_Extruder_'+size):1})
        add('RecipeGenAssembler','assemble',{'stick':4},{'frameGt':1},60,circuit=4)
        if {'rotor','ring'}<=forms:
            for solder,n in [('SolderingAlloy',16),('Tin',32),('Lead',64)]:
                emit('RecipeGenAssembler','assemble',{f('plate'):4,f('ring'):1,imp.material(solder,'molten'):n},{f('rotor'):1},240,power,'private static void addAssemblerRecipe')
        for form,shape,amount,ticks in [('ingot','Ingot',144,60),('plate','Plate',144,60),('nugget','Nugget',16,60),('gearGt','Gear',576,240),('block','Block',1296,500),('stick','Rod',72,300),('stickLong','Rod_Long',144,600),('bolt','Bolt',18,100),('screw','Screw',18,100),('ring','Ring',36,200),('rotor','Rotor',612,200)]:
            add('RecipeGenFluids','solidify',{'fluid':amount},{form:1},ticks,tools={imp.named('Shape_Mold_'+shape):1})
        for raw,n,out,count,shape in [('ingot',1,'nugget',9,'Nugget'),('nugget',9,'ingot',1,'Ingot'),('ingot',8,'gearGt',1,'Gear')]:
            add('RecipeGenAlloySmelter','alloy',{raw:n},{out:count},mass*2,tools={imp.named('Shape_Mold_'+shape):1})
        # Recover only forms actually created by MaterialGenerator. Respect
        # blast-required dust, which must never be melted to bypass the EBF.
        amounts={'ingot':144,'nugget':16,'plate':144,'plateDouble':288,'plateDense':1296,'block':1296,'stick':72,'stickLong':144,'bolt':18,'screw':18,'ring':36,'rotor':612,'gearGt':576,'frameGt':288,'dust':144}
        for prefix,amount in amounts.items():
            if prefix not in forms or prefix=='dust' and blast:continue
            add('RecipeGenRecycling','melt',{prefix:1},{'fluid':amount},max(1,24*amount//144),max(8,power),marker='// Fluid Extractor')
            if prefix=='dust':continue
            units=amount/144
            dust='dust' if amount%144==0 else 'dustSmall' if amount%36==0 else 'dustTiny'
            count=amount//{'dust':144,'dustSmall':36,'dustTiny':16}[dust]
            if count:add('RecipeGenRecycling','grind',{prefix:1},{dust:count},max(16,int(units*max(1,mass))),4,marker='// Maceration')
        if blast and 'ingotHot' in forms:
            kelvin=5*math.floor((metric(name,'melting')+273.15)/5+.5)
            add('RecipeGenDustGeneration','electricBlast',{'dust':1},{'ingotHot':1},(250 if tier<=4 else 1250)*tier,power,marker='private boolean addBlastFurnaceRecipe',conditions={'heat':kelvin})
            label='gtPlusPlus/core/item/base/ingots/BaseItemIngotHot.java';source=read(label);imp.active_file=label
            imp.emit_recipe('freeze',{f('ingotHot'):1},{f('ingot'):1},max(mass*3,1),power,source.count('\n',0,source.index('private void generateRecipe'))+1,{}, {},[],None)
        elif not blast and {'dust','ingot'}<=forms and not standalone:
            label='gregtech/api/util/GTModHandler.java';source=read(label);imp.active_file=label
            imp.emit_recipe('alloy',{f('dust'):1},{f('ingot'):1},130,3,source.count('\n',0,source.index('public static boolean addSmeltingAndAlloySmeltingRecipe'))+1,{imp.named('Shape_Mold_Ingot'):1},{},[],None)
        parts=m['components']
        # These branches require all component dusts to exist. Mixed
        # gas/liquid compounds need distinct null-stack handling in GT++;
        # leave that branch unresolved instead of substituting fake dusts.
        if optional and 'dust' in forms and parts and all(isinstance(n,int) and n>0 for k,n in parts):
            solid=all(imp.gtpp_states.get(k,'SOLID' if imp.materials[k]['dust'] else 'UNKNOWN').split('.')[-1]=='SOLID' and imp.materials[k]['dust'] for k,n in parts)
            if solid:
                ratio=math.gcd(*(n if 1<=n<=100 else 100 for k,n in parts))
                counts=[(k,(n if 1<=n<=100 else 100)//ratio) for k,n in parts];total=sum(n for k,n in counts)
                inputs={}
                for k,n in counts:
                    id=imp.material(k,'dust');inputs[id]=inputs.get(id,0)+n
                # MaterialProcessing decomposes composites independently of
                # mixer eligibility. Preserve BW's precious-metal rewrites.
                if 1<len(parts)<=9 and (len(parts)>6 or total<=64):
                    products={}
                    replacements={'Platinum':'PTMetallicPowder','Palladium':'PDMetallicPowder','Iridium':'IrLeachResidue','Osmium':'IrOsLeachResidue'}
                    for original,replacement in [('Ruthenium','LeachResidue'),('Rhodium','CrudeRhMetall')]:
                        key=imp.addon_materials.get('WerkstoffLoader.'+original)
                        if key:replacements[key]=replacement
                    for k,n in counts:
                        if k in replacements:
                            id=imp.stack('WerkstoffLoader.'+replacements[k]+'.get(OrePrefixes.dust,'+str(n*2)+')')[0];n*=2
                        else:id=imp.material(k,'dust')
                        products[id]=products.get(id,0)+n
                    emit('RecipeGenMaterialProcessing','centrifuge' if len(parts)<=6 else 'dehydrate',{f('dust'):total},products,(power//10)*20,power,'private void generateRecipes')
                if len(parts)<=4:
                    emit('RecipeGenDustGeneration','mix',inputs,{f('dust'):total},max(mass*2,1),power,'public static void addMixerRecipe_Standalone' if standalone else '// Is this a composite?',circuit=20 if standalone and len(parts)<=3 else 10+len(parts) if not standalone and len(parts)<=3 else None)
                bad={'MaterialsAlloy.BLOODSTEEL','MaterialsAlloy.NITINOL_60'}
                if blastsmelter and name not in {imp.gtpp_materials.get(k) for k in bad} and 1<=max(1,tier)<15:
                    abs_tier=max(1,tier);abs_eu=[7,30,120,480,1920,7680,30720,122880,491520,1966080,7864320,31457280,125829120,503316480,2013265920][abs_tier]
                    duration=(200 if abs_tier<=4 else 1200)*abs_tier
                    if blast:emit('RecipeGenBlastSmelter','alloyBlast',{f('dust'):1},{f('fluid'):144},max(1,duration//total),abs_eu,'// Generate Recipes for all singular materials',circuit=1)
                    if 1<len(parts)<=9:emit('RecipeGenBlastSmelter','alloyBlast',inputs,{f('fluid'):144*total},duration,abs_eu if blast else abs_eu//2,'// Adds Recipe',circuit=len(parts) if len(parts)<9 else None)
        # ABS supports one non-solid component. The source overwrites the
        # previous fluid when several occur, so do not silently import those.
        if optional and blastsmelter and parts and 1<len(parts)<=9 and all(isinstance(n,int) and n>0 for k,n in parts):
            fluid_parts=[(k,n) for k,n in parts if imp.gtpp_states.get(k,'SOLID' if imp.materials[k]['dust'] else 'UNKNOWN').split('.')[-1]!='SOLID' or not imp.materials[k]['dust']]
            if len(fluid_parts)==1:
                ratio=math.gcd(*(n if 1<=n<=100 else 100 for k,n in parts));counts=[(k,(n if 1<=n<=100 else 100)//ratio) for k,n in parts]
                inputs={}
                for k,n in counts:
                    fluid=k==fluid_parts[0][0];prefix='fluid' if fluid else 'dust'
                    # ABS calls MaterialStack.getUnificatedDustStack. ModItems
                    # explicitly binds GT++ iodine to BW Werkstoff 11012.
                    material='WerkstoffMaterialPool_Iodine' if not fluid and k=='GTPP_Iodine' else k
                    id=imp.material(material,prefix);inputs[id]=inputs.get(id,0)+n*(1000 if fluid else 1)
                abs_tier=max(1,tier)
                if abs_tier<15:
                    abs_eu=[7,30,120,480,1920,7680,30720,122880,491520,1966080,7864320,31457280,125829120,503316480,2013265920][abs_tier]
                    emit('RecipeGenBlastSmelter','alloyBlast',inputs,{f('fluid'):144*sum(n for k,n in counts)},(200 if abs_tier<=4 else 1200)*abs_tier,abs_eu if blast else abs_eu//2,'// Adds Recipe',circuit=len(parts) if len(parts)<9 else None)
        if dehydrate and 'dust' in forms:
            label='gtPlusPlus/core/material/MaterialGenerator.java';source=read(label);imp.active_file=label
            imp.emit_recipe('dehydrate',{f('fluid'):144},{f('dust'):1},10*(power//5),power,source.count('\n',0,source.index('public static void generateNuclearDusts(final Material matInfo, boolean'))+1,{}, {},[],20)
        if 'RecipeGenDustGeneration' in templates and not standalone and 'dust' in forms:
            # Both nuclear and ordinary DustGeneration register the same
            # four inventory-grid conversions and four schematic recipes.
            for small,n,positions,schematic in [('dustSmall',4,[0,1,3,4],'Schematic_Dust_Small'),('dustTiny',9,list(range(9)),'Schematic_Dust')]:
                if small not in forms:continue
                packed=emit('RecipeGenDustGeneration','craft',{f(small):n},{f('dust'):1},20,0,'public RecipeGenDustGeneration(final Material M, final boolean O)')
                if packed:packed.update(stage=1,grid=[f(small) if i in positions else None for i in range(9)],craftingSource='shaped',durationAdapted=True)
                unpacked=emit('RecipeGenDustGeneration','craft',{f('dust'):1},{f(small):n},20,0,'public RecipeGenDustGeneration(final Material M, final boolean O)')
                if unpacked:unpacked.update(stage=1,grid=[f('dust') if i==(1 if small=='dustSmall' else 0) else None for i in range(9)],craftingSource='shaped',durationAdapted=True)
                emit('RecipeGenDustGeneration','pack',{f(small):n},{f('dust'):1},100,4,'public static boolean generatePackagerRecipes',tools={imp.named('Schematic_Dust'):1})
                emit('RecipeGenDustGeneration','pack',{f('dust'):1},{f(small):n},100,4,'public static boolean generatePackagerRecipes',tools={imp.named(schematic):1})
        for item in forms:
            if f(item) in imp.items:imp.items[f(item)]['gtppGenerator']={'file':path,'line':line,'mass':mass,'tier':tier,'radioactive':radioactive}
