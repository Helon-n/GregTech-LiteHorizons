"""Resolve registered addon stacks; no invented metadata or runtime NBT."""
import hashlib
import re


def load(importer, split_args, matching, numeric):
    registered={}
    def read(label):
        path=importer.source/label
        text=path.read_text(encoding='utf-8')
        importer.paths[label]=hashlib.sha256(path.read_bytes()).hexdigest()
        return text
    ids=dict(re.findall(r'^\s*(\w+)\(([\d_]+)\)',read('gregtech/api/enums/MetaTileEntityIDs.java'),re.M))
    # CustomItemList machine registrations use statically imported enum names.
    text=read('tectech/loader/thing/MachineLoader.java')
    for m in re.finditer(r'\b(\w+)\s*\.set\(\s*new\s+\w+\s*\(',text):
        end=matching(text,m.end()-1);args=split_args(text[m.end():end])
        if len(args)<2:continue
        key=args[0].split('.')[0]
        if key not in ids:continue
        # TecTech energy hatches pass an empty display title and obtain their
        # name from the language key; their registry metadata is still literal.
        title=re.fullmatch(r'"([^"\n]*)"',args[2]) if len(args)>2 else None
        title=title or re.fullmatch(r'"([^"\n]*)"','"'+m[1]+'"');lang=re.fullmatch(r'"([^"\n]+)"',args[1])
        if not title:continue
        registered['CustomItemList.'+m[1]]={'name':importer.lang.get('gt.blockmachines.'+lang[1]+'.name',title[1] or m[1]) if lang else title[1] or m[1],
          'registry':'gregtech:gt.blockmachines','meta':numeric(ids[key]),'texture':'assets/gregtech/textures/blocks/iconsets/MACHINE_CASING_SOLID_STEEL.png'}
    for label in ('tectech/thing/casing/BlockGodforgeCasings.java','tectech/thing/casing/BlockGTCasingsTT.java','tectech/thing/casing/BlockGTCasingsBA0.java','tectech/thing/casing/StabilisationFieldCasing.java','tectech/thing/casing/TimeAccelerationFieldCasing.java','tectech/thing/casing/SpacetimeCompressionFieldCasing.java'):
        text=read(label)
        block=re.search(r'super\([^;]*?"([^"]+)"',text)
        icons=dict(re.findall(r'(\w+)\s*=\s*\w+\.registerIcon\("([^"]+)"\)',text))
        faces={meta:returns[-1] for meta,body in re.findall(r'case\s+(\d+)\s*:(.*?)(?=case\s+\d+\s*:|default\s*:)',text,re.S)
               if (returns:=re.findall(r'return\s+(\w+)\s*;',body))}
        faces.update(dict(re.findall(r'case\s+(\d+)\s*->\s*(\w+)\s*;',text)))
        if not block:continue
        for key,meta in re.findall(r'CustomItemList\.(\w+)\.set\(new ItemStack\(this,\s*1,\s*(\d+)\)\)',text):
            texture=icons.get(faces.get(meta))
            if label.endswith('BlockGodforgeCasings.java') and meta in ('5','6','7'):
                texture=icons.get({'5':'GravitonModulatorT1','6':'GravitonModulatorT2','7':'GravitonModulatorT3'}[meta])
            if not texture:continue  # Unknown face mappings stay unresolved.
            domain,path=texture.split(':',1)
            registered['CustomItemList.'+key]={'name':importer.lang.get(block[1]+'.'+meta+'.name',key.replace('_',' ')),
              'registry':'gregtech:'+block[1],'meta':int(meta),'texture':'assets/'+domain+'/textures/blocks/'+path+'.png'}
    loader=read('goodgenerator/loader/Loaders.java');objects={};item_variants={}
    for m in re.finditer(r'\b(\w+)\s*=\s*new\s+(?:BlockCasing|BlockFrame)\s*\(',loader):
        end=matching(loader,m.end()-1);args=split_args(loader[m.end():end])
        if len(args)<2 or not re.fullmatch(r'"[^"]+"',args[0]):continue
        textures=[]
        for v in re.findall(r'(?:Mods.ModIDs.GOOD_GENERATOR\s*\+\s*)?"([^"\n]+)"',args[1]):
            if v.startswith(':'):v=importer.mod_ids.get('GoodGenerator','GoodGenerator')+v
            if ':' in v:textures.append(v)
        if textures:objects[m[1]]=(args[0][1:-1],textures)
    stacks={}
    read('goodgenerator/blocks/regularBlock/BlockTurbineCasing.java')
    for key,registry,texture in re.findall(r'\b(\w+)\s*=\s*new BlockTurbineCasing\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)',loader):
        objects[key]=(registry,[importer.mod_ids.get('GoodGenerator','GoodGenerator')+':'+texture])
    for m in re.finditer(r'Loaders\.(\w+(?:\[\d+\])?)\s*=\s*new\s+\w+\s*\(',loader):
        end=matching(loader,m.end()-1);args=split_args(loader[m.end():end])
        key=args[0].removeprefix('MetaTileEntityIDs.').split('.')[0] if args else ''
        if key not in ids:continue
        strings=[s[1:-1] for s in args if re.fullmatch(r'"[^"]+"',s)]
        stacks[m[1]]={'name':strings[-1] if strings else m[1],'registry':'gregtech:gt.blockmachines','meta':numeric(ids[key]),
          'texture':'assets/gregtech/textures/blocks/iconsets/MACHINE_CASING_SOLID_STEEL.png'}
    # Single-texture GGItem registrations are physical components as well as
    # blocks/controllers. Match the registry call rather than inventing IDs.
    read('goodgenerator/items/GGItem.java')
    radioactive=read('goodgenerator/items/RadioactiveItem.java')
    if not re.search(r'class RadioactiveItem extends GGItem',radioactive):raise ValueError('changed radioactive item registration')
    for variable,registry in re.findall(r'GameRegistry\s*\.registerItem\(\s*(\w+),\s*"([^"\n]+)",\s*Mods.ModIDs.GOOD_GENERATOR\s*\)',loader):
        definition=re.search(r'\b'+re.escape(variable)+r'\s*=\s*new (?:GGItem|RadioactiveItem)\(\s*"([^"\n]+)"\s*,',loader)
        if not definition:continue
        opening=loader.index('(',definition.start())
        args=split_args(loader[opening+1:matching(loader,opening)])
        texture='assets/goodgenerator/textures/items/'+definition[1]+'.png'
        # RadioactiveItem forwards name/tab to GGItem; its last argument is
        # radiation duration, not a subtype texture array.
        if 'new RadioactiveItem' not in definition[0] and args[-1]!='GoodGenerator.GG':
            if len(args)<3 or 'GoodGenerator.GG' not in args[:-1]:continue
            textures=re.findall(r'Mods.ModIDs.GOOD_GENERATOR\s*\+\s*":([^"\n]+)"',args[-1])
            if len(textures)!=1:
                if textures:item_variants[variable]=[{'name':importer.lang.get('item.'+definition[1]+'.'+str(meta)+'.name',registry+' '+str(meta)),
                    'registry':importer.mod_ids.get('GoodGenerator','GoodGenerator')+':'+registry,'meta':meta,
                    'texture':'assets/goodgenerator/textures/items/'+tex+'.png'} for meta,tex in enumerate(textures)]
                continue
            texture='assets/goodgenerator/textures/items/'+textures[0]+'.png'
        stacks[variable]={'name':importer.lang.get('item.'+definition[1]+'.name',registry),
          'registry':importer.mod_ids.get('GoodGenerator','GoodGenerator')+':'+registry,'meta':0,
          'texture':texture}
    accelerator_ids=re.search(r'int\[\] neutronAcceleratorIDs = new int\[\]\s*\{(.*?)\};',loader,re.S)
    accelerator_keys=re.findall(r'MetaTileEntityIDs\.(\w+)\.ID',accelerator_ids[1])
    importer.registered_neutron_accelerators={}
    for i,key in enumerate(accelerator_keys):
        importer.registered_neutron_accelerators['NeutronAccelerator'+str(i)]={'name':'中子加速器 '+key.removeprefix('NeutronAccelerator'),'registry':'gregtech:gt.blockmachines','meta':numeric(ids[key]),'texture':'assets/gregtech/textures/blocks/iconsets/MACHINE_CASING_SOLID_STEEL.png'}
    refs=read('goodgenerator/util/ItemRefer.java')
    for key,obj,meta in re.findall(r'ItemRefer\s+(\w+)\s*=\s*getItemStack\((\w+(?:\[\d+\])?)(?:,\s*(\d+))?\)',refs):
        if obj in item_variants:
            index=int(meta or 0)
            if index>=len(item_variants[obj]):raise ValueError('invalid GG subtype '+key)
            registered['ItemRefer.'+key]=item_variants[obj][index];continue
        if obj in stacks:registered['ItemRefer.'+key]=stacks[obj];continue
        if obj not in objects:continue
        name,textures=objects[obj];meta=int(meta or 0)
        if meta>=len(textures):continue
        domain,path=textures[meta].split(':',1)
        registered['ItemRefer.'+key]={'name':importer.lang.get('tile.'+name+'.'+str(meta)+'.name',key.replace('_',' ')),
          'registry':importer.mod_ids.get('GoodGenerator','GoodGenerator')+':'+name,'meta':meta,'texture':'assets/'+domain.lower()+'/textures/blocks/'+path+'.png'}
    # Decaying dusts are separately registered items, not Material dust aliases.
    dusts=read('gtPlusPlus/core/item/ModItems.java')
    read('gtPlusPlus/core/item/materials/DustDecayable.java')
    read('gtPlusPlus/core/item/base/BaseItemTickable.java')
    for key,name in re.findall(r'GregtechItemList\.(\w+)\.set\(\s*new DustDecayable\(\s*"([^"]+)"',dusts):
        registered['GregtechItemList.'+key]={'name':importer.lang.get('item.'+name+'.name',key),'registry':'miscutils:'+name,'meta':0,'texture':'assets/gregtech/textures/items/materialicons/NUCLEAR/dust.png'}
    importer.addon_items=registered
    read('gtPlusPlus/core/item/general/ItemBufferCore.java')
    read('gtPlusPlus/core/item/base/BaseItemWithDamageValue.java')
    for key,name,tier in re.findall(r'GregtechItemList\.(\w+)\.set\(new ItemBufferCore\("([^"]+)",\s*(\d+)\)\)',dusts):
        registered['GregtechItemList.'+key]={'name':importer.lang.get('item.'+name+tier+'.name',key),'registry':'miscutils:item.'+name+tier,'meta':0,'texture':'assets/miscutils/textures/items/'+name+'.png'}
    read('gtPlusPlus/core/item/general/chassis/ItemDehydratorCoilWire.java')
    for key,meta in re.findall(r'GregtechItemList\.(\w+)\.set\(new ItemStack\(dehydratorCoilWire,\s*1,\s*(\d+)\)\)',dusts):
        registered['GregtechItemList.'+key]={'name':key,'registry':'miscutils:itemDehydratorCoilWire','meta':int(meta),'texture':'assets/miscutils/textures/items/itemDehydratorCoilWire_'+meta+'.png'}
    # Direct Loaders fields and ItemRefer are aliases of the same stack.
    for key,obj,meta in re.findall(r'ItemRefer\s+(\w+)\s*=\s*getItemStack\((\w+)(?:,\s*(\d+))?\)',refs):
        if 'ItemRefer.'+key in registered and not meta:
            registered['Loaders.'+obj]=registered['ItemRefer.'+key]
    text=read('ggfab/GigaGramFab.java')
    for key,meta,title in re.findall(r'GGItemList\.(\w+)\.set\(\s*new \w+\((\w+)\.ID,\s*"[^"]+",\s*"([^"]+)"\)',text):
        registered['GGItemList.'+key]={'name':title,'registry':'gregtech:gt.blockmachines','meta':numeric(ids[meta]),'texture':'assets/gregtech/textures/blocks/iconsets/MACHINE_CASING_SOLID_STEEL.png'}
    # Read beamline hatches and Kuba's detector from their pinned registrations.
    # These are physical components used by the BEC interface recipes.
    for label,namespace,pattern in [
        ('gtnhlanth/common/register/LanthItemList.java','LanthItemList',r'\b(\w+)\s*=\s*new\s+\w+\s*\('),
        ('kubatech/loaders/RecipeLoader.java','KubaItemList',r'\b(ElectrodeDetectorHatch|DraconicEvolutionFusionCrafter)\s*\.set\(\s*new\s+\w+\s*\('),
    ]:
        text=read(label)
        for m in re.finditer(pattern,text):
            end=matching(text,m.end()-1);args=split_args(text[m.end():end])
            if len(args)<3:continue
            key=args[0].removeprefix('MetaTileEntityIDs.').split('.')[0]
            try:meta=numeric(ids[key] if key in ids else args[0])
            except (ValueError,SyntaxError):continue
            if not re.fullmatch(r'"[^"\n]+"',args[1]) or not re.fullmatch(r'"[^"\n]+"',args[2]):continue
            registered[namespace+'.'+m[1]]={'name':importer.lang.get('gt.blockmachines.'+args[1][1:-1]+'.name',args[2][1:-1]),
                'registry':'gregtech:gt.blockmachines','meta':meta,'texture':'assets/gregtech/textures/blocks/iconsets/MACHINE_CASING_SOLID_STEEL.png'}
    lanth=read('gtnhlanth/common/register/LanthItemList.java')
    raw=read('kubatech/loaders/ItemLoader.java')
    read('kubatech/loaders/item/kubaitem/KubaItems.java');read('kubatech/loaders/item/kubaitem/ItemProxy.java')
    entries=list(re.finditer(r'\b(\w+)\s*\.set\(kubaitems\.registerProxyItem\(new\s+\w+\(',raw))
    for meta,m in enumerate(entries):
        if not m[1].startswith('DEFC'):continue
        args=split_args(raw[m.end():matching(raw,m.end()-1)])
        name=args[0].strip('"')
        registered['KubaItemList.'+m[1]]={'name':importer.lang.get('kubaitem.'+name+'.name',m[1]),'registry':'kubatech:kubaitems','meta':meta,'texture':'assets/kubatech/textures/items/'+name+'.png'}
    raw=read('kubatech/loaders/block/defc/BlockDEFCCasing.java')
    for meta,key in re.findall(r'register\((\d+), ItemList\.(DEFC\w+)',raw):
        registered['KubaItemList.'+key]={'name':importer.lang.get('defc.casing.'+meta+'.name',key),'registry':'gregtech:defc.casing','meta':int(meta),'texture':'assets/kubatech/textures/blocks/casing/defc_'+str(int(meta)-7)+'.png'}
    read('gtnhlanth/common/item/ItemLanth.java')
    domain=importer.mod_ids['GTNHLanthanides']
    for key,name in re.findall(r'public static Item (\w+) = new ItemLanth\("([^"]+)"\)',lanth):
        if 'registerItem('+key not in lanth:continue
        # registerTypical uses getUnlocalizedName(), which includes item.
        registered['LanthItemList.'+key]={'name':importer.lang.get('item.'+name+'.name',name),
            'registry':domain+':item.'+name,'meta':0,'texture':'assets/'+domain.lower()+'/textures/items/'+name+'.png'}
    read('gtnhlanth/common/block/BlockCasing.java')
    read('gtnhlanth/common/block/BlockShieldedAccGlass.java')
    for key,name in re.findall(r'public static final Block (\w+) = new BlockCasing\("([^"]+)"\)',lanth):
        if 'registerBlock('+key not in lanth:continue
        registered['LanthItemList.'+key]={'name':importer.lang.get('casing.'+name+'.name',name),'registry':domain+':casing.'+name,'meta':0,'texture':'assets/'+domain.lower()+'/textures/blocks/casing.'+name+'.png'}
    registered['LanthItemList.SHIELDED_ACCELERATOR_GLASS']={'name':'屏蔽加速器玻璃','registry':domain+':tile.casing.shielded_accelerator_glass','meta':0,'texture':'assets/'+domain.lower()+'/textures/blocks/casing.shielded_accelerator_glass.png'}
    text=read('gtPlusPlus/xmod/gregtech/common/blocks/GregtechMetaCasingBlocks3.java')
    textures=read('gtPlusPlus/xmod/gregtech/common/blocks/textures/TexturesGtBlock.java')
    if 'Casing_AdvancedVacuum.set(new ItemStack(this, 1, 10))' not in text:raise ValueError('changed advanced vacuum casing')
    texture=re.search(r'TEXTURE_CASING_ADVANCED_CRYOGENIC\s*=\s*new CustomIcon\(\s*"([^"]+)"',textures)[1]
    registered['GregtechItemList.Casing_AdvancedVacuum']={'name':'高级低温外壳','registry':'miscutils:gtplusplus.blockcasings.3','meta':10,'texture':'assets/miscutils/textures/blocks/'+texture+'.png'}
    read('tectech/thing/item/ItemAstralArrayFabricator.java')
    registered['CustomItemList.astralArrayFabricator']={'name':'星界阵列制造器','registry':'tectech:item.tm.itemAstralArrayFabricator','meta':0,'texture':'assets/tectech/textures/items/itemAstralArray.png'}
    read('gtnhintergalactic/item/ItemDysonSwarmParts.java')
    importer.itemlist['UHTResistantMesh']={'name':'超高温耐热网','registry':'gtnhintergalactic:item.DysonSwarmParts','meta':3,'texture':'assets/gtnhintergalactic/textures/items/UHTResistantMesh.png'}
    text=read('gtnhintergalactic/block/BlockCasingSpaceElevatorMotor.java')
    registry=re.search(r'super\(\w+\.class,\s*"([^"]+)"',text)[1]
    icons=dict(re.findall(r'IconSEMotorSide\[(\d+)\]\s*=\s*iconRegister.registerIcon\(GTNHIntergalactic.ASSET_PREFIX\s*\+\s*":([^"]+)"',text))
    for key,meta in re.findall(r'ItemList\.(\w+)\.set\(new ItemStack\(this,\s*1,\s*(\d+)\)\)',text):
        importer.itemlist[key]={'name':importer.lang.get(registry+'.'+meta+'.name',key),'registry':'gregtech:'+registry,'meta':int(meta),'texture':'assets/gtnhintergalactic/textures/blocks/'+icons[meta]+'.png'}
    read('gtPlusPlus/xmod/gregtech/common/blocks/GregtechMetaCasingBlocks6.java')
    registered['GregtechItemList.Casing_Fusion_Internal2']={'name':'聚变线圈 III','registry':'miscutils:gtplusplus.blockcasings.6','meta':1,'texture':'assets/miscutils/textures/blocks/iconsets/MACHINE_CASING_FUSION_COIL_III.png'}
    # Resolve literal GT++ machine registrations and their actual metadata.
    for path in sorted((importer.source/'gtPlusPlus/xmod/gregtech/registration').rglob('*.java')):
        label=str(path.relative_to(importer.source)).replace('\\','/');text=read(label)
        for m in re.finditer(r'GregtechItemList\.(\w+)\s*\.set\(\s*new\s+\w+\s*\(',text):
            end=matching(text,m.end()-1);args=split_args(text[m.end():end])
            if len(args)<3:continue
            key=args[0].removeprefix('MetaTileEntityIDs.').split('.')[0]
            if key not in ids:continue
            title=re.fullmatch(r'"([^"\n]+)"',args[2]);lang=re.fullmatch(r'"([^"\n]+)"',args[1])
            if not title:continue
            registered['GregtechItemList.'+m[1]]={'name':importer.lang.get('gt.blockmachines.'+lang[1]+'.name',title[1]) if lang else title[1],
              'registry':'gregtech:gt.blockmachines','meta':numeric(ids[key]),'texture':'assets/gregtech/textures/blocks/iconsets/MACHINE_CASING_SOLID_STEEL.png'}
    textures=read('gtPlusPlus/xmod/gregtech/common/blocks/textures/TexturesGtBlock.java')
    gt_textures=read('gregtech/api/enums/Textures.java')
    framework=re.findall(r'INTEGRAL_FRAMEWORK_\w+\s*=\s*create\("([^"]+)"\)',gt_textures)
    custom=dict(re.findall(r'\b(\w+)\s*=\s*new CustomIcon\(\s*"([^"]+)"',textures))
    for path in sorted((importer.source/'gtPlusPlus/xmod/gregtech/common/blocks').glob('GregtechMeta*.java')):
        label=str(path.relative_to(importer.source)).replace('\\','/');text=read(label)
        block=re.search(r'super\([^;]*?"((?:gtplusplus|miscutils)\.[^"]+)"',text)
        if not block:continue
        faces={meta:icons[-1] for meta,body in re.findall(r'case\s+(\d+)\s*->(.*?)(?=case\s+\d+\s*->|default\s*->)',text,re.S) if (icons:=re.findall(r'TexturesGtBlock\.(\w+)\.getIcon\(\)',body))}
        gt_faces={meta:icons[-1] for meta,body in re.findall(r'case\s+(\d+)\s*->(.*?)(?=case\s+\d+\s*->|default\s*->)',text,re.S) if (icons:=re.findall(r'Textures.BlockIcons\.(\w+)\.getIcon\(\)',body))}
        for key,meta in re.findall(r'GregtechItemList\.(\w+)\.set\(new ItemStack\(this,\s*1,\s*(\d+)\)\)',text):
            if 'Textures.BlockIcons.INTEGRAL_FRAMEWORK[aMeta]' in text and int(meta)<10:
                registered['GregtechItemList.'+key]={'name':importer.lang.get(block[1]+'.'+meta+'.name',key.replace('_',' ')),
                  'registry':'miscutils:'+block[1],'meta':int(meta),'texture':'assets/gregtech/textures/blocks/iconsets/'+framework[int(meta)]+'.png'}
                continue
            texture=custom.get(faces.get(meta))
            if not texture and meta in gt_faces:
                registered['GregtechItemList.'+key]={'name':importer.lang.get(block[1]+'.'+meta+'.name',key.replace('_',' ')),
                  'registry':'miscutils:'+block[1],'meta':int(meta),'texture':'assets/gregtech/textures/blocks/iconsets/'+gt_faces[meta]+'.png'}
                continue
            if not texture:continue
            registered['GregtechItemList.'+key]={'name':importer.lang.get(block[1]+'.'+meta+'.name',key.replace('_',' ')),
              'registry':'miscutils:'+block[1],'meta':int(meta),'texture':'assets/miscutils/textures/blocks/'+texture+'.png'}
    text=read('gtnhintergalactic/item/ItemMiningDrones.java')
    read('gtnhintergalactic/proxy/CommonProxy.java')
    drones=re.search(r'private static final String\[\] NAMES = new String\[\] \{(.*?)\};',text,re.S)
    for meta,key in enumerate(re.findall(r'"(MiningDrone\w+)"',drones[1])):
        importer.itemlist[key]={'name':key.removeprefix('MiningDrone')+' 采矿无人机','registry':'gtnhintergalactic:item.MiningDrone','meta':meta,'texture':'assets/gtnhintergalactic/textures/items/'+key+'.png'}
    text=read('gtnhintergalactic/loader/MachineLoader.java')
    # IG registers controllers through a local ItemStack rather than a chained
    # ItemList.set(new MTE(...)) call.
    for m in re.finditer(r'stack\s*=\s*new\s+[\w.]+\(\s*(\w+)\.ID,\s*"([^"]+)"[^;]+?;\s*ItemList\.(\w+)\.set\(stack\)',text,re.S):
        if m[1] not in ids:raise ValueError('unknown IG machine '+m[1])
        importer.itemlist[m[3]]={'name':importer.lang.get('gt.blockmachines.'+m[2]+'.name',m[3]),'registry':'gregtech:gt.blockmachines','meta':numeric(ids[m[1]]),'texture':'assets/gregtech/textures/blocks/iconsets/MACHINE_CASING_SOLID_STEEL.png'}
    text=read('bartworks/common/loaders/ItemRegistry.java')
    distributor=re.search(r'int\[\] EnergyDistributors = new int\[\]\s*\{([^}]+)',text)
    importer.bw_distributors={}
    for index,key in enumerate(re.findall(r'(\w+)\.ID',distributor[1])):
        importer.bw_distributors[index]={'name':'能源分配器 '+key.removeprefix('EnergyDistributor_'),
            'registry':'gregtech:gt.blockmachines','meta':numeric(ids[key]),'texture':'assets/gregtech/textures/blocks/iconsets/MACHINE_CASING_SOLID_STEEL.png'}
    for index,key,name,title in re.findall(r'ItemRegistry\.voidminer\[(\d+)\]\s*=\s*new\s+MTEVoidMiners\.\w+\((\w+)\.ID,\s*"([^"]+)",\s*"([^"]+)"\)',text):
        registered['LanthItemList.VoidMiner'+index]={'name':title,'registry':'gregtech:gt.blockmachines','meta':numeric(ids[key]),'texture':'assets/gregtech/textures/blocks/iconsets/OVERLAY_FRONT_OIL_DRILL.png'}
    text=read('gtnhintergalactic/block/BlockCasingSpaceElevator.java')
    for key,meta in re.findall(r'ItemList\.(\w+)\.set\(new ItemStack\(this,\s*1,\s*(\d+)\)\)',text):
        texture=['BaseCasing','SupportStructure_Side','InternalStructure_Side'][int(meta)]
        importer.itemlist[key]={'name':importer.lang.get('gt.blockcasingsSE.'+meta+'.name',key),'registry':'gregtech:gt.blockcasingsSE','meta':int(meta),'texture':'assets/gtnhintergalactic/textures/blocks/spaceElevator/'+texture+'.png'}
    read('gtnhintergalactic/item/ItemSpaceElevatorParts.java');read('gtnhintergalactic/proxy/CommonProxy.java')
    importer.itemlist['NanotubeSpool']={'name':'纳米管线轴','registry':'gtnhintergalactic:item.SpaceElevatorParts','meta':0,'texture':'assets/gtnhintergalactic/textures/items/nanotubeSpool.png'}
    read('gtnhintergalactic/block/BlockSpaceElevatorCable.java')
    importer.itemlist['SpaceElevatorCable']={'name':'太空电梯缆索','registry':'gtnhintergalactic:spaceelevatorcable','meta':0,'texture':'assets/gtnhintergalactic/textures/blocks/spaceElevator/CablePart.png'}
    importer.itemlist['DeepEarthHeatingPump']={'name':'深井地热泵','registry':'gregtech:gt.blockmachines','meta':numeric(ids['DeepEarthHeatingPump']),
      'texture':'assets/gregtech/textures/blocks/iconsets/OVERLAY_FRONT_OIL_DRILL.png'}
    text=read('gregtech/loaders/preload/LoaderGTBlockFluid.java')
    read('gregtech/api/items/GTGenericItem.java')
    for m in re.finditer(r'ItemList\.(\w+)\s*\.set\(\s*new\s+(?:ItemCoolantCellIC|ItemDepletedCell|ItemRadioactiveCellIC|ItemBreederCell|ItemNeutronReflector)\s*\(',text):
        end=matching(text,m.end()-1);args=split_args(text[m.end():end])
        if len(args)<2 or not all(re.fullmatch(r'"[^"\n]+"',s) for s in args[:2]):continue
        name,title=[s[1:-1] for s in args[:2]]
        importer.itemlist[m[1]]={'name':importer.lang.get('gt.'+name+'.name',title),'registry':'gregtech:gt.'+name,'meta':0,
          'texture':'assets/gregtech/textures/items/gt.'+name+'.png'}
