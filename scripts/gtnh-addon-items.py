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
        if len(args)<3:continue
        key=args[0].split('.')[0]
        if key not in ids:continue
        # TecTech energy hatches pass an empty display title and obtain their
        # name from the language key; their registry metadata is still literal.
        title=re.fullmatch(r'"([^"\n]*)"',args[2]);lang=re.fullmatch(r'"([^"\n]+)"',args[1])
        if not title:continue
        registered['CustomItemList.'+m[1]]={'name':importer.lang.get('gt.blockmachines.'+lang[1]+'.name',title[1] or m[1]) if lang else title[1] or m[1],
          'registry':'gregtech:gt.blockmachines','meta':numeric(ids[key]),'texture':'assets/gregtech/textures/blocks/iconsets/MACHINE_CASING_SOLID_STEEL.png'}
    for label in ('tectech/thing/casing/BlockGodforgeCasings.java','tectech/thing/casing/BlockGTCasingsTT.java','tectech/thing/casing/BlockGTCasingsBA0.java','tectech/thing/casing/StabilisationFieldCasing.java'):
        text=read(label)
        block=re.search(r'super\([^;]*?"([^"]+)"',text)
        icons=dict(re.findall(r'(\w+)\s*=\s*\w+\.registerIcon\("([^"]+)"\)',text))
        faces={meta:returns[-1] for meta,body in re.findall(r'case\s+(\d+)\s*:(.*?)(?=case\s+\d+\s*:|default\s*:)',text,re.S)
               if (returns:=re.findall(r'return\s+(\w+)\s*;',body))}
        if not block:continue
        for key,meta in re.findall(r'CustomItemList\.(\w+)\.set\(new ItemStack\(this,\s*1,\s*(\d+)\)\)',text):
            texture=icons.get(faces.get(meta))
            if label.endswith('BlockGodforgeCasings.java') and meta in ('5','6','7'):
                texture=icons.get({'5':'GravitonModulatorT1','6':'GravitonModulatorT2','7':'GravitonModulatorT3'}[meta])
            if not texture:continue  # Unknown face mappings stay unresolved.
            domain,path=texture.split(':',1)
            registered['CustomItemList.'+key]={'name':importer.lang.get(block[1]+'.'+meta+'.name',key.replace('_',' ')),
              'registry':'gregtech:'+block[1],'meta':int(meta),'texture':'assets/'+domain+'/textures/blocks/'+path+'.png'}
    loader=read('goodgenerator/loader/Loaders.java');objects={}
    for m in re.finditer(r'\b(\w+)\s*=\s*new\s+(?:BlockCasing|BlockFrame)\s*\(',loader):
        end=matching(loader,m.end()-1);args=split_args(loader[m.end():end])
        if len(args)<2 or not re.fullmatch(r'"[^"]+"',args[0]):continue
        textures=[]
        for v in re.findall(r'(?:Mods.ModIDs.GOOD_GENERATOR\s*\+\s*)?"([^"\n]+)"',args[1]):
            if v.startswith(':'):v=importer.mod_ids.get('GoodGenerator','GoodGenerator')+v
            if ':' in v:textures.append(v)
        if textures:objects[m[1]]=(args[0][1:-1],textures)
    stacks={}
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
    for variable,registry in re.findall(r'GameRegistry\s*\.registerItem\(\s*(\w+),\s*"([^"\n]+)",\s*Mods.ModIDs.GOOD_GENERATOR\s*\)',loader):
        definition=re.search(r'\b'+re.escape(variable)+r'\s*=\s*new GGItem\(\s*"([^"\n]+)"\s*,',loader)
        if not definition:continue
        opening=loader.index('(',definition.start())
        args=split_args(loader[opening+1:matching(loader,opening)])
        texture='assets/goodgenerator/textures/items/'+definition[1]+'.png'
        if args[-1]!='GoodGenerator.GG':
            if len(args)<3 or args[1]!='GoodGenerator.GG':continue
            textures=re.findall(r'Mods.ModIDs.GOOD_GENERATOR\s*\+\s*":([^"\n]+)"',args[-1])
            if len(textures)!=1:continue # multi-subtype components require per-meta resolution
            texture='assets/goodgenerator/textures/items/'+textures[0]+'.png'
        stacks[variable]={'name':importer.lang.get('item.'+definition[1]+'.name',registry),
          'registry':importer.mod_ids.get('GoodGenerator','GoodGenerator')+':'+registry,'meta':0,
          'texture':texture}
    refs=read('goodgenerator/util/ItemRefer.java')
    for key,obj,meta in re.findall(r'ItemRefer\s+(\w+)\s*=\s*getItemStack\((\w+(?:\[\d+\])?)(?:,\s*(\d+))?\)',refs):
        if obj in stacks:registered['ItemRefer.'+key]=stacks[obj];continue
        if obj not in objects:continue
        name,textures=objects[obj];meta=int(meta or 0)
        if meta>=len(textures):continue
        domain,path=textures[meta].split(':',1)
        registered['ItemRefer.'+key]={'name':importer.lang.get('tile.'+name+'.'+str(meta)+'.name',key.replace('_',' ')),
          'registry':importer.mod_ids.get('GoodGenerator','GoodGenerator')+':'+name,'meta':meta,'texture':'assets/'+domain.lower()+'/textures/blocks/'+path+'.png'}
    importer.addon_items=registered
    read('tectech/thing/item/ItemAstralArrayFabricator.java')
    registered['CustomItemList.astralArrayFabricator']={'name':'星界阵列制造器','registry':'tectech:item.tm.itemAstralArrayFabricator','meta':0,'texture':'assets/tectech/textures/items/itemAstralArray.png'}
    read('gtnhintergalactic/item/ItemDysonSwarmParts.java')
    importer.itemlist['UHTResistantMesh']={'name':'超高温耐热网','registry':'gtnhintergalactic:item.DysonSwarmParts','meta':3,'texture':'assets/gtnhintergalactic/textures/items/UHTResistantMesh.png'}
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
        block=re.search(r'super\([^;]*?"(gtplusplus\.[^"]+)"',text)
        if not block:continue
        faces=dict(re.findall(r'case\s+(\d+)\s*->\s*TexturesGtBlock\.(\w+)\.getIcon\(\)',text))
        for key,meta in re.findall(r'GregtechItemList\.(\w+)\.set\(new ItemStack\(this,\s*1,\s*(\d+)\)\)',text):
            if 'Textures.BlockIcons.INTEGRAL_FRAMEWORK[aMeta]' in text and int(meta)<10:
                registered['GregtechItemList.'+key]={'name':importer.lang.get(block[1]+'.'+meta+'.name',key.replace('_',' ')),
                  'registry':'miscutils:'+block[1],'meta':int(meta),'texture':'assets/gregtech/textures/blocks/iconsets/'+framework[int(meta)]+'.png'}
                continue
            texture=custom.get(faces.get(meta))
            if not texture:continue
            registered['GregtechItemList.'+key]={'name':importer.lang.get(block[1]+'.'+meta+'.name',key.replace('_',' ')),
              'registry':'miscutils:'+block[1],'meta':int(meta),'texture':'assets/miscutils/textures/blocks/'+texture+'.png'}
    read('bartworks/common/loaders/ItemRegistry.java')
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
