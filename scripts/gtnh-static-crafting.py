"""Strict literal crafting import; final registry removals still need a snapshot.

Unknown ore dictionaries, tools, NBT, container returns and control flow remain
reported. Missing tools never become free ingredients or invented hand recipes.
"""
import hashlib
import itertools
import json
import re


def import_crafting(importer, paths, split_args, matching, scopes_at):
    unresolved=[]
    count=0
    # The idle game already has these physical reusable tools. Preserve the
    # original tool slots and require ownership; tool durability remains an
    # explicit adaptation, rather than silently deleting tool ingredients.
    hand_tools={'h':('hammer','锻造锤'),'f':('file','锉刀'),'s':('saw','锯'),'w':('wrench','扳手'),'x':('wireCutter','剪线钳'),'d':('screwdriver','螺丝刀'),'k':('knife','燧石小刀'),'m':('mortar','燧石研钵'),'r':('softMallet','木软锤')}
    tool_dictionaries={name:hand_tools[key] for name,key in {'craftingToolHardHammer':'h','craftingToolFile':'f','craftingToolSaw':'s','craftingToolWrench':'w','craftingToolWireCutter':'x','craftingToolScrewdriver':'d','craftingToolKnife':'k','craftingToolMortar':'m','craftingToolSoftMallet':'r'}.items()}

    # GT resolves these symbolic ingredients at registration time. Read the
    # tier mappings from the exact installed source instead of guessing them
    # from the output name (which is wrong for several high-tier machines).
    handler=importer.source/'gregtech/api/util/GTModHandler.java'
    handler_text=handler.read_text(encoding='utf-8')
    importer.paths['gregtech/api/util/GTModHandler.java']=hashlib.sha256(handler.read_bytes()).hexdigest()
    machine_mappings={}
    for match in re.finditer(r'case\s+(\w+)\s*->\s*switch\s*\(machineTier\)\s*\{(.*?)\}\s*;',handler_text,re.S):
        machine_mappings[match[1]]={}
        for branch in re.finditer(r'(?:case\s+([\d,\s]+)|\b(default))\s*->\s*([^;]+);',match[2]):
            for tier in branch[1].split(',') if branch[1] else ['default']:
                machine_mappings[match[1]][tier.strip()]=branch[3].strip()
    direct_mappings=dict(re.findall(r'case\s+(\w+)\s*->\s*(OrePrefixes\.[^;]+);',handler_text))
    ore_path=importer.source/'gregtech/loaders/preload/LoaderGTOreDictionary.java'
    ore_text=ore_path.read_text(encoding='utf-8')
    importer.paths['gregtech/loaders/preload/LoaderGTOreDictionary.java']=hashlib.sha256(ore_path.read_bytes()).hexdigest()
    ore_representatives={}
    for call in re.finditer(r'GTOreDictUnificator\s*\.\s*registerOre\(',ore_text):
        end=matching(ore_text,call.end()-1);args=split_args(ore_text[call.end():end])
        if len(args)==2 and re.fullmatch(r'OreDictNames\.\w+',args[0].strip()):
            ore_representatives.setdefault(args[0].strip().split('.')[-1],[]).append(args[1])
    meta_path=importer.source/'gregtech/common/items/MetaGeneratedItem01.java'
    meta_text=meta_path.read_text(encoding='utf-8')
    importer.paths['gregtech/common/items/MetaGeneratedItem01.java']=hashlib.sha256(meta_path.read_bytes()).hexdigest()
    for call in re.finditer(r'ItemList\.(\w+)\.set\(',meta_text):
        end=matching(meta_text,call.end()-1)
        for dictionary in re.findall(r'OreDictNames\.(\w+)',meta_text[call.end():end]):
            ore_representatives.setdefault(dictionary,[]).append('ItemList.'+call[1]+'.get(1)')
    # This local is intentionally copied before unification in the source.
    # IC2's industrial diamond must not be replaced by a vanilla diamond.
    ore_representatives['craftingIndustrialDiamond']=['GTModHandler.getIC2Item("industrialDiamond",1)']
    dye_path=importer.source/'gregtech/api/enums/Dyes.java'
    dye_text=dye_path.read_text(encoding='utf-8')
    importer.paths['gregtech/api/enums/Dyes.java']=hashlib.sha256(dye_path.read_bytes()).hexdigest()
    dye_metadata={name:int(meta) for name,meta in re.findall(r'^\s*(dye\w+)\(\s*(\d+),',dye_text,re.M)}

    def machine_operand(expression,tier):
        s=importer.resolve(expression)
        match=re.fullmatch(r'(?:MTEBasicMachineWithRecipe\.)?X\.(\w+)',s)
        if not match:return s
        key=match[1]
        if key in machine_mappings:
            mapping=machine_mappings[key];s=mapping.get(str(tier),mapping.get('default'))
        else:s=direct_mappings.get(key)
        if not s:raise ValueError('unresolved machine ingredient '+key)
        # String concatenation is used only for voltage-specific glass here.
        glass=re.fullmatch(r'"blockGlass"\s*\+\s*VN\[(machineTier|\d+)\]',s)
        if glass:
            names=['ULV','LV','MV','HV','EV','IV','LuV','ZPM','UV','UHV','UEV','UIV','UMV','UXV','MAX']
            s=json.dumps('blockGlass'+names[tier if glass[1]=='machineTier' else int(glass[1])])
        return s

    def ingredient(expression):
        s=importer.resolve(expression.strip())
        if s=='null':return [None]
        circuit=re.fullmatch(r'"circuit"\+Materials\.(\w+)',s)
        if circuit:
            return [(id,1) for id,n in importer.variants('GTOreDictUnificator.get(OrePrefixes.circuit,Materials.'+circuit[1]+',1)')]
        if re.fullmatch(r'OreDictNames\.\w+|Dyes\.dye\w+',s):s=json.dumps(s.split('.')[-1])
        if s=='OrePrefixes.stone':s='"stone"'
        if s=='OrePrefixes.plank.get(Materials.Wood)':s='"plankWood"'
        if s=='OrePrefixes.stick.get(Materials.Wood)':s='"stickWood"'
        itemdata=re.fullmatch(r'OrePrefixes\.(\w+)\.get\(Materials\.(\w+)\)',re.sub(r'\s+','',s))
        if itemdata:s='GTOreDictUnificator.get(OrePrefixes.'+itemdata[1]+',Materials.'+itemdata[2]+',1)'
        addon=re.fullmatch(r'OrePrefixes\.(\w+)\.get\(((?:WerkstoffLoader|GGMaterial)\.\w+\.getGTMaterial\(\))\)',s)
        if addon:s='GTOreDictUnificator.get(OrePrefixes.'+addon[1]+','+addon[2]+',1)'
        # Use the metadata-zero member of these vanilla block dictionaries.
        # This applies only to ingredient wildcards, never output damage/NBT.
        s=re.sub(r'newItemStack\(Blocks\.(glass|chest|trapped_chest|piston|sticky_piston|furnace|anvil|crafting_table|redstone_torch|unlit_redstone_torch),1,(?:WILDCARD|32767)\)',r'new ItemStack(Blocks.\1,1,0)',s)
        if s.startswith('"'):
            key=json.loads(s)
            if key in importer.bw_glass_ores:return ingredient(importer.bw_glass_ores[key])
            if key in ore_representatives:
                for representative in ore_representatives[key]:
                    try:return ingredient(representative)
                    except (ValueError,KeyError,SyntaxError,IndexError,TypeError):continue
                raise ValueError('unresolved registered crafting dictionary '+key)
            if key in dye_metadata:return ingredient('new ItemStack(Items.dye,1,'+str(dye_metadata[key])+')')
            # Canonical representatives of vanilla ore dictionaries. These
            # remain physical ingredients; no source/recipe is granted here.
            vanilla={'blockWool':'Blocks.wool','paneGlass':'Blocks.glass_pane','glass':'Blocks.glass','blockGlass':'Blocks.glass','itemFlint':'Items.flint','chestWood':'Blocks.chest','blockTorch':'Blocks.torch','itemLeather':'Items.leather','dyeBlack':'new ItemStack(Items.dye,1,0)','dyeRed':'new ItemStack(Items.dye,1,1)','slimeball':'Items.slime_ball','stickWood':'Items.stick','plankWood':'Blocks.planks','logWood':'Blocks.log','stoneCobble':'Blocks.cobblestone','stone':'Blocks.stone','craftingTableWood':'Blocks.crafting_table','workbench':'Blocks.crafting_table','craftingChest':'Blocks.chest'}
            if key in vanilla:return ingredient(vanilla[key])
            # Galacticraft 3.4.37 GCItems registers these exact ItemBasic
            # subtypes as ore dictionary entries (GCItems.java:269-282).
            galactic={'waferSolar':12,'waferBasic':13,'waferAdvanced':14,'compressedCopper':6,'compressedTin':7,'compressedAluminum':8,'compressedSteel':9,'compressedBronze':10,'compressedIron':11}
            if key in galactic:return ingredient('getModItem(GalacticraftCore.ID,"item.basicItem",1,'+str(galactic[key])+')')
            if key.startswith('craftingTool'):raise ValueError('reusable tool dictionary needs a registered physical tool: '+key)
            circuit_tiers={'Primitive':'ULV','Basic':'LV','Good':'MV','Advanced':'HV','Data':'EV','Elite':'IV','Master':'LuV','Ultimate':'ZPM','Superconductor':'UV','Infinite':'UHV','Bio':'UEV','Optical':'UIV','Exotic':'UMV','Cosmic':'UXV','Transcendent':'MAX'}
            if key.startswith('circuit') and key[7:] in circuit_tiers:
                return [(id,1) for id,n in importer.variants('GTOreDictUnificator.get(OrePrefixes.circuit,Materials.'+circuit_tiers[key[7:]]+',1)')]
            found=False
            prefixes=set(importer.material_prefixes) if hasattr(importer,'material_prefixes') else set()
            prefixes.update(i.get('native',{}).get('prefix','') for i in importer.items.values())
            for prefix in sorted(prefixes,key=len,reverse=True):
                if prefix and key.startswith(prefix) and key[len(prefix):] in importer.materials:
                    s='GTOreDictUnificator.get(OrePrefixes.'+prefix+',Materials.'+key[len(prefix):]+',1)';found=True;break
            if not found:raise ValueError('unresolved crafting dictionary '+key)
        if re.fullmatch(r'(?:Blocks|Items)\.\w+',s):s='new ItemStack('+s+',1)'
        if re.fullmatch(r'(?:ItemList|GregtechItemList|NHItemList)\.\w+',s):s+='.get(1)'
        result=importer.variants(s)
        if any(v is None or v[1]<=0 or importer.items[v[0]]['kind']=='fluid' for v in result):raise ValueError('container or fluid crafting ingredient needs return handling')
        # These stacks are ordinary items to the parser, but Forge returns a
        # container on crafting. Do not silently destroy the bucket/bottle.
        for id,n in result:
            item=importer.items[id]
            registry=item.get('nativeItem',{}).get('registry','').lower()
            vanilla=item.get('nativeVanilla',id)
            if vanilla in {'water_bucket','lava_bucket'}:
                fluid=importer.stack('FluidRegistry.getFluidStack("'+('water' if vanilla=='water_bucket' else 'lava')+'",1000)')
                importer.stack('new ItemStack(Items.bucket,1)')
                container_tools['ironBucket']=container_tools.get('ironBucket',0)+1
                return [fluid]
            if vanilla in {'water_bucket','lava_bucket','milk_bucket','potion','potionitem'} or re.search(r'(?:filledcell|fluidcell|fluidcontainer|bucket|potion)',registry) and registry not in {'minecraft:bucket'}:
                raise ValueError('container return needs a runtime crafting snapshot: '+id)
        # Vanilla/Forge crafting matches one item per occupied grid slot.
        return [(id,1) for id,n in result]

    def array(expression):
        found=re.fullmatch(r'new\s+Object\[\]\s*\{(.*)\}',expression.strip(),re.S)
        if not found:raise ValueError('dynamic crafting input array')
        return split_args(found[1])

    for path,label in paths:
        raw=path.read_text(encoding='utf-8')
        pattern=r'(?<![\w.])(?:(GTModHandler|Recipe)\.|ExtremeCraftingManager\.getInstance\(\)\.)?(addMachineCraftingRecipe|addCraftingRecipe|addShapelessCraftingRecipe|addShapedRecipe|addShapelessRecipe|addExtremeShapedOreRecipe|addSmeltingRecipe|of)\('
        calls=list(re.finditer(pattern,raw))
        if not calls:continue
        importer.active_file=label;importer.constants={}
        importer.paths[label]=hashlib.sha256(path.read_bytes()).hexdigest()
        text=re.sub(r'/\*.*?\*/|//[^\n]*',lambda m:'\n'*m[0].count('\n'),raw,flags=re.S)
        calls=list(re.finditer(pattern,text))
        assignments=list(re.finditer(r'\b(?:final\s+)?ItemStack\s+(\w+)\s*=\s*([^;]+);',text))
        string_constants={m[1]:m[2] for m in re.finditer(r'\bstatic\s+final\s+String\s+(\w+)\s*=\s*("[^"\n]*"|(?:Mods\.)?\w+\.ID)\s*;',text)}
        scopes=scopes_at(text,[m.start() for m in calls]+[m.start() for m in assignments])
        for match in calls:
            line=text.count('\n',0,match.start())+1
            try:
                method=match[2]
                if method=='of':
                    if match[1]!='Recipe':continue
                    closing=matching(text,match.end()-1)
                    tail=text[closing+1:text.find(';',closing)]
                    providers=re.findall(r'\.provideTo\(\s*(shapedRecipes|shapelessRecipes)\(\)\s*\)',tail)
                    furnace_provider=re.search(r'\.provideTo\(\s*(\w+)\s*->\s*GTModHandler\.addSmeltingRecipe\(\s*\1\.flatten\(\)\[0\],\s*\1\.getResult\(\)\s*\)\s*\)',tail)
                    if len(providers)==1:method='addShapedRecipe' if providers[0]=='shapedRecipes' else 'addShapelessRecipe'
                    elif not providers and furnace_provider:method='wrappedSmelting'
                    elif not providers and '.provideTo(shapelessUnremovableGtRecipes())' in tail and re.search(r'private Consumer<Recipe> shapelessUnremovableGtRecipes\(\)\s*\{\s*return craft -> GTModHandler.addShapelessCraftingRecipe',text):method='addShapelessRecipe'
                    else:continue
                # Do not turn one iteration of a loop or an unknown conditional
                # registration into an unconditional production route.
                for start in scopes[match.start()]:
                    header=text[max(0,start-400):start]
                    control=re.search(r'\b(if|for|while|switch)\s*(\([^{}]*\))\s*$',header)
                    if not control:continue
                    guard=control[2].strip()
                    if control[1]=='if' and re.fullmatch(r'\(\s*(?:(?:Mods\.)?\w+\.isModLoaded\(\)\s*)(?:&&\s*(?:Mods\.)?\w+\.isModLoaded\(\)\s*)*\)',guard):
                        mods=re.findall(r'(\w+)\.isModLoaded',guard)
                        if all(importer.mod_ids.get(mod) in importer.installed_mods for mod in mods):continue
                    raise ValueError('conditional or loop crafting registration needs expansion')
                importer.constants=dict(string_constants)
                scope=scopes[match.start()]
                for assignment in assignments:
                    local_scope=scopes[assignment.start()]
                    if assignment.start()<match.start() and scope[:len(local_scope)]==local_scope:
                        # Refuse reassigned locals instead of leaking one value
                        # from another branch or loop into the current recipe.
                        tail=text[assignment.end():match.start()]
                        if re.search(r'\b'+assignment[1]+r'\s*=(?!=)',tail):continue
                        importer.constants[assignment[1]]=assignment[2]
                end=matching(text,match.end()-1);args=split_args(text[match.end():end])
                if len(args)<2:raise ValueError('missing crafting operands')
                if method in ('addSmeltingRecipe','wrappedSmelting'):
                    if re.search(r'\b\w+\.(?:flatten|getResult)\(',args[0]):continue
                    if len(args)!=2:raise ValueError('unsupported smelting registration overload')
                    original=importer.stack(args[0 if method=='addSmeltingRecipe' else 1])
                    product=importer.stack(args[1 if method=='addSmeltingRecipe' else 0])
                    if not original or not product or original[1]!=1 or product[1]<=0 or any(importer.items[v[0]]['kind']=='fluid' for v in (original,product)):raise ValueError('unsupported furnace stack')
                    # GT FurnaceBackend synthesizes 128 ticks / 4 EU/t from
                    # the vanilla furnace registry; steam furnaces use 256.
                    backend=importer.source/'gregtech/api/recipe/maps/FurnaceBackend.java'
                    importer.paths['gregtech/api/recipe/maps/FurnaceBackend.java']=hashlib.sha256(backend.read_bytes()).hexdigest()
                    if not re.search(r'\.duration\(128\)\s*\.eut\(4\)',backend.read_text(encoding='utf-8')):raise ValueError('changed GT furnace backend')
                    r=importer.emit_recipe('electricSmelt',{original[0]:1},{product[0]:product[1]},128,4,line,{}, {},[],None)
                    if r:r.update(stage=1,furnaceRegistry=True);count+=1
                    continue
                output=args[0]
                # Both GT handlers normalize wildcard result damage to zero.
                # Restrict this to their outputs; input wildcards still need
                # a known physical subtype or reusable-tool rule.
                if match[1]=='GTModHandler' or '.provideTo(shapelessUnremovableGtRecipes())' in text[end+1:text.find(';',end)]:
                    output=re.sub(r',\s*(?:WILDCARD|32767)\s*\)$',',0)',output.strip())
                out=importer.stack(output)
                if not out or out[1]<=0 or importer.items[out[0]]['kind']=='fluid':raise ValueError('unsupported crafting output')
                extreme=method=='addExtremeShapedOreRecipe';width=9 if extreme else 3
                shaped=method in ('addMachineCraftingRecipe','addCraftingRecipe','addShapedRecipe','addExtremeShapedOreRecipe')
                if method=='addMachineCraftingRecipe':
                    tier_expression=importer.resolve(args[-1])
                    if not re.fullmatch(r'\d+',tier_expression):raise ValueError('dynamic machine crafting tier')
                    tier=int(tier_expression)
                    if not 0<=tier<=14:raise ValueError('invalid machine crafting tier')
                    operands=[machine_operand(arg,tier) for arg in array(args[-2])]
                elif 'CraftingRecipe' in method:
                    operands=array(args[-1])
                else:
                    operands=args[1:]
                    if len(operands)==1 and operands[0].lstrip().startswith('new Object'):operands=array(operands[0])
                operands=[importer.resolve(arg) for arg in operands]
                rows=[];mapping={};grid_tools={};tools={}
                if shaped:
                    while operands and re.fullmatch(r'"[^"]{1,'+str(width)+'}"',operands[0]):rows.append(json.loads(operands.pop(0)))
                    if rows:
                        if len(rows)>width or len(operands)%2:raise ValueError('invalid shaped symbol map')
                        for key,value in zip(operands[::2],operands[1::2]):
                            if not re.fullmatch(r"'.'",key):raise ValueError('dynamic shaped symbol')
                            mapping[key[1]]=value
                        operands=[]
                        for row in rows:
                            for key in row.ljust(width):
                                if key==' ' or extreme and key=='-' and key not in mapping:operands.append('null')
                                elif key in mapping:operands.append(mapping[key])
                                elif match[1]=='GTModHandler' and key in hand_tools:
                                    tool,title=hand_tools[key]
                                    importer.items.setdefault(tool,{'id':tool,'name':title,'kind':'item','category':'工具','icon':tool})
                                    tools[tool]=1;grid_tools[str(len(operands))]=tool;operands.append('null')
                                else:raise ValueError('implicit tool or missing symbol '+key)
                    elif len(operands)==4:operands=[*operands[:2],'null',*operands[2:],'null']
                if len(operands)>width**2:raise ValueError('crafting grid exceeds registered dimensions')
                for index,arg in enumerate(operands):
                    resolved=importer.resolve(arg.strip())
                    tool_name=re.fullmatch(r'ToolDictNames\.(\w+)(?:\.name\(\))?',re.sub(r'\s+','',resolved))
                    if tool_name:resolved=json.dumps(tool_name[1])
                    dictionary=json.loads(resolved) if re.fullmatch(r'"[^"\n]+"',resolved) else None
                    brick_form=re.fullmatch(r'newItemStack\(NHItemList.WoodenBrickForm.item,1,(?:WILDCARD|32767|0)\)',re.sub(r'\s+','',resolved))
                    if brick_form:
                        form=importer.stack('NHItemList.WoodenBrickForm.get(1)')[0]
                        tools[form]=1
                        if shaped:grid_tools[str(index)]=form
                        operands[index]='null'
                        continue
                    if dictionary in tool_dictionaries:
                        tool,title=tool_dictionaries[dictionary]
                        importer.items.setdefault(tool,{'id':tool,'name':title,'kind':'item','category':'工具','icon':tool})
                        tools[tool]=1
                        if shaped:grid_tools[str(index)]=tool
                        operands[index]='null'
                container_tools={}
                options=[ingredient(arg) for arg in operands]
                tools.update(container_tools)
                combinations=1
                for values in options:combinations*=len(values)
                if combinations>512:raise ValueError('too many crafting substitutes')
                for slots in itertools.product(*options):
                    inputs={}
                    for slot in slots:
                        if slot:inputs[slot[0]]=inputs.get(slot[0],0)+slot[1]
                    if not inputs:raise ValueError('empty crafting recipe')
                    if extreme:tools[importer.stack('getModItem(Avaritia.ID,"Dire_Crafting",1,0)')[0]]=1
                    r=importer.emit_recipe('craft',inputs,{out[0]:out[1]},1,0,line,tools,{},[],None)
                    if r:
                        r.update(stage=1,craftingSource='shaped' if shaped else 'shapeless',durationAdapted=True)
                        if shaped:r['grid']=[slot[0] if slot else None for slot in slots]+[None]*(width**2-len(slots))
                        if extreme:r['gridWidth']=width
                        if grid_tools:r.update(gridTools=grid_tools,handToolsAdapted=True)
                        if container_tools:r.update(containerTools=dict(container_tools),containerPortAdapted=True)
                        count+=1
            except (ValueError,KeyError,SyntaxError,IndexError,TypeError) as error:
                unresolved.append({'file':label,'line':line,'reason':str(error)[:220]})
    return {'recipes':count,'unresolved':unresolved}
