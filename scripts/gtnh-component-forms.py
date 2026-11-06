"""Expand referenced GT component forms using their original registrators."""
import hashlib
import re


def generate(imp,needed,mass,numeric):
    material_text=(imp.source/'gregtech/loaders/materials/MaterialsInit.java').read_text(encoding='utf-8')
    def emit(template,process,ins,outs,ticks,power,line,tools=None,conditions=None,circuit=None):
        imp.active_file=template
        imp.paths[template]=hashlib.sha256((imp.source/template).read_bytes()).hexdigest()
        return imp.emit_recipe(process,ins,outs,ticks,power,line,tools or {},conditions or {},[],circuit)
    directory='gregtech/loaders/oreprocessing/'
    # The two real alloy-plate registrations provide reinforced glass.
    # Do not invent a reinforced-glass powder to bypass this route.
    glass=imp.named('ReinforcedGlass')
    for material,line in [('Carbon',505),('HV',519)]:
        plate=imp.material(material,'plateAlloy')
        for input in [imp.stack('new ItemStack(Blocks.glass,1,0)')[0],imp.material('Glass','dust')]:
            emit(directory+'ProcessingPlate.java','alloy',{plate:1,input:3},{glass:4},400,4,line)
    for name,forms in list(needed.items()):
        m=imp.materials.get(name);value=mass(name)
        body=re.search(r'private static Materials load'+re.escape(name)+r'\(\)\s*\{(.*?)(?=\n    private static|\Z)',material_text,re.S)
        if not m or value is None or not body:continue
        body=body[1];eu=lambda n:m['processingEU'] or n
        f=lambda prefix:imp.material(name,prefix)
        if name=='Paper' and 'plate' in forms:
            # This is vanilla paper, explicitly unified by
            # LoaderGTOreDictionary, not an additional invented metal plate.
            reeds=imp.stack('new ItemStack(Items.reeds,1,0)')[0]
            r=emit(directory+'ProcessingPlate.java','craft',{reeds:3},{f('plate'):2},20,0,133)
            if r:r.update(stage=0,grid=[reeds,reeds,reeds,None,None,None,None,None,None],craftingSource='shaped',durationAdapted=True)
        # ProcessingDust has a distinct route for non-smeltable powders whose
        # block prefix is absent/ignored (including diamond). NO_SMASHING
        # prevents hammering, but does not disable this compressor branch.
        dust_excluded={'GraniteRed','GraniteBlack','Basalt','Marble','Glass','Obsidian','Glowstone','Paper','TranscendentMetal','Clay','Wood','Carbon','Stone'}
        if 'plate' in forms and m['dust'] and (not m['metal'] or 'NO_SMELTING' in m['tags']) and 'NO_WORKING' not in m['tags'] and '.removeOrePrefix(OrePrefixes.block)' in body and name not in dust_excluded:
            emit(directory+'ProcessingDust.java','electricCompress',{f('dust'):1},{f('plate'):1},300,2,155)
        if 'rotor' in forms and 'NO_WORKING' not in m['tags']:
            forms|={'plate','ring','stick','screw'}
            for solder,mult in [('SolderingAlloy',1),('Tin',2),('Lead',4)]:
                emit(directory+'ProcessingRotor.java','assemble',{f('plate'):4,f('ring'):1,imp.material(solder,'molten'):16*mult},{f('rotor'):1},max(value,1),eu(24),66,circuit=4)
            if m['metal']:
                emit(directory+'ProcessingRotor.java','extrude',{f('ingot'):5},{f('rotor'):1},max(value,1),eu(24),79,tools={imp.named('Shape_Extruder_Rotor'):1})
        if 'frameGt' in forms and (m['metal'] or name=='Wood'):
            forms.add('stick')
            label='gregtech/loaders/preload/LoaderMetaPipeEntities.java'
            if 'NO_RECIPES' not in m['tags']:emit(label,'assemble',{f('stick'):4},{f('frameGt'):1},64,eu(7),57,circuit=4)
            if m['processingEU']<8192:
                rod=f('stick');r=emit(label,'craft',{rod:8},{f('frameGt'):2},1,0,46,tools={'wrench':1})
                if r:r.update(stage=0,grid=[rod,rod,rod,rod,None,rod,rod,rod,rod],gridTools={'4':'wrench'},handToolsAdapted=True,durationAdapted=True)
        if 'plateSuperdense' in forms and ('NO_SMASHING' not in m['tags'] or 'STRETCHY' in m['tags']):
            forms.add('plate')
            emit(directory+'ProcessingPlate.java','electricCompress',{f('plate'):64},{f('plateSuperdense'):1},max(value*32,1),eu(96),379,conditions={'compressionTier':2 if m['processingEU']>=7864320 or 'BLACK_HOLE' in m['tags'] else 1})
        if 'lens' in forms and name not in ('Salt','RockSalt','Spodumene'):
            if name=='ChromaticGlass':
                emit(directory+'ProcessingLens.java','electricCompress',{f('dust'):16},{f('lens'):1},12000,1966080,69)
            else:
                forms.add('plate')
                special=name in ('Diamond','Glass')
                emit(directory+'ProcessingLens.java','lathe',{f('plate'):1},{f('lens'):1,f('dustSmall'):1},1200,30 if special else 120,43 if special else 79)
                if m['gems']:
                    emit(directory+'ProcessingLens.java','lathe',{f('gemExquisite'):1},{f('lens'):3 if special else 1,f('dust'):1 if special else 2},2400,15 if special else 30,53 if special else 98)
        # Gem processing has its own input forms and restrictions. Never
        # fabricate metal ingots for a gemstone just to use metal templates.
        if m['gems']:
            if 'NO_SMASHING' not in m['tags'] and name!='Iridium' and 'plate' in forms:
                emit(directory+'ProcessingGem.java','forgeHammer',{f('gem'):1},{f('plate'):1},max(value,1),eu(16),106)
                emit(directory+'ProcessingGem.java','bend',{f('gem'):1},{f('plate'):1},max(value*2,1),eu(24),119,circuit=1)
            if 'NO_WORKING' not in m['tags'] and 'CRYSTAL' in m['tags'] and forms&{'stick','screw','bolt'}:
                forms.add('stick')
                emit(directory+'ProcessingStick.java','lathe',{f('gem'):1},{f('stick'):1,imp.material(m['macerating'],'dustSmall'):2},max(value*5,1),eu(16),47)
            if 'screw' in forms:
                forms.add('bolt')
                emit(directory+'ProcessingScrew.java','lathe',{f('bolt'):1},{f('screw'):1},max(value//8,1),eu(4),24)
            if 'bolt' in forms and 'NO_WORKING' not in m['tags']:
                for liquid,minimum,maximum,divisor,mult in [('Water',4,1000,320,2),('DistilledWater',3,750,426,2),('Lubricant',1,250,1280,1)]:
                    time=max(value*2,1);id='distilledWater' if liquid=='DistilledWater' else imp.material(liquid)
                    emit(directory+'ProcessingStick.java','cut',{f('stick'):1,id:max(minimum,min(maximum,time*mult*eu(4)//divisor))},{f('bolt'):4},time*mult,eu(4),61)
        # Non-metal powders such as redstone and glass still have molten
        # forms when explicitly tagged SMELTING_TO_FLUID.
        melting=re.search(r'\.setMeltingPoint\(([^)]+)\)',body)
        if not m['metal'] and 'SMELTING_TO_FLUID' in m['tags'] and 'NO_SMELTING' not in m['tags'] and not m['blast']:
            # GTProxy.addAutogeneratedMoltenFluid uses 1000 when no melting
            # point is set. ReverseFluidSmelting reads fluid temperature.
            temperature=numeric(melting[1]) if melting else -1
            if temperature<0:temperature=1000
            power=max(8,int((2*temperature)**.5));tier=next((i for i in range(15) if 8*4**i>=power),14)
            if tier:power=min(power,[7,30,120,480,1920,7680,30720,122880,491520,1966080,7864320,31457280,125829120,503316480,2013265920][tier])
            emit('gregtech/api/util/GTRecipeRegistrator.java','melt',{f('dust'):1},{f('molten'):144},24,power,217)
            proxy='gregtech/common/GTProxy.java';imp.paths[proxy]=hashlib.sha256((imp.source/proxy).read_bytes()).hexdigest()
            if 'plate' in forms:emit(directory+'ProcessingPlate.java','solidify',{f('molten'):144},{f('plate'):1},32,eu(8),121,tools={imp.named('Shape_Mold_Plate'):1})
