"""Expand real MTEBioLab module logic, preserving named DNA and module costs.

NEI fake recipes are not treated as production. Filled fluid cells use the
project's physical fluid input ports; no culture or data sample is free.
"""
import hashlib
import re


def generate(imp, split_args, matching, numeric):
    def read(label):
        p=imp.source/label
        imp.paths[label]=hashlib.sha256(p.read_bytes()).hexdigest()
        return p.read_text(encoding='utf-8')
    dna_text=read('bartworks/API/enums/BioDataEnum.java')
    culture_text=read('bartworks/API/enums/BioCultureEnum.java')
    logic_label='bartworks/common/tileentities/tiered/MTEBioLab.java'
    logic=read(logic_label)
    read('bartworks/util/BioData.java');read('bartworks/util/BioCulture.java')
    read('gregtech/common/items/behaviors/BehaviourDataOrb.java')
    if not all(s in logic for s in ('IS_NC_SYNTHESIS = new boolean[] { true, true, false, false }',
            'IS_NC_CLONAL = new boolean[] { true, false, false, false }','GTValues.V[effectiveRecipeTier]), 500)',
            'cultureDNABioData.getChance() > XSTR_INSTANCE.nextInt(100_00)')):raise ValueError('changed dynamic biolab module logic')
    domain=imp.mod_ids['BartWorks'];data={};cultures={};tiers=['ULV','LV','MV','HV','EV','IV','LuV','ZPM','UV','UHV','UEV','UIV','UMV','UXV','MAX']
    imp.constants={}
    orb_base=imp.named('Tool_DataOrb');orb_native=imp.items[orb_base]['nativeItem']
    for m in re.finditer(r'^\s*(\w+)\("[^"\n]+",\s*\d+,\s*EnumRarity\.',dna_text,re.M):
        start=dna_text.index('(',m.start());args=split_args(dna_text[start+1:matching(dna_text,start)])
        key=m[1];name=args[0][1:-1];chance=numeric(args[3]);tier=tiers.index(args[4].split('.')[-1]);ids={}
        for field,meta,index,texture in [('dna',1,5,'DNASampleFlask'),('plasmid',2,6,'PlasmidCell')]:
            item=args[index].split('.')[-1]
            imp.itemlist[item]={'registry':domain+':BioLabParts','meta':meta,'name':name+(' DNA 样品' if field=='dna' else '质粒'),
                'nbt':{'Name':name},'texture':'assets/'+domain.lower()+'/textures/items/'+texture+'.png'}
            ids[field]=imp.named(item)
        orb='bioDNAOrb_'+key
        imp.items[orb]={'id':orb,'name':name+' DNA 数据球','kind':'item','category':'研究数据',
            'nativeItem':{**orb_native,'nbt':{'mDataTitle':'DNA Sample','mDataName':name}}}
        data[key]={'name':name,'chance':chance,'tier':tier,'orb':orb,**ids}
    # The runtime name lookup chooses the last enum with a matching NBT name.
    by_name={d['name']:d for d in data.values()}
    for m in re.finditer(r'^\s*(\w+)\("[^"\n]+",\s*\d+,\s*EnumRarity\.',culture_text,re.M):
        start=culture_text.index('(',m.start());args=split_args(culture_text[start+1:matching(culture_text,start)])
        cultures[m[1]]={'item':imp.named(args[-1].split('.')[-1]),'name':args[0][1:-1],
            'dna':args[4].split('.')[-1],'plasmid':args[5].split('.')[-1]}
    imp.active_file=logic_label
    modules=[imp.stack(f'BioItemList.mBioLabParts[{i}]')[0] for i in range(5)]
    liquid=imp.stack('GTModHandler.getLiquidDNA(1000)')[0]
    fluids={name:imp.bio_registered[name] for name in ('fluorecentddna','enzymessollution','penicillin','polymerase')}
    def emit(module,inputs,out,d,offset,tools=None):
        required=d['tier']+offset
        tools={**(tools or {}),modules[module]:1}
        marker='private int process'+['DNA','PCR','Synthesis','Transformation','ClonalCellular'][module]+'Module'
        return imp.emit_recipe('bioLab',inputs,{out:1},500,8*4**required,logic.count('\n',0,logic.index(marker))+1,
            tools,{'bioLabTier':required},[{'id':out,'count':1,'chance':d['chance']}],None)
    for culture in cultures.values():
        d=data[culture['dna']];out=by_name[d['name']]['dna']
        emit(0,{culture['item']:1,imp.named('EmptyDNAFlask'):1,imp.named('DetergentPowder'):1,
            imp.material('Ethanol','fluid'):1000,'distilledWater':1000},out,d,0)
    for d in by_name.values():
        emit(1,{d['dna']:1,orb_base:1,fluids['fluorecentddna']:1000,fluids['polymerase']:1000,liquid:1000},d['orb'],d,1)
        tools={d['orb']:1};beta=by_name[data['BetaLactamase']['name']]['orb'];tools[beta]=tools.get(beta,0)+1
        emit(2,{imp.named('EmptyPlasmid'):1,fluids['enzymessollution']:1000,liquid:1000},d['plasmid'],d,1,tools)
    for source in cultures.values():
        for target in cultures.values():
            if source['dna']!=target['dna']:continue
            d=by_name[data[target['plasmid']]['name']]
            emit(3,{source['item']:1,d['plasmid']:1,fluids['penicillin']:1000,'distilledWater':1000},target['item'],d,1)
    for d in by_name.values():
        # Clonal synthesis uses the first matching DNA culture, then replaces
        # its plasmid. Only a registered culture can be returned by getPetriDish.
        base=next((c for c in cultures.values() if data[c['dna']]['name']==d['name']),None)
        target=next((c for c in cultures.values() if base and c['dna']==base['dna'] and data[c['plasmid']]['name']==d['name']),None)
        if not target:continue
        emit(4,{imp.named('EmptyPetriDish'):1,imp.named('PlasmaMembrane'):1,imp.named('Circuit_Chip_Stemcell'):1,liquid:8000},target['item'],d,3,{d['orb']:1})
    # Cultures, unlike their DNA, start at ULV/7500 in BioCulture's constructor.
    # AdditionalRecipes' real vat registrations are separate from NEI fakes.
    additional=read('bartworks/system/material/processingLoaders/AdditionalRecipes.java')
    constructor=read('bartworks/util/BioCulture.java')
    loader=read('bartworks/common/loaders/FluidLoader.java')
    if not all(s in constructor for s in ('75_00, VoltageIndex.ULV','this.bBreedable = culture.breedable')):raise ValueError('changed culture base tier/chance')
    if not all(s in additional for s in ('bioCulture.isBreedable() && bioCulture.getTier() == 0','new ItemStack(Items.sugar, 64)',
            'new FluidStack(bioCulture.getFluid(), 10)','duration(50 * SECONDS)','eut(TierEU.RECIPE_MV)')):raise ValueError('changed culture vat bootstrap')
    if not all(s in loader for s in ('GTModHandler.getLiquidDNA(100)','new FluidStack(B.getFluid(), 1000)','duration(25 * SECONDS)')):raise ValueError('changed culture DNA centrifuging')
    sugar=imp.stack('new ItemStack(Items.sugar,1)')[0]
    for key,fluid in imp.bio_culture_fluids.items():
        culture=cultures[key]['item'];imp.active_file='bartworks/system/material/processingLoaders/AdditionalRecipes.java'
        for water in ('water','distilledWater'):
            imp.emit_recipe('bioVat',{sugar:64,water:1000},{fluid:10},1000,120,223,{}, {'bioCulture':culture,'bioGlass':3},[],1)
            imp.emit_recipe('bioLab',{imp.named('EmptyPetriDish'):1,water:1000,fluid:1000},{culture:1},500,480,238,{}, {},[{'id':culture,'count':1,'chance':7500}],None)
        imp.active_file='bartworks/common/loaders/FluidLoader.java'
        imp.emit_recipe('centrifuge',{fluid:1000},{liquid:100},500,120,112,{}, {},[],10)
    # CropsNH's vine crop drops the physical vanilla vine. It is a legal
    # cropVine representative; do not treat arbitrary leaves as detergent.
    crop_path=imp.instance/'.minecraft/mods/cropsnh-2.0.140.jar'
    import zipfile
    with zipfile.ZipFile(crop_path) as archive:
        raw=archive.read('com/gtnewhorizon/cropsnh/crops/vanilla/CropVine.class')
        if b'field_150395_bd' not in raw:raise ValueError('changed CropsNH vine drop')
    imp.paths['instance/mods/'+crop_path.name]=hashlib.sha256(crop_path.read_bytes()).hexdigest()
    extractor=read('bartworks/common/loaders/recipes/Extractor.java')
    if not all(s in extractor for s in ('getOres("cropVine", false)','BWUtil.setStackSize(stack, 12)','ItemList.DetergentPowder.get(1)','duration(25 * SECONDS)')):raise ValueError('changed detergent extraction')
    imp.active_file='bartworks/common/loaders/recipes/Extractor.java'
    vine=imp.stack('new ItemStack(Blocks.vine,1)')[0]
    imp.items[vine].update(name='藤蔓',nativeVanilla='vine')
    imp.emit_recipe('extract',{vine:12},{imp.named('DetergentPowder'):1},500,480,25,{}, {},[],None)
    if 'unknownWater' in imp.items:imp.items['unknownWater']['nativeItem']['color']='8a2be2'
    return set(modules)|{v['orb'] for v in by_name.values()}
